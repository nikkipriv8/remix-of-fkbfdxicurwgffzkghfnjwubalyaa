import { useEffect, useMemo, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ConversationList from "@/components/whatsapp/ConversationList";
import ChatArea from "@/components/whatsapp/ChatArea";
import ContactInfoPanel from "@/components/whatsapp/ContactInfoPanel";

type Conversation = {
  id: string;
  phone: string;
  whatsapp_id: string;
  lead_id: string | null;
  lead_name?: string;
  last_message_at: string | null;
  last_message?: string | null;
  is_active: boolean;
  unread_count?: number;
  automation_enabled: boolean;
  human_takeover_at: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  content: string | null;
  direction: string;
  media_type: string | null;
  media_url: string | null;
  created_at: string;
  ai_processed: boolean;
};

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  priority: string;
  source: string;
  notes: string | null;
  preferred_property_type: string | null;
  preferred_transaction: string | null;
  min_budget: number | null;
  max_budget: number | null;
  preferred_neighborhoods: string[] | null;
  created_at: string;
};

const WhatsAppPage = () => {
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

  const loadConversations = async () => {
    setIsLoadingConversations(true);
    try {
      // Load conversations with lead info
      const { data: convData, error: convError } = await supabase
        .from("whatsapp_conversations")
        .select("id, phone, whatsapp_id, lead_id, last_message_at, is_active, automation_enabled, human_takeover_at")
        .order("last_message_at", { ascending: false })
        .limit(100);

      if (convError) throw convError;

      // Get lead names
      const leadIds = convData?.filter((c) => c.lead_id).map((c) => c.lead_id) || [];
      let leadsMap: Record<string, string> = {};

      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, name")
          .in("id", leadIds);

        if (leadsData) {
          leadsMap = leadsData.reduce((acc, lead) => {
            acc[lead.id] = lead.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Get last message for each conversation
      const conversationsWithInfo = await Promise.all(
        (convData || []).map(async (conv) => {
          const { data: lastMsg } = await supabase
            .from("whatsapp_messages")
            .select("content")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...conv,
            lead_name: conv.lead_id ? leadsMap[conv.lead_id] : undefined,
            last_message: lastMsg?.content || null,
          };
        })
      );

      setConversations(conversationsWithInfo);
      if (!selectedConversationId && conversationsWithInfo.length > 0) {
        setSelectedConversationId(conversationsWithInfo[0].id);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select(
          "id, conversation_id, content, direction, media_type, media_url, created_at, ai_processed"
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error("Error loading messages:", error);
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
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();

      if (error) throw error;
      setSelectedLead(data as Lead | null);
    } catch (error) {
      console.error("Error loading lead:", error);
      setSelectedLead(null);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !selectedConversation) return;

    setIsSending(true);
    
    // Optimistic update - add message immediately to UI
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
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        return;
      }

      // Call zapi-send edge function
      const { error: apiError } = await supabase.functions.invoke("zapi-send", {
        body: {
          action: "send-text",
          phone: selectedConversation.whatsapp_id,
          message: content,
        },
      });

      if (apiError) throw apiError;

      // Store message in database
      const { data: insertedMsg, error: dbError } = await supabase
        .from("whatsapp_messages")
        .insert({
          conversation_id: selectedConversation.id,
          content: content,
          direction: "outbound",
          ai_processed: false,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Replace optimistic message with real one
      if (insertedMsg) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMessage.id ? (insertedMsg as Message) : m))
        );
      }

      // When human sends a message, disable automation automatically
      if (selectedConversation.automation_enabled) {
        await supabase
          .from("whatsapp_conversations")
          .update({ 
            last_message_at: new Date().toISOString(),
            automation_enabled: false,
            human_takeover_at: new Date().toISOString()
          })
          .eq("id", selectedConversation.id);
        
        // Update local state
        setConversations(prev => prev.map(c => 
          c.id === selectedConversation.id 
            ? { ...c, automation_enabled: false, human_takeover_at: new Date().toISOString() }
            : c
        ));
        
        toast.info("Modo humano ativado automaticamente");
      } else {
        // Update conversation last_message_at
        await supabase
          .from("whatsapp_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", selectedConversation.id);
      }

      toast.success("Mensagem enviada!");
    } catch (error: any) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
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
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ 
          automation_enabled: newValue,
          human_takeover_at: newValue ? null : new Date().toISOString()
        })
        .eq("id", selectedConversation.id);

      if (error) throw error;

      // Update local state
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation.id 
          ? { ...c, automation_enabled: newValue, human_takeover_at: newValue ? null : new Date().toISOString() }
          : c
      ));

      toast.success(newValue ? "Automação IA ativada" : "Modo humano ativado");
    } catch (error: any) {
      console.error("Error toggling automation:", error);
      toast.error("Erro ao alterar modo: " + (error.message || "Tente novamente"));
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setSelectedLead(null);
      return;
    }
    loadMessages(selectedConversationId);

    // Load lead info
    const conv = conversations.find((c) => c.id === selectedConversationId);
    if (conv) {
      loadLeadInfo(conv.lead_id);
    }
  }, [selectedConversationId]);

  // Realtime subscription - improved for instant updates
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-realtime-v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if not already in messages (avoid duplicates from optimistic update)
          setMessages((prev) => {
            const exists = prev.some(
              (m) => m.id === newMsg.id || (m.id.startsWith("temp-") && m.content === newMsg.content)
            );
            if (exists) {
              // Replace temp message with real one
              return prev.map((m) =>
                m.id.startsWith("temp-") && m.content === newMsg.content ? newMsg : m
              );
            }
            // Only add if it's for the selected conversation
            if (newMsg.conversation_id === selectedConversationId) {
              return [...prev, newMsg];
            }
            return prev;
          });
          // Refresh conversation list for last message preview
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const updatedConv = payload.new as any;
          // Update local conversation state instantly
          setConversations((prev) =>
            prev.map((c) =>
              c.id === updatedConv.id
                ? { ...c, ...updatedConv }
                : c
            )
          );
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId]);

  return (
    <div className="flex-1 flex flex-col h-screen">
      <Header title="WhatsApp" subtitle="Atendimento com IA integrada">
        <Badge variant="outline" className="gap-1.5 bg-primary/10 text-primary border-primary/20">
          <Sparkles className="h-3 w-3" />
          Sofia IA Ativa
        </Badge>
      </Header>

      <main className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div className="w-80 shrink-0 hidden md:block">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            isLoading={isLoadingConversations}
            onSelect={setSelectedConversationId}
            onRefresh={loadConversations}
          />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex">
          {!selectedConversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/30">
              <Bot className="h-20 w-20 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Selecione uma conversa
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Escolha uma conversa à esquerda para começar
              </p>
            </div>
          ) : (
            <div className="flex-1">
              <ChatArea
                messages={messages}
                isLoading={isLoadingMessages}
                contactName={selectedConversation?.lead_name || selectedConversation?.phone || ""}
                contactPhone={selectedConversation?.phone || ""}
                isActive={selectedConversation?.is_active || false}
                automationEnabled={selectedConversation?.automation_enabled ?? true}
                onToggleAutomation={toggleAutomation}
                onSendMessage={sendMessage}
                onOpenContactInfo={() => setShowContactInfo(true)}
                isSending={isSending}
              />
            </div>
          )}

          {/* Contact Info Panel */}
          {showContactInfo && selectedConversation && (
            <ContactInfoPanel
              lead={selectedLead}
              phone={selectedConversation.phone}
              whatsappId={selectedConversation.whatsapp_id}
              conversationId={selectedConversation.id}
              onClose={() => setShowContactInfo(false)}
              onLeadUpdated={() => {
                loadConversations();
                if (selectedConversation.lead_id) {
                  loadLeadInfo(selectedConversation.lead_id);
                }
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default WhatsAppPage;
