import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type WhatsAppLayoutPrefs = {
  version: 1;
  leftSize: number; // percentage (0-100)
  rightSize: number; // percentage (0-100)
  updatedAt: number; // epoch ms
};

const STORAGE_KEY = "whatsapp.layout.v1";
const DB_KEY = "whatsapp_layout_v1";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const DEFAULT_PREFS: WhatsAppLayoutPrefs = {
  version: 1,
  leftSize: 28,
  rightSize: 28,
  updatedAt: Date.now(),
};

function safeParseLocal(raw: string | null): WhatsAppLayoutPrefs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    if (typeof parsed.leftSize !== "number" || typeof parsed.rightSize !== "number") return null;
    if (typeof parsed.updatedAt !== "number") return null;
    return {
      version: 1,
      leftSize: clamp(parsed.leftSize, 15, 60),
      rightSize: clamp(parsed.rightSize, 15, 60),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeLocal(prefs: WhatsAppLayoutPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function readLocal(): WhatsAppLayoutPrefs | null {
  try {
    return safeParseLocal(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function pickNewest(a: WhatsAppLayoutPrefs | null, b: WhatsAppLayoutPrefs | null): WhatsAppLayoutPrefs {
  if (!a && !b) return DEFAULT_PREFS;
  if (!a) return b as WhatsAppLayoutPrefs;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export function useWhatsappLayoutPrefs() {
  const [prefs, setPrefs] = useState<WhatsAppLayoutPrefs>(() => readLocal() ?? DEFAULT_PREFS);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const remoteSaveTimer = useRef<number | null>(null);

  const saveRemoteDebounced = useCallback(async (next: WhatsAppLayoutPrefs) => {
    if (remoteSaveTimer.current) window.clearTimeout(remoteSaveTimer.current);

    remoteSaveTimer.current = window.setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;

        await supabase
          .from("user_ui_preferences")
          .upsert({ user_id: userId, key: DB_KEY, value: next } as any, { onConflict: "user_id,key" });
      } catch {
        // best-effort
      }
    }, 500);
  }, []);

  // bootstrap remote
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;

        const { data: row } = await supabase
          .from("user_ui_preferences")
          .select("value")
          .eq("user_id", userId)
          .eq("key", DB_KEY)
          .maybeSingle();

        const remote = safeParseLocal(row?.value ? JSON.stringify(row.value) : null);
        const local = readLocal();
        const merged = pickNewest(local, remote);

        if (!cancelled) {
          setPrefs(merged);
          writeLocal(merged);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSizes = useCallback(
    (next: Partial<Pick<WhatsAppLayoutPrefs, "leftSize" | "rightSize">>) => {
      setPrefs((prev) => {
        const merged: WhatsAppLayoutPrefs = {
          ...prev,
          ...next,
          leftSize: clamp(next.leftSize ?? prev.leftSize, 15, 60),
          rightSize: clamp(next.rightSize ?? prev.rightSize, 15, 60),
          updatedAt: Date.now(),
        };
        writeLocal(merged);
        saveRemoteDebounced(merged);
        return merged;
      });
    },
    [saveRemoteDebounced]
  );

  const reset = useCallback(async () => {
    const next = { ...DEFAULT_PREFS, updatedAt: Date.now() };
    setPrefs(next);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      await supabase.from("user_ui_preferences").delete().eq("user_id", userId).eq("key", DB_KEY);
    } catch {
      // best-effort
    }
  }, []);

  const api = useMemo(
    () => ({
      prefs,
      updateSizes,
      reset,
    }),
    [prefs, reset, updateSizes]
  );

  return api;
}
