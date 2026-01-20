import { useMemo, useState } from "react";
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
import { PropertyImageUploader } from "@/components/properties/PropertyImageUploader";
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

  // Address (required)
  address_street: z.string().trim().min(1, "Rua é obrigatória"),
  address_number: z.string().trim().min(1, "Número é obrigatório"),
  address_neighborhood: z.string().trim().min(1, "Bairro é obrigatório"),
  address_city: z.string().trim().min(1, "Cidade é obrigatória"),
  address_state: z
    .string()
    .trim()
    .min(2, "UF é obrigatória")
    .max(2, "UF deve ter 2 letras")
    .transform((v) => v.toUpperCase())
    .default("SP"),
  address_zipcode: z.string().trim().min(1, "CEP é obrigatório"),

  // Specs (required where enforced by backend trigger)
  bedrooms: z.coerce.number().int().min(0, "Quartos deve ser >= 0"),
  bathrooms: z.coerce.number().int().min(0, "Banheiros deve ser >= 0"),
  suites: z.coerce.number().int().min(0).optional(),
  parking_spots: z.coerce.number().int().min(0).optional(),
  area_total: z.coerce.number().positive("Área total deve ser > 0"),
  area_built: z.coerce.number().min(0).optional(),

  // Prices (required by backend trigger)
  sale_price: z.coerce.number().positive("Preço de venda deve ser > 0"),
  rent_price: z.coerce.number().positive("Preço de aluguel deve ser > 0"),
  condominium_fee: z.coerce.number().min(0).optional(),
  iptu: z.coerce.number().min(0).optional(),

  description: z.string().trim().min(1, "Descrição é obrigatória"),

  // Images
  cover_image_url: z.string().trim().url("URL da capa inválida").min(1, "Capa é obrigatória"),
  images_text: z
    .string()
    .trim()
    .min(1, "Informe pelo menos 1 URL de foto")
    .refine(
      (txt) =>
        txt
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .every((u) => {
            try {
              const parsed = new URL(u);
              return parsed.protocol === "https:" || parsed.protocol === "http:";
            } catch {
              return false;
            }
          }),
      "Uma ou mais URLs de fotos são inválidas"
    ),
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

      bedrooms: property?.bedrooms ?? 0,
      bathrooms: property?.bathrooms ?? 0,
      suites: property?.suites ?? 0,
      parking_spots: property?.parking_spots ?? 0,
      area_total: (property?.area_total as any) ?? 1,
      area_built: (property?.area_built as any) ?? 0,

      sale_price: (property?.sale_price as any) ?? 1,
      rent_price: (property?.rent_price as any) ?? 1,
      condominium_fee: (property?.condominium_fee as any) ?? 0,
      iptu: (property?.iptu as any) ?? 0,

      description: property?.description || "",

      cover_image_url: property?.cover_image_url || "",
      images_text: Array.isArray(property?.images)
        ? (property?.images as any[]).filter(Boolean).join("\n")
        : "",
    },
  });

  const codeValue = form.watch("code");
  const coverUrl = form.watch("cover_image_url");
  const imagesFromText = useMemo(() => {
    const txt = form.getValues("images_text") || "";
    return txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("images_text")]);


  async function onSubmit(values: FormValues) {
    setIsLoading(true);

    try {
      const images = values.images_text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const data = {
        title: values.title,
        code: values.code,
        property_type: values.property_type,
        transaction_type: values.transaction_type,
        status: values.status,

        address_street: values.address_street,
        address_number: values.address_number,
        address_neighborhood: values.address_neighborhood,
        address_city: values.address_city,
        address_state: values.address_state,
        address_zipcode: values.address_zipcode,

        bedrooms: values.bedrooms,
        bathrooms: values.bathrooms,
        suites: values.suites ?? 0,
        parking_spots: values.parking_spots ?? 0,
        area_total: values.area_total,
        area_built: values.area_built ?? 0,

        sale_price: values.sale_price,
        rent_price: values.rent_price,
        condominium_fee: values.condominium_fee ?? 0,
        iptu: values.iptu ?? 0,

        description: values.description,

        cover_image_url: values.cover_image_url,
        images: images as any,
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
    } catch (error: any) {
      toast({
        title: "Erro ao salvar imóvel",
        description: error?.message || "Tente novamente.",
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
                    <FormLabel>Rua *</FormLabel>
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
                    <FormLabel>Número *</FormLabel>
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
                    <FormLabel>UF *</FormLabel>
                    <FormControl>
                      <Input placeholder="SP" maxLength={2} {...field} />
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
                    <FormLabel>CEP *</FormLabel>
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
                    <FormLabel>Quartos *</FormLabel>
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
                    <FormLabel>Banheiros *</FormLabel>
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
                    <FormLabel>Área Total (m²) *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
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
                    <FormLabel>Preço Venda (R$) *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
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
                    <FormLabel>Preço Aluguel (R$) *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
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
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Descreva o imóvel (diferenciais, proximidades, etc.)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              {/* Hidden fields kept for validation + DB */}
              <div className="hidden">
                <FormField
                  control={form.control}
                  name="cover_image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Capa (imagem principal) *</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="images_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URLs das Fotos (1 por linha) *</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder={"https://...\nhttps://..."} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <PropertyImageUploader
                folderKey={codeValue}
                coverUrl={coverUrl}
                images={imagesFromText}
                disabled={isLoading}
                onChange={({ coverUrl: nextCover, images: nextImages }) => {
                  form.setValue("cover_image_url", nextCover, { shouldValidate: true, shouldDirty: true });
                  form.setValue("images_text", nextImages.join("\n"), { shouldValidate: true, shouldDirty: true });
                }}
              />

              {/* Surface validation messages */}
              <div className="space-y-1">
                <FormMessage>{form.formState.errors.cover_image_url?.message as any}</FormMessage>
                <FormMessage>{form.formState.errors.images_text?.message as any}</FormMessage>
              </div>
            </div>


            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : property ? "Salvar alterações" : "Criar imóvel"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
