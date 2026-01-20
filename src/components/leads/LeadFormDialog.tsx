import { useState } from "react";
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
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

const formSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().min(10, "Telefone inválido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  source: z.enum(["whatsapp", "website", "referral", "portal", "walk_in", "social_media", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["new", "contacted", "qualified", "visit_scheduled", "visited", "proposal", "negotiation", "closed_won", "closed_lost"]),
  notes: z.string().optional(),
  min_budget: z.coerce.number().optional(),
  max_budget: z.coerce.number().optional(),
  min_bedrooms: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess?: () => void;
}

const sourceLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  website: "Website",
  referral: "Indicação",
  portal: "Portal",
  walk_in: "Visita Espontânea",
  social_media: "Redes Sociais",
  other: "Outro",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const statusLabels: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  visit_scheduled: "Visita Agendada",
  visited: "Visitou",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed_won: "Fechado (Ganho)",
  closed_lost: "Fechado (Perdido)",
};

export default function LeadFormDialog({ open, onOpenChange, lead, onSuccess }: LeadFormDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: lead?.name || "",
      phone: lead?.phone || "",
      email: lead?.email || "",
      source: lead?.source || "whatsapp",
      priority: lead?.priority || "medium",
      status: lead?.status || "new",
      notes: lead?.notes || "",
      min_budget: lead?.min_budget || undefined,
      max_budget: lead?.max_budget || undefined,
      min_bedrooms: lead?.min_bedrooms || undefined,
    },
  });

  async function onSubmit(values: FormValues) {
    setIsLoading(true);

    try {
      if (lead) {
        const { error } = await supabase
          .from("leads")
          .update({
            name: values.name,
            phone: values.phone,
            email: values.email || null,
            source: values.source,
            priority: values.priority,
            status: values.status,
            notes: values.notes || null,
            min_budget: values.min_budget || null,
            max_budget: values.max_budget || null,
            min_bedrooms: values.min_bedrooms || null,
          })
          .eq("id", lead.id);

        if (error) throw error;
        toast({ title: "Lead atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("leads").insert({
          name: values.name,
          phone: values.phone,
          email: values.email || null,
          source: values.source,
          priority: values.priority,
          status: values.status,
          notes: values.notes || null,
          min_budget: values.min_budget || null,
          max_budget: values.max_budget || null,
          min_bedrooms: values.min_bedrooms || null,
        });

        if (error) throw error;
        toast({ title: "Lead criado com sucesso!" });
      }

      onSuccess?.();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Erro ao salvar lead",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
          <DialogDescription>
            {lead ? "Atualize as informações do lead." : "Adicione um novo lead ao pipeline."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(sourceLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="min_budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orçamento Mín.</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orçamento Máx.</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quartos Mín.</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Anotações sobre o lead..." {...field} />
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
                {isLoading ? "Salvando..." : lead ? "Atualizar" : "Criar Lead"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
