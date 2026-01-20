import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

function getTodayRangeIso() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function useTodayVisitsCount() {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { startIso, endIso } = getTodayRangeIso();

    setIsLoading(true);
    try {
      const { count, error } = await supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", startIso)
        .lt("scheduled_at", endIso)
        .in("status", ["scheduled", "confirmed"]);

      if (error) throw error;
      setCount(count ?? 0);
    } catch {
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep it in sync in realtime (best-effort)
  useRealtimeSubscription({
    table: "visits",
    onInsert: refresh,
    onUpdate: refresh,
    onDelete: refresh,
  });

  return useMemo(() => ({ count, isLoading, refresh }), [count, isLoading, refresh]);
}
