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

type Property = Tables<"properties">;

const formSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  code: z.string().min(1, "Código é obrigatório"),
  property_type: z.enum(["house", "apartment", "commercial", "land", "rural", "other"]),
  transaction_type: z.enum(["sale", "rent", "both"]),
  status: z.enum(["available", "reserved", "sold", "rented", "inactive"]),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_neighborhood: z.string().min(1, "Bairro é obrigatório"),
  address_city: z.string().min(1, "Cidade é obrigatória"),
  address_state: z.string().default("SP"),
  address_zipcode: z.string().optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  suites: z.coerce.number().optional(),
  parking_spots: z.coerce.number().optional(),
  area_total: z.coerce.number().optional(),
  area_built: z.coerce.number().optional(),
  sale_price: z.coerce.number().optional(),
  rent_price: z.coerce.number().optional(),
  condominium_fee: z.coerce.number().optional(),
  iptu: z.coerce.number().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PropertyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property | null;
  onSuccess?: () => void;
}

const propertyTypeLabels: Record<string, string> = {
  house: "Casa",
  apartment: "Apartamento",
  commercial: "Comercial",
  land: "Terreno",
  rural: "Rural",
  other: "Outro",
};

const transactionLabels: Record<string, string> = {
  sale: "Venda",
  rent: "Aluguel",
  both: "Venda e Aluguel",
};

const statusLabels: Record<string, string> = {
  available: "Disponível",
  reserved: "Reservado",
  sold: "Vendido",
  rented: "Alugado",
  inactive: "Inativo",
};

export default function PropertyFormDialog({ open, onOpenChange, property, onSuccess }: PropertyFormDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: property?.title || "",
      code: property?.code || `IMV-${Date.now().toString(36).toUpperCase()}`,
      property_type: property?.property_type || "apartment",
      transaction_type: property?.transaction_type || "sale",
      status: property?.status || "available",
      address_street: property?.address_street || "",
      address_number: property?.address_number || "",
      address_neighborhood: property?.address_neighborhood || "",
      address_city: property?.address_city || "",
      address_state: property?.address_state || "SP",
      address_zipcode: property?.address_zipcode || "",
      bedrooms: property?.bedrooms || undefined,
      bathrooms: property?.bathrooms || undefined,
      suites: property?.suites || undefined,
      parking_spots: property?.parking_spots || undefined,
      area_total: property?.area_total || undefined,
      area_built: property?.area_built || undefined,
      sale_price: property?.sale_price || undefined,
      rent_price: property?.rent_price || undefined,
      condominium_fee: property?.condominium_fee || undefined,
      iptu: property?.iptu || undefined,
      description: property?.description || "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsLoading(true);

    try {
      const data = {
        title: values.title,
        code: values.code,
        property_type: values.property_type,
        transaction_type: values.transaction_type,
        status: values.status,
        address_street: values.address_street || null,
        address_number: values.address_number || null,
        address_neighborhood: values.address_neighborhood,
        address_city: values.address_city,
        address_state: values.address_state,
        address_zipcode: values.address_zipcode || null,
        bedrooms: values.bedrooms || null,
        bathrooms: values.bathrooms || null,
        suites: values.suites || null,
        parking_spots: values.parking_spots || null,
        area_total: values.area_total || null,
        area_built: values.area_built || null,
        sale_price: values.sale_price || null,
        rent_price: values.rent_price || null,
        condominium_fee: values.condominium_fee || null,
        iptu: values.iptu || null,
        description: values.description || null,
      };

      if (property) {
        const { error } = await supabase.from("properties").update(data).eq("id", property.id);
        if (error) throw error;
        toast({ title: "Imóvel atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("properties").insert(data);
        if (error) throw error;
        toast({ title: "Imóvel criado com sucesso!" });
      }

      onSuccess?.();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Erro ao salvar imóvel",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{property ? "Editar Imóvel" : "Novo Imóvel"}</DialogTitle>
          <DialogDescription>
            {property ? "Atualize as informações do imóvel." : "Adicione um novo imóvel ao portfólio."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input placeholder="Apartamento Centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input placeholder="IMV-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="property_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(propertyTypeLabels).map(([value, label]) => (
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
                name="transaction_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transação</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(transactionLabels).map(([value, label]) => (
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="address_street"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Rua</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua das Flores" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="address_neighborhood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro *</FormLabel>
                    <FormControl>
                      <Input placeholder="Centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade *</FormLabel>
                    <FormControl>
                      <Input placeholder="São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address_state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <FormControl>
                      <Input placeholder="SP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address_zipcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input placeholder="01234-567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quartos</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bathrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banheiros</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="suites"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suítes</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parking_spots"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vagas</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="area_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área Total (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="area_built"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área Construída (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="sale_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço Venda (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rent_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço Aluguel (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="condominium_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condomínio (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="iptu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IPTU (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição do imóvel..." {...field} />
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
                {isLoading ? "Salvando..." : property ? "Atualizar" : "Criar Imóvel"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
