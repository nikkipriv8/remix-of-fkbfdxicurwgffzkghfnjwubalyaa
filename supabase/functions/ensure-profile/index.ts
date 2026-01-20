// Lovable Cloud backend function: ensure-profile
// Ensures a logged-in user has a row in public.profiles and public.user_roles.
// Bootstrap rule: if there are zero admins, the first ensured user becomes admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1];

    if (!accessToken) {
      return json(401, { error: "Not authenticated" });
    }

    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await authed.auth.getUser(accessToken);
    if (userErr) {
      // Auth errors should not crash the app with 500
      return json(401, { error: userErr.message || "Not authenticated" });
    }
    const user = userRes?.user;
    if (!user) return json(401, { error: "Not authenticated" });


    const email = (user.email || "").toLowerCase();
    const fullName =
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.fullName ||
      user.email ||
      "Usuário";

    // Ensure profile
    const { data: existingProfile, error: profSelErr } = await service
      .from("profiles")
      .select("id,user_id,email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profSelErr) throw profSelErr;

    let profileId: string | null = existingProfile?.id || null;

    if (!existingProfile) {
      const { data: created, error: profInsErr } = await service
        .from("profiles")
        .insert({ user_id: user.id, email, full_name: fullName })
        .select("id")
        .single();
      if (profInsErr) throw profInsErr;
      profileId = created?.id || null;
    }

    // Ensure role
    const { data: roleRow, error: roleSelErr } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (roleSelErr) throw roleSelErr;

    if (!roleRow) {
      const { error: roleInsErr } = await service
        .from("user_roles")
        .insert({ user_id: user.id, role: "attendant" });
      if (roleInsErr) throw roleInsErr;
    }

    // Bootstrap: if there are no admins, make this user admin
    const { count: adminCount, error: adminCountErr } = await service
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (adminCountErr) throw adminCountErr;

    if ((adminCount || 0) === 0) {
      const { error: makeAdminErr } = await service
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", user.id);
      if (makeAdminErr) throw makeAdminErr;
    }

    // Return current role
    const { data: roleNow, error: roleNowErr } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (roleNowErr) throw roleNowErr;

    return json(200, {
      ok: true,
      user_id: user.id,
      profile_id: profileId,
      role: roleNow?.role || "attendant",
    });
  } catch (e: any) {
    console.error("ensure-profile error:", e);
    return json(500, { error: e?.message || "Internal error" });
  }
});
