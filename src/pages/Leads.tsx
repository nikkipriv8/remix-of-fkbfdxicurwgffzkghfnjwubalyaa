import { useState, useEffect, useCallback } from "react";
import { Users, Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import LeadCard from "@/components/leads/LeadCard";
import LeadFormDialog from "@/components/leads/LeadFormDialog";
import VisitFormDialog from "@/components/visits/VisitFormDialog";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

const pipelineColumns = [
  { id: "new", title: "Novos", color: "bg-blue-500" },
  { id: "contacted", title: "Em Contato", color: "bg-yellow-500" },
  { id: "qualified", title: "Qualificados", color: "bg-purple-500" },
  { id: "visit_scheduled", title: "Visita Agendada", color: "bg-orange-500" },
  { id: "proposal", title: "Proposta", color: "bg-cyan-500" },
  { id: "closed_won", title: "Fechados", color: "bg-green-500" },
];

const Leads = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar leads", variant: "destructive" });
    } else {
      setLeads(data || []);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useRealtimeSubscription({
    table: "leads",
    onInsert: (newLead) => setLeads((prev) => [newLead, ...prev]),
    onUpdate: (updatedLead) =>
      setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))),
    onDelete: (deletedLead) => setLeads((prev) => prev.filter((l) => l.id !== deletedLead.id)),
  });

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setLeadDialogOpen(true);
  };

  const handleScheduleVisit = (lead: Lead) => {
    setSelectedLead(lead);
    setVisitDialogOpen(true);
  };

  const handleDeleteLead = async (lead: Lead) => {
    if (!confirm(`Excluir lead "${lead.name}"?`)) return;

    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) {
      toast({ title: "Erro ao excluir lead", variant: "destructive" });
    } else {
      toast({ title: "Lead excluído" });
    }
  };

  const getLeadsByStatus = (status: string) => leads.filter((l) => l.status === status);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Leads" subtitle="Pipeline de vendas e gestão de clientes" />

      <main className="flex-1 p-6 overflow-x-auto">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-muted-foreground">
            {leads.length} leads no pipeline
          </p>
          <Button
            className="gap-2"
            onClick={() => {
              setSelectedLead(null);
              setLeadDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo Lead
          </Button>
        </div>

        <div className="flex gap-4 min-w-max pb-4">
          {pipelineColumns.map((column) => {
            const columnLeads = getLeadsByStatus(column.id);
            return (
              <Card key={column.id} className="w-72 flex-shrink-0 bg-muted/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${column.color}`} />
                    <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {columnLeads.length}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="min-h-[200px] space-y-2">
                  {columnLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">Nenhum lead nesta etapa</p>
                    </div>
                  ) : (
                    columnLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onEdit={handleEditLead}
                        onDelete={handleDeleteLead}
                        onScheduleVisit={handleScheduleVisit}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      <LeadFormDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        lead={selectedLead}
        onSuccess={loadLeads}
      />

      <VisitFormDialog
        open={visitDialogOpen}
        onOpenChange={setVisitDialogOpen}
        preselectedLeadId={selectedLead?.id}
        onSuccess={() => {
          setVisitDialogOpen(false);
          toast({ title: "Visita agendada!" });
        }}
      />
    </div>
  );
};

export default Leads;
