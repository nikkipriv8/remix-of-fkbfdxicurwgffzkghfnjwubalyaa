import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation, Lead, Message } from "@/features/whatsapp/types";
import {
  fetchConversations,
  fetchLead,
  fetchMessages,
  insertOutboundMessage,
  setAutomation,
  setHumanTakeover,
  updateConversationLastMessageAt,
} from "@/features/whatsapp/services/whatsappApi";

export function useWhatsappController() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const refreshTimerRef = useRef<number | null>(null);

  const scheduleConversationsRefresh = () => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    // Debounce to avoid heavy N+1 refreshes on every realtime event.
    refreshTimerRef.current = window.setTimeout(() => {
      loadConversations({ silent: true });
    }, 600);
  };

  const loadConversations = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) setIsLoadingConversations(true);

    try {
      const list = await fetchConversations();
      setConversations(list);
      if (!selectedConversationId && list.length > 0) {
        setSelectedConversationId(list[0].id);
      }
    } catch {
      // UI already handles empty state; keep silent
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const list = await fetchMessages(conversationId);
      setMessages(list);
    } catch {
      // keep silent
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadLeadInfo = async (leadId: string | null) => {
    if (!leadId) {
      setSelectedLead(null);
      return;
    }

    try {
      const lead = await fetchLead(leadId);
      setSelectedLead(lead);
    } catch {
      setSelectedLead(null);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !selectedConversation) return;

    setIsSending(true);

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      content: content.trim(),
      direction: "outbound",
      media_type: null,
      media_url: null,
      created_at: new Date().toISOString(),
      ai_processed: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Você precisa estar logado para enviar mensagens");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        return;
      }

      const { data: zapiData, error: apiError } = await supabase.functions.invoke("zapi-send", {
        body: {
          action: "send-text",
          // Z-API expects the phone number (E.164/DDD+number). `whatsapp_id` is an internal id.
          phone: selectedConversation.phone,
          message: content,
        },
      });

      if (apiError) throw apiError;
      if ((zapiData as any)?.error) {
        throw new Error((zapiData as any).error);
      }

      const insertedMsg = await insertOutboundMessage(selectedConversation.id, content);

      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMessage.id ? insertedMsg : m))
      );

      if (selectedConversation.automation_enabled) {
        const now = await setHumanTakeover(selectedConversation.id);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, automation_enabled: false, human_takeover_at: now }
              : c
          )
        );
        toast.info("Modo humano ativado automaticamente");
      } else {
        await updateConversationLastMessageAt(selectedConversation.id, new Date().toISOString());
      }

      toast.success("Mensagem enviada!");
    } catch (error: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      toast.error("Erro ao enviar: " + (error.message || "Tente novamente"));
    } finally {
      setIsSending(false);
    }
  };

  const toggleAutomation = async () => {
    if (!selectedConversation) return;
    const newValue = !selectedConversation.automation_enabled;

    try {
      await setAutomation(selectedConversation.id, newValue);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                automation_enabled: newValue,
                human_takeover_at: newValue ? null : new Date().toISOString(),
              }
            : c
        )
      );

      toast.success(newValue ? "Automação IA ativada" : "Modo humano ativado");
    } catch (error: any) {
      toast.error("Erro ao alterar modo: " + (error.message || "Tente novamente"));
    }
  };

  // bootstrap
  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selection changes
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setSelectedLead(null);
      return;
    }

    loadConversationMessages(selectedConversationId);

    const conv = conversations.find((c) => c.id === selectedConversationId);
    if (conv) {
      loadLeadInfo(conv.lead_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  // realtime
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-realtime-v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const newMsg = payload.new as Message;

          // 1) Update message list instantly (selected conversation only)
          setMessages((prev) => {
            const exists = prev.some(
              (m) => m.id === newMsg.id || (m.id.startsWith("temp-") && m.content === newMsg.content)
            );

            if (exists) {
              return prev.map((m) =>
                m.id.startsWith("temp-") && m.content === newMsg.content ? newMsg : m
              );
            }

            if (newMsg.conversation_id === selectedConversationId) {
              return [...prev, newMsg];
            }

            return prev;
          });

          // 2) Update conversation list locally (avoid heavy refresh on each event)
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === newMsg.conversation_id);
            if (idx === -1) {
              // New conversation for this user: do a debounced refresh
              scheduleConversationsRefresh();
              return prev;
            }

            const updated = {
              ...prev[idx],
              last_message_at: newMsg.created_at,
              last_message: newMsg.content ?? null,
            } as Conversation;

            const next = [...prev];
            next.splice(idx, 1);
            next.unshift(updated);
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));

          // keep the conversation preview updated when status/content changes
          setConversations((prev) =>
            prev.map((c) =>
              c.id === updatedMsg.conversation_id
                ? ({
                    ...c,
                    last_message_at: updatedMsg.created_at,
                    last_message: updatedMsg.content ?? c.last_message ?? null,
                  } as Conversation)
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const updatedConv = payload.new as any;
          setConversations((prev) =>
            prev.map((c) => (c.id === updatedConv.id ? { ...c, ...updatedConv } : c))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId]);

  return {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    showContactInfo,
    setShowContactInfo,
    selectedLead,
    selectedConversation,
    loadConversations,
    loadLeadInfo,
    sendMessage,
    toggleAutomation,
  };
}
