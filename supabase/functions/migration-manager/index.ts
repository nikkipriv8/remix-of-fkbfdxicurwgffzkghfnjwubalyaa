// Lovable Cloud backend function: migration-manager
// - Imports legacy JSON exports into staging tables
// - Builds ID maps based on email and applies roles
// - Migrates CRM entities with best-effort remapping

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EntityKey = "profiles" | "properties" | "leads" | "tasks" | "visits";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function requireAdmin(service: any, userId: string) {
  const { data, error } = await service.rpc("is_admin", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Error("Sem permissão (apenas administrador)");
}

function pickOldId(obj: any): string | null {
  return (
    obj?.old_id ||
    obj?.oldId ||
    obj?.old_profile_id ||
    obj?.oldProfileId ||
    obj?.id ||
    null
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";

    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userRes, error: userErr } = await authed.auth.getUser();
    if (userErr) throw userErr;
    if (!userRes?.user) return jsonResponse(401, { error: "Not authenticated" });

    await requireAdmin(service, userRes.user.id);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    if (action === "import") {
      const entity = body?.entity as EntityKey;
      const replace = Boolean(body?.replace);
      const items = body?.items as any[];

      if (!entity) return jsonResponse(400, { error: "Missing entity" });
      if (!Array.isArray(items)) return jsonResponse(400, { error: "items must be an array" });

      const tableByEntity: Record<EntityKey, string> = {
        profiles: "staging_profiles",
        properties: "staging_properties",
        leads: "staging_leads",
        tasks: "staging_tasks",
        visits: "staging_visits",
      };

      const table = tableByEntity[entity];

      if (replace) {
        // best-effort clear in chunks
        while (true) {
          const { data: rows, error } = await service.from(table).select("id").limit(1000);
          if (error) throw error;
          if (!rows || rows.length === 0) break;
          const ids = rows.map((r: any) => r.id);
          const { error: delErr } = await service.from(table).delete().in("id", ids);
          if (delErr) throw delErr;
        }
      }

      let payload: any[] = [];
      if (entity === "profiles") {
        payload = items.map((it) => {
          const email = String(it?.email || it?.user_email || "").trim().toLowerCase();
          return {
            old_profile_id: it?.old_profile_id || it?.oldProfileId || it?.id || null,
            email,
            full_name: it?.full_name || it?.fullName || it?.name || null,
            phone: it?.phone || it?.telefone || null,
            creci: it?.creci || null,
            role: it?.role || it?.cargo || null,
            raw: it,
          };
        });

        const invalid = payload.filter((p) => !p.email);
        if (invalid.length) {
          return jsonResponse(400, {
            error: `Perfis inválidos: ${invalid.length} sem email`,
          });
        }
      } else {
        const oldIdKeyByEntity: Record<EntityKey, string> = {
          profiles: "old_profile_id",
          properties: "old_property_id",
          leads: "old_lead_id",
          tasks: "old_task_id",
          visits: "old_visit_id",
        };
        const key = oldIdKeyByEntity[entity];

        payload = items.map((it) => ({
          [key]: pickOldId(it),
          raw: it,
        }));
      }

      for (const part of chunk(payload, 500)) {
        const { error } = await service.from(table).insert(part);
        if (error) throw error;
      }

      return jsonResponse(200, {
        message: `Importado ${items.length} registros em ${table}.`,
      });
    }

    if (action === "clear") {
      const tables = [
        "staging_profiles",
        "staging_properties",
        "staging_leads",
        "staging_tasks",
        "staging_visits",
        "profile_id_map",
        "property_id_map",
        "lead_id_map",
        "visit_id_map",
        "task_id_map",
      ];

      for (const table of tables) {
        while (true) {
          const { data: rows, error } = await service.from(table).select("id").limit(1000);
          if (error) throw error;
          if (!rows || rows.length === 0) break;
          const ids = rows.map((r: any) => r.id);
          const { error: delErr } = await service.from(table).delete().in("id", ids);
          if (delErr) throw delErr;
        }
      }

      return jsonResponse(200, { message: "Staging e mapas limpos." });
    }

    if (action === "run") {
      const summary: any = {
        missingUsersByEmail: [] as string[],
        rolesApplied: 0,
        profilesMapped: 0,
        inserted: { properties: 0, leads: 0, tasks: 0, visits: 0 },
        errors: [] as any[],
      };

      // 1) Build profile map by email
      const { data: stProfiles, error: stProfErr } = await service
        .from("staging_profiles")
        .select("old_profile_id,email,role");
      if (stProfErr) throw stProfErr;

      const uniqueEmails = Array.from(
        new Set((stProfiles || []).map((p: any) => String(p.email || "").toLowerCase()))
      ).filter(Boolean);

      const emailToProfile: Map<string, any> = new Map();
      for (const part of chunk(uniqueEmails, 200)) {
        const { data: profiles, error } = await service
          .from("profiles")
          .select("id,user_id,email")
          .in("email", part);
        if (error) throw error;
        for (const pr of profiles || []) {
          emailToProfile.set(String(pr.email).toLowerCase(), pr);
        }
      }

      const mapRows: any[] = [];
      const roleUpdates: { user_id: string; role: string }[] = [];

      for (const sp of stProfiles || []) {
        const email = String(sp.email || "").toLowerCase();
        const pr = emailToProfile.get(email);
        if (!pr) {
          summary.missingUsersByEmail.push(email);
          continue;
        }
        if (sp.old_profile_id) {
          mapRows.push({
            old_profile_id: sp.old_profile_id,
            email,
            new_profile_id: pr.id,
            new_user_id: pr.user_id,
          });
        }
        if (sp.role) {
          roleUpdates.push({ user_id: pr.user_id, role: sp.role });
        }
      }

      if (mapRows.length) {
        for (const part of chunk(mapRows, 500)) {
          const { error } = await service.from("profile_id_map").upsert(part);
          if (error) throw error;
          summary.profilesMapped += part.length;
        }
      }

      // Apply roles
      for (const part of chunk(roleUpdates, 200)) {
        // update one by one to keep it simple and reliable
        for (const ru of part) {
          const { error } = await service
            .from("user_roles")
            .update({ role: ru.role })
            .eq("user_id", ru.user_id);
          if (error) {
            summary.errors.push({ type: "role_update", user_id: ru.user_id, error: error.message });
          } else {
            summary.rolesApplied += 1;
          }
        }
      }

      // Load profile_id_map into memory for remap
      const { data: pmap, error: pmapErr } = await service
        .from("profile_id_map")
        .select("old_profile_id,new_profile_id");
      if (pmapErr) throw pmapErr;
      const oldProfileToNew = new Map<string, string>((pmap || []).map((r: any) => [r.old_profile_id, r.new_profile_id]));

      // Helpers for inserting and tracking maps
      const insertWithMap = async (
        entity: EntityKey,
        stagingTable: string,
        idField: string,
        mapTable: string,
        mapOld: string,
        mapNew: string,
        insertTable: string,
        transform: (raw: any) => any
      ) => {
        const { data: rows, error } = await (service.from(stagingTable) as any).select(
          `raw,${idField}`
        );
        if (error) throw error;

        for (const row of (rows || []) as any[]) {
          const rowAny = row as any;
          try {
            const oldId = rowAny?.[idField];
            const raw = rowAny?.raw || {};

            const record = transform(raw);
            // remove any incoming id to avoid collisions
            if (record && typeof record === "object") delete record.id;

            const { data: inserted, error: insErr } = await service
              .from(insertTable)
              .insert(record)
              .select("id")
              .single();
            if (insErr) throw insErr;

            summary.inserted[entity] += 1;

            if (oldId && inserted?.id) {
              const mapRow: any = { [mapOld]: oldId, [mapNew]: inserted.id };
              const { error: mapErr } = await service.from(mapTable).upsert(mapRow);
              if (mapErr) throw mapErr;
            }
          } catch (e: any) {
            summary.errors.push({
              type: `insert_${entity}`,
              old: rowAny?.[idField] || null,
              error: e?.message || String(e),
            });
          }
        }
      };

      // Build lead/property maps progressively by inserting
      // Properties
      await insertWithMap(
        "properties",
        "staging_properties",
        "old_property_id",
        "property_id_map",
        "old_property_id",
        "new_property_id",
        "properties",
        (raw) => {
          const brokerOld = raw?.broker_id;
          const brokerNew = brokerOld && oldProfileToNew.get(String(brokerOld)) ? oldProfileToNew.get(String(brokerOld)) : raw?.broker_id;

          return {
            ...raw,
            broker_id: brokerNew ?? null,
          };
        }
      );

      // Load property map
      const { data: propMapRows } = await service.from("property_id_map").select("old_property_id,new_property_id");
      const oldPropToNew = new Map<string, string>((propMapRows || []).map((r: any) => [r.old_property_id, r.new_property_id]));

      // Leads
      await insertWithMap(
        "leads",
        "staging_leads",
        "old_lead_id",
        "lead_id_map",
        "old_lead_id",
        "new_lead_id",
        "leads",
        (raw) => {
          const brokerOld = raw?.broker_id;
          const brokerNew = brokerOld && oldProfileToNew.get(String(brokerOld)) ? oldProfileToNew.get(String(brokerOld)) : raw?.broker_id;
          return { ...raw, broker_id: brokerNew ?? null };
        }
      );

      // Load lead map
      const { data: leadMapRows } = await service.from("lead_id_map").select("old_lead_id,new_lead_id");
      const oldLeadToNew = new Map<string, string>((leadMapRows || []).map((r: any) => [r.old_lead_id, r.new_lead_id]));

      // Tasks
      await insertWithMap(
        "tasks",
        "staging_tasks",
        "old_task_id",
        "task_id_map",
        "old_task_id",
        "new_task_id",
        "tasks",
        (raw) => {
          const userOld = raw?.user_id;
          const leadOld = raw?.lead_id;
          const propOld = raw?.property_id;

          const userNew = userOld && oldProfileToNew.get(String(userOld)) ? oldProfileToNew.get(String(userOld)) : raw?.user_id;
          const leadNew = leadOld && oldLeadToNew.get(String(leadOld)) ? oldLeadToNew.get(String(leadOld)) : raw?.lead_id;
          const propNew = propOld && oldPropToNew.get(String(propOld)) ? oldPropToNew.get(String(propOld)) : raw?.property_id;

          return { ...raw, user_id: userNew, lead_id: leadNew ?? null, property_id: propNew ?? null };
        }
      );

      // Visits
      await insertWithMap(
        "visits",
        "staging_visits",
        "old_visit_id",
        "visit_id_map",
        "old_visit_id",
        "new_visit_id",
        "visits",
        (raw) => {
          const brokerOld = raw?.broker_id;
          const leadOld = raw?.lead_id;
          const propOld = raw?.property_id;

          const brokerNew = brokerOld && oldProfileToNew.get(String(brokerOld)) ? oldProfileToNew.get(String(brokerOld)) : raw?.broker_id;
          const leadNew = leadOld && oldLeadToNew.get(String(leadOld)) ? oldLeadToNew.get(String(leadOld)) : raw?.lead_id;
          const propNew = propOld && oldPropToNew.get(String(propOld)) ? oldPropToNew.get(String(propOld)) : raw?.property_id;

          return { ...raw, broker_id: brokerNew, lead_id: leadNew, property_id: propNew };
        }
      );

      summary.message = summary.missingUsersByEmail.length
        ? `Migração executada com avisos: ${summary.missingUsersByEmail.length} emails não existem no sistema atual.`
        : "Migração executada com sucesso.";

      return jsonResponse(200, { summary });
    }

    return jsonResponse(400, { error: "Unknown action" });
  } catch (e: any) {
    console.error("migration-manager error:", e);
    return jsonResponse(500, { error: e?.message || "Internal error" });
  }
});
