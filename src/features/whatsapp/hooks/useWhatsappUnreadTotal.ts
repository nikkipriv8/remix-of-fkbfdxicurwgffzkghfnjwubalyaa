import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsappUnreadTotal() {
  const [total, setTotal] = useState(0);

  const refresh = async () => {
    const { data: conversations } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("is_active", true)
      .limit(500);

    const ids = (conversations || []).map((c: any) => c.id).filter(Boolean);
    if (ids.length === 0) {
      setTotal(0);
      return;
    }

    const { data: rows } = await supabase.rpc("get_unread_counts", {
      conversation_ids: ids,
    });

    const sum = (rows || []).reduce((acc: number, r: any) => acc + (r.unread_count || 0), 0);
    setTotal(sum);
  };

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel("unread_total")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          // Only count inbound messages; when user opens conversation, mark_read will reset via refresh
          const direction = (payload.new as any)?.direction;
          if (direction === "inbound") setTotal((t) => t + 1);
        }
      )
      .subscribe();

    // periodic sync (handles read resets and missed events)
    const interval = window.setInterval(refresh, 30000);

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(() => ({ total, refresh }), [total]);
}
