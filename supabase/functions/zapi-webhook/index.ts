import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, client-token",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireWebhookToken(req: Request) {
  // Z-API can send this token using different header casing/names depending on configuration.
  // Headers are case-insensitive, but we still try common variants + query param fallback.
  const url = new URL(req.url);

  const headerToken =
    req.headers.get("Client-Token") ||
    req.headers.get("client-token") ||
    req.headers.get("Client-token") ||
    req.headers.get("X-Client-Token") ||
    req.headers.get("x-client-token");

  const queryToken =
    url.searchParams.get("client-token") ||
    url.searchParams.get("client_token") ||
    url.searchParams.get("clientToken") ||
    url.searchParams.get("token");

  const provided = headerToken || queryToken;
  const expected = Deno.env.get("ZAPI_SECURITY_TOKEN");

  // If expected token is not configured, fail closed.
  if (!expected) {
    console.error("[Z-API Webhook] ZAPI_SECURITY_TOKEN is not configured");
    return false;
  }

  const ok = Boolean(provided && provided === expected);
  if (!ok) {
    console.warn(
      `[Z-API Webhook] Invalid token (provided=${provided ? "yes" : "no"}, header=${headerToken ? "yes" : "no"}, query=${queryToken ? "yes" : "no"})`
    );
  }

  return ok;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Webhook authentication (Z-API Client-Token)
  if (!requireWebhookToken(req)) {
    console.warn("[Z-API Webhook] Unauthorized request rejected");
    return jsonResponse(401, { error: "Unauthorized webhook request" });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const url = new URL(req.url);
    const webhookType = url.searchParams.get("type") || "message";

    const payload = await req.json();
    console.log(`[Z-API Webhook] received type=${webhookType}`);

    // Process based on webhook type
    switch (webhookType) {
      case "message":
        await handleIncomingMessage(payload);
        break;
      case "message-status":
        await handleMessageStatus(payload);
        break;
      case "presence":
        await handlePresence(payload);
        break;
      case "connected":
      case "disconnected":
        // noop (kept for future status tracking)
        break;
      default:
        // noop
    }

    return jsonResponse(200, { success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Z-API Webhook Error]", error);
    return jsonResponse(500, { error: errorMessage });
  }
});



function sanitizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // remove @c.us / @g.us etc
  const clean = raw.replace(/@[cg]\.us$/, "").replace(/\D/g, "");
  // BR numbers are usually 10-13 digits; keep generic 10-15
  if (!/^[0-9]{10,15}$/.test(clean)) return null;
  return clean;
}

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function sanitizeOptionalText(raw: unknown, maxLen: number): string | null {
  if (raw == null) return null;
  const str = typeof raw === "string" ? raw : String(raw);
  const trimmed = str.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function sanitizeHttpUrl(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const candidate = raw.trim();
  if (!candidate) return null;
  if (candidate.length > maxLen) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function handleIncomingMessage(payload: any) {
  const {
    phone,
    chatName,
    isGroup,
    text,
    fromMe,
    messageId,
    image,
    audio,
    video,
    document,
  } = payload;

  const cleanPhone = sanitizePhone(phone);
  if (!cleanPhone) {
    console.log("[Z-API] Invalid phone format, skipping");
    return;
  }

  const whatsappId = typeof phone === "string" ? phone : `${cleanPhone}@c.us`;

  // Extract message content - Z-API sends text as { message: "..." }
  const extractedText = typeof text === "object" ? text?.message : text;
  const messageContent = sanitizeText(extractedText, 4096);

  const safeChatName = sanitizeOptionalText(chatName, 255) || cleanPhone;
  const safeMessageId = sanitizeOptionalText(messageId, 128);

  // Determine media type
  let mediaType: string | null = null;
  let mediaUrl: string | null = null;

  if (image) {
    mediaType = "image";
    mediaUrl = sanitizeHttpUrl(image.imageUrl || image.url, 2048);
  } else if (audio) {
    mediaType = "audio";
    mediaUrl = sanitizeHttpUrl(audio.audioUrl || audio.url, 2048);
  } else if (video) {
    mediaType = "video";
    mediaUrl = sanitizeHttpUrl(video.videoUrl || video.url, 2048);
  } else if (document) {
    mediaType = "document";
    mediaUrl = sanitizeHttpUrl(document.documentUrl || document.url, 2048);
  }

  // Minimal log only
  console.log(`[Z-API] message received from ${cleanPhone}`);

  // Find or create conversation
  let { data: conversation, error: convError } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("whatsapp_id", whatsappId)
    .single();

  if (convError && convError.code === "PGRST116") {
    // Conversation doesn't exist, create it
    const { data: newConv, error: createError } = await supabase
      .from("whatsapp_conversations")
      .insert({
        whatsapp_id: whatsappId,
        phone: cleanPhone,
        is_active: true,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error("[Z-API] Error creating conversation:", createError);
      throw createError;
    }
    conversation = newConv;
    console.log("[Z-API] Created new conversation:", conversation.id);
  } else if (convError) {
    console.error("[Z-API] Error fetching conversation:", convError);
    throw convError;
  }

  // Store the message
  const direction = fromMe ? "outbound" : "inbound";
  const isInboundAudio = direction === "inbound" && mediaType === "audio" && Boolean(mediaUrl);

  const { data: insertedMsg, error: msgError } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversation.id,
      message_id: safeMessageId,
      content: messageContent,
      direction,
      media_type: mediaType,
      media_url: mediaUrl,
      status: "received",
      transcription_status: isInboundAudio ? "pending" : null,
    } as any)
    .select("id")
    .single();

  if (msgError) {
    console.error("[Z-API] Error storing message:", msgError);
    throw msgError;
  }

  // If this is an inbound audio message, transcribe it and store on the message row.
  // Then (best-effort) trigger the AI agent using the transcription as the user message.
  let transcriptionText: string | null = null;
  if (isInboundAudio && insertedMsg?.id) {
    try {
      const { data: tData, error: tErr } = await supabase.functions.invoke(
        "elevenlabs-transcribe",
        {
          body: {
            audioUrl: mediaUrl,
            languageCode: "por",
          },
        }
      );

      if (tErr) {
        console.warn("[Z-API] transcription invoke error", tErr);
        await supabase
          .from("whatsapp_messages")
          .update({
            transcription_status: "error",
            transcription_error: String((tErr as any)?.message || "transcription_failed").slice(0, 500),
          } as any)
          .eq("id", insertedMsg.id);
      } else {
        const t = typeof (tData as any)?.text === "string" ? (tData as any).text.trim() : "";
        transcriptionText = t || null;
        await supabase
          .from("whatsapp_messages")
          .update({
            transcription: transcriptionText,
            transcription_status: transcriptionText ? "done" : "error",
            transcription_error: transcriptionText ? null : "empty_transcription",
          } as any)
          .eq("id", insertedMsg.id);
      }
    } catch (e) {
      console.warn("[Z-API] transcription best-effort failed", e);
      await supabase
        .from("whatsapp_messages")
        .update({
          transcription_status: "error",
          transcription_error: "transcription_exception",
        } as any)
        .eq("id", insertedMsg.id);
    }
  }

  // Update last_message_at
  await supabase
    .from("whatsapp_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id);

  console.log("[Z-API] Message stored successfully");

  // Check if we should create/update a lead and trigger AI response
  if (!fromMe && !isGroup) {
    const lead = await findOrCreateLead(cleanPhone, safeChatName);

    // Ensure conversation is linked to the lead so the AI agent can schedule visits.
    const leadId = (lead as any)?.id as string | undefined;
    if (leadId) {
      try {
        const { error: linkErr } = await supabase
          .from("whatsapp_conversations")
          .update({ lead_id: leadId })
          .eq("id", conversation.id)
          .is("lead_id", null);

        if (linkErr) {
          console.warn("[Z-API] Could not link conversation to lead", linkErr);
        } else {
          console.log(`[Z-API] Linked conversation ${conversation.id} to lead ${leadId}`);
        }

        // Best-effort: keep lead.whatsapp_id populated (helps cross-linking)
        await supabase
          .from("leads")
          .update({ whatsapp_id: whatsappId })
          .eq("id", leadId)
          .or("whatsapp_id.is.null,whatsapp_id.eq.");
      } catch (e) {
        console.warn("[Z-API] Link lead/conversation best-effort failed", e);
      }
    }

    // Only trigger AI agent if automation is enabled for this conversation
    if (conversation.automation_enabled !== false) {
      const aiInput = transcriptionText || messageContent;
      if (aiInput) {
        triggerAIAgent(conversation.id, aiInput, cleanPhone);
      } else {
        console.log("[Z-API] No text/transcription available, skipping AI agent");
      }
    } else {
      console.log("[Z-API] Automation disabled for this conversation, skipping AI agent");
    }
  }
}


async function findOrCreateLead(phone: string, name: string) {
  // Use upsert to prevent duplicates - phone has unique constraint
  const { data: lead, error } = await supabase
    .from('leads')
    .upsert(
      {
        phone,
        name: name || phone,
        source: 'whatsapp',
        status: 'new',
        priority: 'medium',
      },
      {
        onConflict: 'phone',
        ignoreDuplicates: true, // Don't update existing leads
      }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[Z-API] Error upserting lead:', error);
    // If upsert fails, try to get existing lead
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();
    return existingLead;
  }

  if (lead) {
    console.log('[Z-API] Lead upserted:', lead.id);
    return lead;
  }

  // If upsert returned null (duplicate ignored), get existing
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  
  return existingLead;
}

async function handleMessageStatus(payload: any) {
  const { messageId, status } = payload;
  
  if (!messageId) return;

  // Update message status
  await supabase
    .from('whatsapp_messages')
    .update({ status })
    .eq('message_id', messageId);

  console.log(`[Z-API] Updated message ${messageId} status to ${status}`);
}

async function handlePresence(_payload: any) {
  // intentionally no-op (presence can be very noisy)
}

async function triggerAIAgent(conversationId: string, message: string, phone: string) {
  try {
    await supabase.functions.invoke("whatsapp-ai-agent", {
      body: {
        conversationId,
        message,
        phone,
      },
    });
  } catch (error) {
    console.error('[Z-API] Error triggering AI agent:', error);
  }
}
