import { useRef, useEffect, useMemo, useState } from "react";
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  MoreVertical,
  Search,
  Sparkles,
  User,
  Bot,
  CheckCheck,
  Image,
  FileText,
  Clock,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ensureAudioEnabled } from "@/lib/notificationSound";

type Message = {
  id: string;
  conversation_id: string;
  content: string | null;
  direction: string;
  media_type: string | null;
  media_url: string | null;
  created_at: string;
  ai_processed: boolean;
  status?: string;
};

type ChatAreaProps = {
  messages: Message[];
  isLoading: boolean;
  contactName: string;
  contactPhone: string;
  avatarUrl?: string | null;
  isActive: boolean;
  automationEnabled: boolean;
  onToggleAutomation: () => void;
  onSendMessage: (message: string) => void;
  onSendImage?: (imageUrl: string) => void;
  onOpenContactInfo: () => void;
  isSending: boolean;
};

// Wrapper to avoid hook-order issues during hot reloads by remounting the inner component.
export default function ChatArea(props: ChatAreaProps) {
  return <ChatAreaInner {...props} />;
}

function ChatAreaInner({
  messages,
  isLoading,
  contactName,
  contactPhone,
  avatarUrl,
  isActive,
  automationEnabled,
  onToggleAutomation,
  onSendMessage,
  onOpenContactInfo,
  isSending,
}: ChatAreaProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadWhileUp, setUnreadWhileUp] = useState(0);
  const firstUnreadIdRef = useRef<string | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Enable audio on first user gesture (browser requirement)
  useEffect(() => {
    const onFirstGesture = () => {
      ensureAudioEnabled();
    };
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstGesture);
  }, []);

  useEffect(() => {
    // Grab the Radix viewport element once + attach scroll listener
    if (!scrollAreaRootRef.current) return;
    const vp = scrollAreaRootRef.current.querySelector(
      "div[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement | null;
    viewportRef.current = vp;
    if (!vp) return;

    const onScroll = () => handleScroll();
    vp.addEventListener("scroll", onScroll, { passive: true });
    // compute initial state
    handleScroll();
    return () => vp.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const threshold = 80;
    const distanceFromBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
    const atBottom = distanceFromBottom <= threshold;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setUnreadWhileUp(0);
      firstUnreadIdRef.current = null;
    }
  };

  // WhatsApp Web behavior: auto-scroll only if user is already at bottom
  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastId = last?.id ?? null;

    // Initial load or conversation switch
    if (!lastMessageIdRef.current) {
      lastMessageIdRef.current = lastId;
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }

    // No new messages
    if (lastId && lastId === lastMessageIdRef.current) return;
    lastMessageIdRef.current = lastId;

    if (isAtBottom) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
      setUnreadWhileUp(0);
      firstUnreadIdRef.current = null;
      return;
    }

    // User is reading history: do not jump, show indicator
    if (lastId) {
      setUnreadWhileUp((v) => {
        const next = v + 1;
        if (next === 1) firstUnreadIdRef.current = lastId;
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Reset scroll/unread when changing contact
  useEffect(() => {
    lastMessageIdRef.current = null;
    firstUnreadIdRef.current = null;
    setUnreadWhileUp(0);
    setIsAtBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactPhone]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarUrl = () => {
    if (avatarUrl) return avatarUrl;
    const seed = contactName || contactPhone;
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&radius=50`;
  };

  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd 'de' MMMM", { locale: ptBR });
  };

  const formatMessageTime = (date: Date) => {
    return format(date, "HH:mm");
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    return messages.reduce((acc, msg) => {
      const date = new Date(msg.created_at);
      const dateKey = format(date, "yyyy-MM-dd");
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(msg);
      return acc;
    }, {} as Record<string, Message[]>);
  }, [messages]);

  return (
    <div className="relative flex flex-col h-full bg-[hsl(var(--muted)/0.3)]">
      {/* Header do Chat */}
      <div className="bg-card border-b px-4 py-3 flex items-center justify-between">
        <button
          onClick={onOpenContactInfo}
          className="flex items-center gap-3 hover:bg-muted/50 -ml-2 pl-2 pr-4 py-1 rounded-lg transition-colors"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={getAvatarUrl()} alt={contactName || contactPhone} loading="lazy" />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className="font-medium text-sm">{contactName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {isActive ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-success inline-block" />
                  Online
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  Offline
                </>
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {/* Automation Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  onClick={onToggleAutomation}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all",
                    automationEnabled
                      ? "bg-primary/10 hover:bg-primary/20"
                      : "bg-accent/50 hover:bg-accent/70"
                  )}
                >
                  {automationEnabled ? (
                    <>
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-primary">IA</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 text-accent-foreground" />
                      <span className="text-xs font-medium text-accent-foreground">Humano</span>
                    </>
                  )}
                  <Switch
                    checked={automationEnabled}
                    onCheckedChange={onToggleAutomation}
                    className="scale-75 ml-1"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {automationEnabled
                  ? "Clique para ativar modo humano"
                  : "Clique para ativar Sofia IA"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Search className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Buscar mensagens</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenContactInfo}>
                <User className="h-4 w-4 mr-2" />
                Ver contato
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Search className="h-4 w-4 mr-2" />
                Buscar mensagens
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggleAutomation}>
                {automationEnabled ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Ativar modo humano
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Ativar Sofia IA
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Image className="h-4 w-4 mr-2" />
                Mídia e arquivos
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="h-4 w-4 mr-2" />
                Exportar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Área de Mensagens */}
      <ScrollArea ref={scrollAreaRootRef as any} className="flex-1 px-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Carregando mensagens...
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Envie uma mensagem para iniciar a conversa
              </p>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {Object.entries(groupedMessages).map(([dateKey, msgs]) => (
              <div key={dateKey}>
                {/* Date separator */}
                <div className="flex justify-center mb-4">
                  <span className="bg-muted/80 text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
                    {formatMessageDate(new Date(msgs[0].created_at))}
                  </span>
                </div>

                {/* Messages */}
                <div className="space-y-1">
                  {msgs.map((m, idx) => {
                    const isOutbound = m.direction === "outbound";
                    const isAI = m.ai_processed;
                    const showTail =
                      idx === 0 ||
                      msgs[idx - 1].direction !== m.direction;

                    const showNewDivider =
                      firstUnreadIdRef.current && m.id === firstUnreadIdRef.current;

                    return (
                      <div key={m.id}>
                        {showNewDivider && (
                          <div className="flex justify-center my-4">
                            <span className="bg-muted/80 text-muted-foreground text-[10px] px-3 py-1 rounded-full shadow-sm tracking-wide">
                              NOVAS MENSAGENS
                            </span>
                          </div>
                        )}

                        <div
                          className={cn(
                            "flex",
                            isOutbound ? "justify-end" : "justify-start"
                          )}
                        >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm relative",
                            isOutbound
                              ? isAI
                                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground"
                                : "bg-accent text-accent-foreground"
                              : "bg-card text-card-foreground",
                            showTail && isOutbound && "rounded-tr-sm",
                            showTail && !isOutbound && "rounded-tl-sm"
                          )}
                        >
                          {/* Sender label for outbound */}
                          {isOutbound && showTail && (
                            <div
                              className={cn(
                                "flex items-center gap-1 text-[10px] mb-1 font-medium",
                                isAI ? "text-primary-foreground/80" : "text-accent-foreground/80"
                              )}
                            >
                              {isAI ? (
                                <>
                                  <Sparkles className="h-3 w-3" />
                                  Sofia IA
                                </>
                              ) : (
                                <>
                                  <User className="h-3 w-3" />
                                  Você
                                </>
                              )}
                            </div>
                          )}

                          {/* Media */}
                          {m.media_url && (
                            <div className="mb-2">
                              {m.media_type === "image" ? (
                                <img
                                  src={m.media_url}
                                  alt="Imagem"
                                  loading="lazy"
                                  className="rounded-md max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                />
                              ) : m.media_type === "audio" ? (
                                <audio
                                  controls
                                  className="max-w-full"
                                  src={m.media_url}
                                />
                              ) : (
                                <a
                                  href={m.media_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                                >
                                  <FileText className="h-5 w-5" />
                                  <span className="text-xs underline">
                                    Abrir arquivo ({m.media_type})
                                  </span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Content */}
                          {m.content && (
                            <p className="whitespace-pre-wrap break-words">
                              {m.content}
                            </p>
                          )}

                          {/* Time and status */}
                          <div
                            className={cn(
                              "flex items-center justify-end gap-1 mt-1 -mb-0.5",
                              isOutbound
                                ? isAI
                                  ? "text-primary-foreground/60"
                                  : "text-accent-foreground/60"
                                : "text-muted-foreground"
                            )}
                          >
                            <span className="text-[10px]">
                              {formatMessageTime(new Date(m.created_at))}
                            </span>
                            {isOutbound && (
                              <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/80" />
                            )}
                          </div>
                        </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* New messages indicator (WhatsApp Web-like) */}
      {unreadWhileUp > 0 && (
        <div className="absolute bottom-20 right-6">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full shadow-md"
            onClick={() => {
              scrollToBottom("smooth");
              setUnreadWhileUp(0);
              firstUnreadIdRef.current = null;
            }}
          >
            {unreadWhileUp} nova{unreadWhileUp > 1 ? "s" : ""} mensagem
            {unreadWhileUp > 1 ? "s" : ""}
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-card border-t p-3">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Emojis</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Anexar arquivo</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Input
            placeholder="Digite uma mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            className="flex-1 h-10 bg-muted/50"
          />

          {message.trim() ? (
            <Button
              onClick={handleSend}
              disabled={isSending}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              <Send className={cn("h-5 w-5", isSending && "animate-pulse")} />
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                    <Mic className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gravar áudio</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}
