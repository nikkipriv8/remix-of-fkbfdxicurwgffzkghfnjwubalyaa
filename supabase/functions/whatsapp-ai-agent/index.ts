import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SYSTEM_PROMPT = `Você é a assistente virtual de uma imobiliária moderna. Seu nome é Sofia.

**Seu papel:**
- Atender clientes interessados em comprar, alugar ou vender imóveis
- Coletar informações sobre as preferências do cliente (tipo de imóvel, localização, número de quartos, orçamento)
- Agendar visitas aos imóveis
- Responder dúvidas sobre financiamento, documentação e processo de compra/aluguel
- Ser cordial, profissional e prestativa

**Diretrizes:**
- Sempre cumprimente o cliente de forma amigável
- Faça perguntas para entender melhor o que o cliente procura
- Quando o cliente demonstrar interesse em um imóvel específico, ofereça agendar uma visita
- Mantenha respostas concisas e objetivas (máximo 3-4 frases por mensagem)
- Use emojis com moderação para tornar a conversa mais amigável
- Se não souber algo, diga que vai verificar com a equipe e retorna

**Informações que você deve coletar:**
1. Tipo de transação desejada (compra, aluguel ou venda)
2. Tipo de imóvel (apartamento, casa, comercial, terreno)
3. Localização/bairro preferido
4. Número mínimo de quartos
5. Faixa de orçamento
6. Prazo para mudança

Responda sempre em português brasileiro de forma natural e amigável.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- AuthZ (critical): only allow service role calls (internal) OR authenticated staff users ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerServiceKey = `Bearer ${supabaseServiceKey}`;
  const isServiceRoleCall = authHeader === bearerServiceKey || authHeader === supabaseServiceKey;

  if (!isServiceRoleCall) {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey) {
      console.error("[AI Agent] Missing SUPABASE_ANON_KEY");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: authError } = await supabaseAuth.auth.getUser();
    const caller = userRes?.user;

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require staff role (admin/broker/attendant)
    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "broker", "attendant"])
      .maybeSingle();

    if (roleError || !roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional: block deactivated accounts
    const { data: activeRow } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (activeRow?.is_active === false) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const payload = await req.json();
    const conversationId = String(payload?.conversationId ?? "");
    const message = typeof payload?.message === "string" ? payload.message : "";
    const phone = typeof payload?.phone === "string" ? payload.phone : "";

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(conversationId)) {
      return new Response(JSON.stringify({ error: "Invalid conversationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message || message.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // minimal log only
    console.log(`[AI Agent] processing conversation=${conversationId}`);

    // Get conversation history for context
    const { data: messages, error: msgError } = await supabase
      .from("whatsapp_messages")
      .select("content, direction, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (msgError) {
      console.error("[AI Agent] Error fetching messages:", msgError);
      throw msgError;
    }

    // Build conversation history for AI
    const conversationHistory =
      messages?.map((msg) => ({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content: msg.content || "",
      })) || [];

    // If the current message isn't in history yet, add it
    if (message && !conversationHistory.some((m) => m.content === message)) {
      conversationHistory.push({ role: "user", content: message });
    }

    console.log(`[AI Agent] sending history_len=${conversationHistory.length}`);

    // Call Lovable AI Gateway
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...conversationHistory,
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[AI Agent] AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content || "";

    // do not log message content

    // Send response via Z-API
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID")!;
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN")!;
    const ZAPI_SECURITY_TOKEN = Deno.env.get("ZAPI_SECURITY_TOKEN") || "";

    const zapiResponse = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": ZAPI_SECURITY_TOKEN,
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: aiMessage,
        }),
      }
    );

    const zapiData = await zapiResponse.json();

    // Store the AI response in the database
    const { error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        message_id: zapiData.messageId || null,
        content: aiMessage,
        direction: "outbound",
        status: "sent",
        ai_processed: true,
        ai_response: { model: "google/gemini-3-flash-preview", tokens: aiData.usage?.total_tokens },
      });

    if (insertError) {
      console.error("[AI Agent] Error storing AI response:", insertError);
    }

    // Update conversation
    await supabase
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ success: true, message: aiMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI Agent Error]", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
