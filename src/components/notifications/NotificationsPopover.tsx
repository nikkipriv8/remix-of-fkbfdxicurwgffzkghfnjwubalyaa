import { Bell, CalendarDays, MessageSquare, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useWhatsappUnreadTotal } from "@/features/whatsapp/hooks/useWhatsappUnreadTotal";
import { useTodayVisitsCount } from "@/features/notifications/hooks/useTodayVisitsCount";

export default function NotificationsPopover() {
  const navigate = useNavigate();
  const { total: whatsappUnread, refresh: refreshUnread } = useWhatsappUnreadTotal();
  const { count: todayVisits, refresh: refreshVisits } = useTodayVisitsCount();
  const [open, setOpen] = useState(false);

  const hasBadge = whatsappUnread > 0;

  const title = useMemo(() => {
    if (whatsappUnread > 0) return `Você tem ${whatsappUnread} mensagens não lidas`;
    return "Sem notificações";
  }, [whatsappUnread]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl hover:bg-secondary"
          aria-label="Notificações"
          title={title}
        >
          <Bell className="h-4 w-4" />
          {hasBadge && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-accent text-[10px] font-bold text-accent-foreground flex items-center justify-center shadow-lg">
              {whatsappUnread > 99 ? "99+" : whatsappUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Notificações</p>
              <p className="text-xs text-muted-foreground">Painel rápido</p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                refreshUnread();
                refreshVisits();
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        <div className="p-2">
          <button
            className="w-full rounded-md px-3 py-2 text-left hover:bg-accent transition-colors"
            onClick={() => {
              setOpen(false);
              navigate("/whatsapp");
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  {whatsappUnread > 0
                    ? `${whatsappUnread} não lidas`
                    : "Nenhuma mensagem não lida"}
                </p>
              </div>
              {whatsappUnread > 0 && (
                <span className="h-6 min-w-6 px-2 rounded-full bg-accent text-xs font-semibold text-accent-foreground flex items-center justify-center">
                  {whatsappUnread > 99 ? "99+" : whatsappUnread}
                </span>
              )}
            </div>
          </button>

          <button
            className="w-full rounded-md px-3 py-2 text-left hover:bg-accent transition-colors"
            onClick={() => {
              setOpen(false);
              navigate("/visits");
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Visitas</p>
                <p className="text-xs text-muted-foreground">
                  {todayVisits > 0 ? `${todayVisits} hoje` : "Nenhuma visita hoje"}
                </p>
              </div>
              {todayVisits > 0 && (
                <span className="h-6 min-w-6 px-2 rounded-full bg-secondary text-xs font-semibold text-foreground flex items-center justify-center">
                  {todayVisits > 99 ? "99+" : todayVisits}
                </span>
              )}
            </div>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
