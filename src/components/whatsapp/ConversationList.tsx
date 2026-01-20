import { useState } from "react";
import {
  Search,
  MessageCircle,
  RefreshCw,
  Circle,
  Clock,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Conversation = {
  id: string;
  phone: string;
  whatsapp_id: string;
  lead_id: string | null;
  lead_name?: string;
  lead_avatar_url?: string | null;
  last_message_at: string | null;
  last_message?: string | null;
  is_active: boolean;
  unread_count?: number;
};

type ConversationListProps = {
  conversations: Conversation[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
};

export default function ConversationList({
  conversations,
  selectedId,
  isLoading,
  onSelect,
  onRefresh,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter((c) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      c.phone.toLowerCase().includes(searchLower) ||
      (c.lead_name && c.lead_name.toLowerCase().includes(searchLower))
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarUrl = (c: Conversation) => {
    if (c.lead_avatar_url) return c.lead_avatar_url;
    const seed = c.lead_name || c.phone;
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&radius=50`;
  };

  const formatTime = (date: string | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Ontem";
    } else if (diffDays < 7) {
      return d.toLocaleDateString("pt-BR", { weekday: "short" });
    } else {
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Conversas</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/50"
          />
        </div>
      </div>

      {/* Lista */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 animate-pulse"
              >
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma conversa encontrada
                </p>
              </>
            ) : (
              <>
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma conversa ainda
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  As conversas aparecerão aqui
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full text-left p-3 transition-colors hover:bg-muted/50 flex items-center gap-3",
                  selectedId === c.id && "bg-muted"
                )}
              >
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={getAvatarUrl(c)} alt={c.lead_name || c.phone} loading="lazy" />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {c.lead_name ? getInitials(c.lead_name) : c.phone.slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  {c.is_active && (
                    <Circle className="absolute bottom-0 right-0 h-3 w-3 fill-success text-success" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">
                      {c.lead_name || c.phone}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      {c.last_message ? (
                        <>
                          <CheckCheck className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">{c.last_message}</span>
                        </>
                      ) : (
                        <span className="italic">Sem mensagens</span>
                      )}
                    </p>
                    {c.unread_count && c.unread_count > 0 && (
                      <Badge className="h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                        {c.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
