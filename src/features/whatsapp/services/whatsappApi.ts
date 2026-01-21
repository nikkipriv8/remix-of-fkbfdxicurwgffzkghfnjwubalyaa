import { supabase } from "@/integrations/supabase/client";
import type { Conversation, Lead, Message } from "@/features/whatsapp/types";

export async function fetchConversations() {
  const { data: convData, error: convError } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, phone, whatsapp_id, lead_id, last_message_at, is_active, automation_enabled, human_takeover_at"
    )
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (convError) throw convError;

  const leadIds = convData?.filter((c) => c.lead_id).map((c) => c.lead_id) || [];
  let leadsMap: Record<string, { name: string; avatar_url?: string | null }> = {};

  if (leadIds.length > 0) {
    const { data: leadsData } = await supabase
      .from("leads")
      .select("id, name, avatar_url")
      .in("id", leadIds);

    if (leadsData) {
      leadsMap = leadsData.reduce((acc, lead) => {
        acc[lead.id] = { name: lead.name, avatar_url: (lead as any).avatar_url ?? null };
        return acc;
      }, {} as Record<string, { name: string; avatar_url?: string | null }>);
    }
  }

  const conversationIds = (convData || []).map((c) => c.id);
  let unreadMap: Record<string, number> = {};

  if (conversationIds.length > 0) {
    const { data: unreadRows } = await supabase.rpc("get_unread_counts", {
      conversation_ids: conversationIds,
    });

    if (unreadRows) {
      unreadMap = (unreadRows as any[]).reduce((acc, row) => {
        acc[row.conversation_id] = row.unread_count;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  const conversationsWithInfo: Conversation[] = await Promise.all(
    (convData || []).map(async (conv) => {
      const { data: lastMsg } = await supabase
        .from("whatsapp_messages")
        .select("content")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const leadInfo = conv.lead_id ? leadsMap[conv.lead_id] : undefined;

      return {
        ...(conv as any),
        lead_name: leadInfo?.name,
        lead_avatar_url: leadInfo?.avatar_url ?? null,
        last_message: lastMsg?.content || null,
        unread_count: unreadMap[conv.id] ?? 0,
      } as Conversation;
    })
  );

  return conversationsWithInfo;
}

export async function fetchMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select(
      "id, conversation_id, content, direction, media_type, media_url, created_at, ai_processed, transcription, transcription_status, transcription_error"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  return (data as Message[]) || [];
}

export async function fetchLead(leadId: string) {
  const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error) throw error;
  return data as Lead | null;
}

export async function insertOutboundMessage(conversationId: string, content: string) {
  const { data: insertedMsg, error: dbError } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      content,
      direction: "outbound",
      ai_processed: false,
    })
    .select()
    .single();

  if (dbError) throw dbError;
  return insertedMsg as Message;
}

export async function updateConversationLastMessageAt(conversationId: string, iso: string) {
  await supabase
    .from("whatsapp_conversations")
    .update({ last_message_at: iso })
    .eq("id", conversationId);
}

export async function setAutomation(conversationId: string, automationEnabled: boolean) {
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({
      automation_enabled: automationEnabled,
      human_takeover_at: automationEnabled ? null : new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) throw error;
}

export async function setHumanTakeover(conversationId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({
      last_message_at: now,
      automation_enabled: false,
      human_takeover_at: now,
    })
    .eq("id", conversationId);

  if (error) throw error;
  return now;
}
