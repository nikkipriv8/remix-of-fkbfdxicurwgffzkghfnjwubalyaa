import { useState, useEffect, useCallback } from "react";
import { Calendar, Plus, MapPin, User, Clock, MoreVertical } from "lucide-react";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import VisitFormDialog from "@/components/visits/VisitFormDialog";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Visit = Tables<"visits"> & {
  leads?: { name: string; phone: string } | null;
  properties?: { title: string; code: string; address_neighborhood: string } | null;
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  rescheduled: "Reagendada",
  no_show: "Não Compareceu",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/20 text-primary",
  confirmed: "bg-success/20 text-success",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/20 text-destructive",
  rescheduled: "bg-warning/20 text-warning",
  no_show: "bg-destructive/20 text-destructive",
};

const Visits = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const loadVisits = useCallback(async () => {
    if (!profile?.id) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from("visits")
      .select(`
        *,
        leads (name, phone),
        properties (title, code, address_neighborhood)
      `)
      .order("scheduled_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar visitas", variant: "destructive" });
    } else {
      setVisits((data as Visit[]) || []);
    }
    setIsLoading(false);
  }, [profile?.id, toast]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  useRealtimeSubscription({
    table: "visits",
    onInsert: () => loadVisits(),
    onUpdate: () => loadVisits(),
    onDelete: (deleted) => setVisits((prev) => prev.filter((v) => v.id !== deleted.id)),
  });

  const handleEdit = (visit: Visit) => {
    setSelectedVisit(visit);
    setDialogOpen(true);
  };

  const handleDelete = async (visit: Visit) => {
    if (!confirm("Excluir esta visita?")) return;

    const { error } = await supabase.from("visits").delete().eq("id", visit.id);
    if (error) {
      toast({ title: "Erro ao excluir visita", variant: "destructive" });
    } else {
      toast({ title: "Visita excluída" });
    }
  };

  const updateStatus = async (visit: Visit, status: string) => {
    const { error } = await supabase
      .from("visits")
      .update({ status: status as Visit["status"] })
      .eq("id", visit.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: "Status atualizado" });
    }
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const filteredVisits = visits.filter((v) => {
    const scheduled = new Date(v.scheduled_at);
    if (filter === "today") {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return scheduled >= today && scheduled < tomorrow;
    }
    if (filter === "week") {
      return scheduled >= today && scheduled < weekEnd;
    }
    if (filter === "scheduled") {
      return v.status === "scheduled" || v.status === "confirmed";
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Visitas" subtitle="Agenda de visitas aos imóveis" />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {[
              { id: "all", label: "Todas" },
              { id: "today", label: "Hoje" },
              { id: "week", label: "Esta Semana" },
              { id: "scheduled", label: "Agendadas" },
            ].map((f) => (
              <Button
                key={f.id}
                variant={filter === f.id ? "outline" : "ghost"}
                size="sm"
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setSelectedVisit(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Agendar Visita
          </Button>
        </div>

        {filteredVisits.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma visita agendada</h3>
              <p className="text-muted-foreground text-center mb-4">
                As visitas agendadas aparecerão aqui
              </p>
              <Button
                className="gap-2"
                onClick={() => {
                  setSelectedVisit(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Agendar Primeira Visita
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVisits.map((visit) => (
              <Card key={visit.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4 text-primary" />
                        {new Date(visit.scheduled_at).toLocaleDateString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}{" "}
                        às{" "}
                        {new Date(visit.scheduled_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(visit)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(visit, "confirmed")}>
                          Marcar como Confirmada
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(visit, "completed")}>
                          Marcar como Realizada
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(visit, "cancelled")}>
                          Cancelar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(visit)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{visit.leads?.name || "Lead"}</span>
                      <span className="text-muted-foreground">{visit.leads?.phone}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {visit.properties?.code} - {visit.properties?.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Badge className={cn("text-[10px]", statusColors[visit.status])}>
                      {statusLabels[visit.status]}
                    </Badge>
                    {visit.notes && (
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {visit.notes}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <VisitFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        visit={selectedVisit}
        onSuccess={loadVisits}
      />
    </div>
  );
};

export default Visits;
