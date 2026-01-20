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

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

async function pickActiveStaffProfileId(): Promise<string | null> {
  // Prefer brokers; fallback to admins.
  const rolePriority: Array<"broker" | "admin"> = ["broker", "admin"];

  for (const role of rolePriority) {
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", role)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (roleErr) {
      console.warn("[AI Agent] pickActiveStaffProfileId role query error", roleErr);
      continue;
    }

    const userId = (roleRow as any)?.user_id as string | undefined;
    if (!userId) continue;

    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (profileErr) {
      console.warn("[AI Agent] pickActiveStaffProfileId profile query error", profileErr);
      continue;
    }

    const profileId = (profileRow as any)?.id as string | undefined;
    if (profileId) return profileId;
  }

  return null;
}

async function getOrAssignBrokerId(leadId: string): Promise<string | null> {
  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select("broker_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) {
    console.warn("[AI Agent] getOrAssignBrokerId lead query error", leadErr);
    return null;
  }

  const existing = (leadRow as any)?.broker_id as string | null | undefined;
  if (existing) return existing;

  const picked = await pickActiveStaffProfileId();
  if (!picked) return null;

  const { error: updErr } = await supabase
    .from("leads")
    .update({ broker_id: picked })
    .eq("id", leadId)
    .is("broker_id", null);

  if (updErr) {
    console.warn("[AI Agent] getOrAssignBrokerId update error", updErr);
    return null;
  }

  return picked;
}

async function resolvePropertyId(args: any): Promise<string | null> {
  const rawId = String(args?.property_id || "").trim();
  if (rawId && uuidRe.test(rawId)) {
    const { data, error } = await supabase
      .from("properties")
      .select("id")
      .eq("id", rawId)
      .eq("status", "available")
      .maybeSingle();

    if (error) {
      console.warn("[AI Agent] resolvePropertyId by id error", error);
      return null;
    }
    return (data as any)?.id ?? null;
  }

  const code = String(args?.property_code || "").trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("code", code)
    .eq("status", "available")
    .maybeSingle();

  if (error) {
    console.warn("[AI Agent] resolvePropertyId by code error", error);
    return null;
  }

  return (data as any)?.id ?? null;
}

function escapeIlike(input: string) {
  // Escape % and _ which are wildcards in LIKE/ILIKE
  return input.replace(/[%_]/g, (m) => `\\${m}`);
}

type PropertyCandidate = {
  id: string;
  code: string;
  title: string;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
};

