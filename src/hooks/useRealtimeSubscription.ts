import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

type TableName = "whatsapp_conversations" | "whatsapp_messages" | "leads" | "properties" | "tasks" | "visits" | "interactions";

interface UseRealtimeSubscriptionOptions {
  table: TableName;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export function useRealtimeSubscription({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channelName = `realtime-${table}-${filter || "all"}-${Date.now()}`;
    
    const channel = supabase.channel(channelName);

    if (onInsert) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter,
        },
        (payload) => {
          onInsert(payload.new);
        }
      );
    }

    if (onUpdate) {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter,
        },
        (payload) => {
          onUpdate(payload.new);
        }
      );
    }

    if (onDelete) {
      channel.on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table,
          filter,
        },
        (payload) => {
          onDelete(payload.old);
        }
      );
    }

    channel.subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, filter, onInsert, onUpdate, onDelete]);

  return channelRef.current;
}
