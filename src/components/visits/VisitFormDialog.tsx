import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Visit = Tables<"visits">;
type Lead = Tables<"leads">;
type Property = Tables<"properties">;

const formSchema = z.object({
  lead_id: z.string().min(1, "Selecione um lead"),
  property_id: z.string().min(1, "Selecione um imóvel"),
  scheduled_at: z.string().min(1, "Selecione data e hora"),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "rescheduled", "no_show"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface VisitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit?: Visit | null;
  preselectedLeadId?: string;
  preselectedPropertyId?: string;
  onSuccess?: () => void;
}

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  rescheduled: "Reagendada",
  no_show: "Não Compareceu",
};

export default function VisitFormDialog({
  open,
  onOpenChange,
  visit,
  preselectedLeadId,
  preselectedPropertyId,
  onSuccess,
}: VisitFormDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [leads, setLeads] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; code: string }[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lead_id: visit?.lead_id || preselectedLeadId || "",
      property_id: visit?.property_id || preselectedPropertyId || "",
      scheduled_at: visit?.scheduled_at ? new Date(visit.scheduled_at).toISOString().slice(0, 16) : "",
      status: visit?.status || "scheduled",
      notes: visit?.notes || "",
    },
  });

  useEffect(() => {
    async function fetchData() {
      const [leadsRes, propertiesRes] = await Promise.all([
        supabase.from("leads").select("id, name, phone").order("name"),
        supabase.from("properties").select("id, title, code").eq("status", "available").order("title"),
      ]);

      if (leadsRes.data) setLeads(leadsRes.data);
      if (propertiesRes.data) setProperties(propertiesRes.data);
    }
    if (open) fetchData();
  }, [open]);

  async function onSubmit(values: FormValues) {
    if (!profile?.id) {
      toast({ title: "Erro", description: "Perfil não encontrado.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const data = {
        lead_id: values.lead_id,
        property_id: values.property_id,
        broker_id: profile.id,
        scheduled_at: new Date(values.scheduled_at).toISOString(),
        status: values.status,
        notes: values.notes || null,
      };

      if (visit) {
        const { error } = await supabase.from("visits").update(data).eq("id", visit.id);
        if (error) throw error;
        toast({ title: "Visita atualizada com sucesso!" });
      } else {
        const { error } = await supabase.from("visits").insert(data);
        if (error) throw error;
        toast({ title: "Visita agendada com sucesso!" });
      }

      onSuccess?.();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Erro ao salvar visita",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{visit ? "Editar Visita" : "Agendar Visita"}</DialogTitle>
          <DialogDescription>
            {visit ? "Atualize as informações da visita." : "Agende uma visita a um imóvel."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lead_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name} - {lead.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="property_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imóvel *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o imóvel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties.map((prop) => (
                        <SelectItem key={prop.id} value={prop.id}>
                          {prop.code} - {prop.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e Hora *</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações sobre a visita..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : visit ? "Atualizar" : "Agendar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
