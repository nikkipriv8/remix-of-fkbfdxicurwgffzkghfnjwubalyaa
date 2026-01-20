import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("[assign-lead-broker] missing bearer token");
      return json(401, { error: "Unauthorized" });
    }

    // Validate the caller token explicitly (verify_jwt=false)
    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "");
    // For Lovable Cloud (verify_jwt=false), JWT must be verified explicitly by passing token.
    const {
      data: { user },
      error: userErr,
    } = await authed.auth.getUser(token);

    const callerUserId = user?.id;
    if (userErr || !callerUserId) {
      console.warn("[assign-lead-broker] invalid token", userErr);
      return json(401, { error: "Unauthorized" });
    }

    // Only staff can claim leads
    const { data: roleRow } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .in("role", ["admin", "broker", "attendant"])
      .maybeSingle();
    if (!roleRow) return json(403, { error: "Forbidden" });

    const body = await req.json().catch(() => ({}));
    const leadId = String((body as any)?.leadId ?? "");
    if (!uuidRe.test(leadId)) return json(400, { error: "Invalid leadId" });

    const { data: profileRow, error: profileErr } = await service
      .from("profiles")
      .select("id")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (profileErr || !profileRow?.id) return json(400, { error: "Profile not found" });

    // Claim only if unassigned
    const { error: updateErr } = await service
      .from("leads")
      .update({ broker_id: profileRow.id })
      .eq("id", leadId)
      .is("broker_id", null);

    if (updateErr) {
      console.error("[assign-lead-broker] update error", updateErr);
      return json(500, { error: "Failed to assign lead" });
    }

    return json(200, { ok: true });
  } catch (e) {
    console.error("[assign-lead-broker] error", e);
    return json(500, { error: "Server error" });
  }
});
