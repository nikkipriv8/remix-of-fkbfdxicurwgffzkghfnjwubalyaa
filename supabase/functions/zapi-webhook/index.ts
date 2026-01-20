import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const webhookType = url.searchParams.get('type') || 'message';

    const payload = await req.json();
    console.log(`[Z-API Webhook] received type=${webhookType}`);

    // Process based on webhook type
    switch (webhookType) {
      case 'message':
        await handleIncomingMessage(payload);
        break;
      case 'message-status':
        await handleMessageStatus(payload);
        break;
      case 'presence':
        await handlePresence(payload);
        break;
      case 'connected':
      case 'disconnected':
        // noop (kept for future status tracking)
        break;
      default:
        // noop
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Z-API Webhook Error]', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleIncomingMessage(payload: any) {
  const { phone, chatName, isGroup, text, fromMe, messageId, timestamp, image, audio, video, document } = payload;
  
  if (!phone) {
    console.log('[Z-API] No phone in payload, skipping');
    return;
  }

  // Format phone number (remove @c.us or @g.us suffix)
  const cleanPhone = phone.replace(/@[cg]\.us$/, '');
  const whatsappId = phone;

  // Extract message content - Z-API sends text as { message: "..." }
  const messageContent = typeof text === 'object' ? text?.message : text;
  
  // Determine media type
  let mediaType: string | null = null;
  let mediaUrl: string | null = null;
  
  if (image) {
    mediaType = 'image';
    mediaUrl = image.imageUrl || image.url;
  } else if (audio) {
    mediaType = 'audio';
    mediaUrl = audio.audioUrl || audio.url;
  } else if (video) {
    mediaType = 'video';
    mediaUrl = video.videoUrl || video.url;
  } else if (document) {
    mediaType = 'document';
    mediaUrl = document.documentUrl || document.url;
  }

  // Minimal log only (no payload content)
  console.log(`[Z-API] message received from ${cleanPhone}`);

  // Find or create conversation
  let { data: conversation, error: convError } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('whatsapp_id', whatsappId)
    .single();

  if (convError && convError.code === 'PGRST116') {
    // Conversation doesn't exist, create it
    const { data: newConv, error: createError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        whatsapp_id: whatsappId,
        phone: cleanPhone,
        is_active: true,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('[Z-API] Error creating conversation:', createError);
      throw createError;
    }
    conversation = newConv;
    console.log('[Z-API] Created new conversation:', conversation.id);
  } else if (convError) {
    console.error('[Z-API] Error fetching conversation:', convError);
    throw convError;
  }

  // Store the message
  const { error: msgError } = await supabase
    .from('whatsapp_messages')
    .insert({
      conversation_id: conversation.id,
      message_id: messageId,
      content: messageContent || '',
      direction: fromMe ? 'outbound' : 'inbound',
      media_type: mediaType,
      media_url: mediaUrl,
      status: 'received',
    });

  if (msgError) {
    console.error('[Z-API] Error storing message:', msgError);
    throw msgError;
  }

  // Update last_message_at
  await supabase
    .from('whatsapp_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id);

  console.log('[Z-API] Message stored successfully');

  // Check if we should create/update a lead and trigger AI response
  if (!fromMe && !isGroup) {
    await findOrCreateLead(cleanPhone, chatName);
    
    // Only trigger AI agent if automation is enabled for this conversation
    if (conversation.automation_enabled !== false) {
      triggerAIAgent(conversation.id, messageContent || '', cleanPhone);
    } else {
      console.log('[Z-API] Automation disabled for this conversation, skipping AI agent');
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