async function resolvePropertyByAddress(addressQueryRaw: string): Promise<{
  id: string | null;
  candidates?: PropertyCandidate[];
}> {
  const q = addressQueryRaw.trim();
  if (!q) return { id: null };

  // Keep query short to avoid abuse and overly broad matches
  const safe = escapeIlike(q.slice(0, 120));
  const pattern = `%${safe}%`;

  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, code, title, address_street, address_number, address_neighborhood, address_city, address_state"
    )
    .eq("status", "available")
    .or(
      [
        `address_street.ilike.${pattern}`,
        `address_neighborhood.ilike.${pattern}`,
        `address_city.ilike.${pattern}`,
        `title.ilike.${pattern}`,
        `code.ilike.${pattern}`,
      ].join(",")
    )
    .limit(3);

  if (error) {
    console.warn("[AI Agent] resolvePropertyIdByAddress error", error);
    return { id: null };
  }

  const rows = (data || []) as PropertyCandidate[];
  if (rows.length === 1) return { id: rows[0]?.id ?? null };

  // Multiple or none: ambiguous
  if (rows.length > 1) return { id: null, candidates: rows };
  return { id: null };
}

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

    if (!uuidRe.test(conversationId)) {
      return json(400, { error: "Invalid conversationId" });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return json(400, { error: "Invalid phone" });
    }

    if (!message || message.length > 2000) {
      return json(400, { error: "Invalid message" });
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

    // Fetch available properties to ground responses
    const { data: props, error: propError } = await supabase
      .from("properties")
      .select(
        "id, title, description, code, address_city, address_neighborhood, address_state, address_street, address_number, address_zipcode, bedrooms, bathrooms, parking_spots, area_total, rent_price, sale_price, condominium_fee, cover_image_url, images"
      )
      .eq("status", "available")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);

    if (propError) {
      console.error("[AI Agent] Error fetching properties:", propError);
    }

    const propertyContext = (props || [])
      .map((p: any) => {
        const addr = `${p.address_street || ""} ${p.address_number || ""}, ${p.address_neighborhood || ""} - ${p.address_city || ""}/${p.address_state || ""}, CEP ${p.address_zipcode || ""}`
          .replace(/\s+/g, " ")
          .trim();
        const images = Array.isArray(p.images) ? p.images : [];
        const extraImages = images.filter(Boolean).slice(0, 5);

        return [
          `ID: ${p.id}`,
          `Título: ${p.title}`,
          `Código: ${p.code}`,
          `Endereço: ${addr}`,
          `Quartos: ${p.bedrooms} | Banheiros: ${p.bathrooms} | Vagas: ${p.parking_spots ?? 0}`,
          `Área total: ${p.area_total} m²`,
          `Aluguel: ${p.rent_price} | Venda: ${p.sale_price} | Condomínio: ${p.condominium_fee ?? 0}`,
          `Descrição: ${p.description || ""}`,
          `Capa: ${p.cover_image_url || ""}`,
          `Fotos: ${extraImages.join(", ")}`,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    const propertySystemContext =
      props && props.length
        ? `Você tem acesso ao banco de dados de imóveis.
A consulta foi feita em: supabase.from("properties").select(...).eq("status","available").
Abaixo estão até 5 imóveis disponíveis (dados reais). Use APENAS estes dados para apresentar ao cliente, de forma bonita e completa (incluindo cidade, bairro, UF, endereço, CEP, quartos, banheiros, vagas, área m², preço aluguel, preço venda, condomínio, título, descrição e URLs de fotos/capa). Se o cliente pedir algo que não está aqui, peça os filtros (cidade/bairro/orçamento/quartos) e diga que o consultor complementa.
\n\n${propertyContext}`
        : `Não há imóveis disponíveis retornados do banco de dados agora. Se o cliente pedir imóveis, peça cidade/bairro/orçamento/quartos e informe que o consultor irá ajudar.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "schedule_visit",
          description:
            "Cria um rascunho de visita (status scheduled) para um lead e imóvel. Use SOMENTE quando o cliente informar data, hora e fuso horário.",
          parameters: {
            type: "object",
            properties: {
              property_id: {
                type: "string",
                description: "UUID do imóvel (ID: ... do contexto de imóveis)",
              },
              property_code: {
                type: "string",
                description: "Código do imóvel (Código: ... do contexto de imóveis)",
              },
              property_address: {
                type: "string",
                description:
                  "Endereço do imóvel (rua, número, bairro e cidade). Use quando o cliente não souber o código.",
              },
              scheduled_at_iso: {
                type: "string",
                description:
                  "Data/hora em ISO-8601 com offset (ex: 2026-01-20T14:00:00-03:00).",
              },
              timezone: {
                type: "string",
                description:
                  "Fuso horário do cliente (ex: 'Horário de Brasília' / 'America/Sao_Paulo'). Se não for informado, assuma Horário de Brasília.",
              },
              notes: {
                type: "string",
                description: "Observações opcionais do cliente (ex: 'prefere tarde').",
              },
            },
            required: ["scheduled_at_iso"],
          },
        },
      },
    ];

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
          { role: "system", content: propertySystemContext },
          ...conversationHistory,
        ],
        tools,
        tool_choice: "auto",
        max_tokens: 800,
        temperature: 0.4,
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
    const choiceMessage = aiData.choices?.[0]?.message || {};
    let aiMessage = choiceMessage?.content || "";

    const toolCalls = Array.isArray(choiceMessage?.tool_calls) ? choiceMessage.tool_calls : [];

    if (toolCalls.length) {
      const scheduleCall = toolCalls.find((tc: any) => tc?.function?.name === "schedule_visit");
      if (scheduleCall) {
        let args: any = {};
        try {
          args = JSON.parse(scheduleCall.function.arguments || "{}");
        } catch {
          args = {};
        }

        console.log(
          `[AI Agent] schedule_visit called (conversation=${conversationId}) args_keys=${Object.keys(args || {}).join(",")}`
        );

        // Fetch conversation + lead
        const { data: convRow } = await supabase
          .from("whatsapp_conversations")
          .select("lead_id")
          .eq("id", conversationId)
          .maybeSingle();

        const leadId = (convRow as any)?.lead_id as string | null;
        if (!leadId) {
          aiMessage =
            "Consigo sim! Antes, preciso vincular este WhatsApp a um lead aqui no sistema. Um corretor vai assumir a conversa e eu já registro a visita.";
        } else {
          console.log(`[AI Agent] schedule_visit lead_id=${leadId}`);

          const brokerId = await getOrAssignBrokerId(leadId);
          if (!brokerId) {
            aiMessage =
              "Perfeito! Vou pedir para um corretor confirmar o agendamento com você por aqui e já registrar a visita no sistema.";
          } else {
            const scheduledIso = String(args?.scheduled_at_iso || "");
            const scheduledAt = new Date(scheduledIso);
            if (!scheduledIso || Number.isNaN(scheduledAt.getTime())) {
              aiMessage =
                "Para eu registrar a visita, me confirme a data e a hora em um formato claro (ex: 20/01 às 14:00) e o fuso horário.";
            } else {
              const now = Date.now();
              if (scheduledAt.getTime() < now - 5 * 60 * 1000) {
                aiMessage =
                  "Esse horário parece estar no passado 😅 Pode me sugerir uma nova data e hora (ex: amanhã às 14:00)?";
              } else {
                // Resolve property_id (prefer DB lookup; do not rely only on the 5-context list)
                let propertyId = await resolvePropertyId(args);

                // If not found by id/code, try address search (best-effort)
                if (!propertyId) {
                  const addr = typeof args?.property_address === "string" ? args.property_address : "";
                  if (addr.trim()) {
                    const resolved = await resolvePropertyByAddress(addr);
                    propertyId = resolved.id;

                    if (!propertyId && resolved.candidates?.length) {
                      const list = resolved.candidates
                        .slice(0, 3)
                        .map((c, idx) => {
                          const addrLine = `${c.address_street || ""} ${c.address_number || ""}, ${c.address_neighborhood} - ${c.address_city}/${c.address_state}`
                            .replace(/\s+/g, " ")
                            .trim();
                          return `${idx + 1}) ${c.title} (código ${c.code}) — ${addrLine}`;
                        })
                        .join("\n");

                      aiMessage =
                        `Encontrei mais de um imóvel com esse endereço/descrição. Qual deles é o certo?\n\n${list}\n\nResponda com o *número* (1, 2, 3) ou com o *código* do imóvel.`;
                      // Do not proceed to insert until user disambiguates
                      propertyId = null;
                    }
                  }
                }

                if (!propertyId) {
                  // If we already asked for disambiguation above, keep that message.
                  if (!aiMessage) {
                    aiMessage =
                      "Consigo agendar sim — mas preciso identificar o imóvel certinho. Pode me enviar o *endereço completo* (rua, número, bairro e cidade)? Se souber, mande também o *código do imóvel*.";
                  }
                } else {
                const notes = typeof args?.notes === "string" ? args.notes.trim() : "";
                const tz = String(args?.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;

                const { error: visitErr } = await supabase.from("visits").insert({
                  lead_id: leadId,
                  property_id: propertyId,
                  broker_id: brokerId,
                  scheduled_at: scheduledAt.toISOString(),
                  status: "scheduled",
                  notes: [
                    "Rascunho criado pela IA (WhatsApp)",
                    `Fuso: ${tz}`,
                    notes ? `Obs: ${notes}` : null,
                  ]
                    .filter(Boolean)
                    .join(" | "),
                } as any);

                if (visitErr) {
                  console.error("[AI Agent] schedule_visit insert error", visitErr);
                  aiMessage =
                    "Tive um problema ao registrar a visita agora. Um corretor vai te atender por aqui e confirmar o agendamento.";
                } else {
                  console.log(
                    `[AI Agent] schedule_visit inserted lead=${leadId} broker=${brokerId} property=${propertyId} at=${scheduledAt.toISOString()}`
                  );
                  // Fetch property details for a clear confirmation question
                  const { data: propRow } = await supabase
                    .from("properties")
                    .select(
                      "code, title, address_street, address_number, address_neighborhood, address_city, address_state"
                    )
                    .eq("id", propertyId)
                    .maybeSingle();

                  const p: any = propRow || {};
                  const pAddr = `${p.address_street || ""} ${p.address_number || ""}, ${p.address_neighborhood || ""} - ${p.address_city || ""}/${p.address_state || ""}`
                    .replace(/\s+/g, " ")
                    .trim();

                  aiMessage =
                    `Agendamento registrado como *rascunho* ✅\n\nImóvel: ${p.title || "(sem título)"} (código ${p.code || "-"})\nEndereço: ${pAddr || "-"}\nData/hora: ${scheduledIso}\n\nVocê confirma esse agendamento? Responda *SIM* para confirmar ou *NÃO* para remarcar.`;
                }
                }
              }
            }
          }
        }
      }
    }

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
        ai_response: {
          model: "google/gemini-3-flash-preview",
          tokens: aiData.usage?.total_tokens,
          tool_calls: toolCalls?.length ? toolCalls : undefined,
        },
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
