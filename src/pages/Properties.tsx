import { useState, useEffect, useCallback } from "react";
import { Building2, Plus, MapPin, Bed, Bath, Car, Ruler, MoreVertical } from "lucide-react";
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
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import PropertyFormDialog from "@/components/properties/PropertyFormDialog";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Property = Tables<"properties">;

const statusLabels: Record<string, string> = {
  available: "Disponível",
  reserved: "Reservado",
  sold: "Vendido",
  rented: "Alugado",
  inactive: "Inativo",
};

const statusColors: Record<string, string> = {
  available: "bg-success/20 text-success",
  reserved: "bg-warning/20 text-warning",
  sold: "bg-primary/20 text-primary",
  rented: "bg-accent/20 text-accent",
  inactive: "bg-muted text-muted-foreground",
};

const typeLabels: Record<string, string> = {
  house: "Casa",
  apartment: "Apartamento",
  commercial: "Comercial",
  land: "Terreno",
  rural: "Rural",
  other: "Outro",
};

const Properties = () => {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar imóveis", variant: "destructive" });
    } else {
      setProperties(data || []);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useRealtimeSubscription({
    table: "properties",
    onInsert: (newProp) => setProperties((prev) => [newProp, ...prev]),
    onUpdate: (updatedProp) =>
      setProperties((prev) => prev.map((p) => (p.id === updatedProp.id ? updatedProp : p))),
    onDelete: (deletedProp) =>
      setProperties((prev) => prev.filter((p) => p.id !== deletedProp.id)),
  });

  const handleEdit = (property: Property) => {
    setSelectedProperty(property);
    setDialogOpen(true);
  };

  const handleDelete = async (property: Property) => {
    if (!confirm(`Excluir imóvel "${property.title}"?`)) return;

    const { error } = await supabase.from("properties").delete().eq("id", property.id);
    if (error) {
      toast({ title: "Erro ao excluir imóvel", variant: "destructive" });
    } else {
      toast({ title: "Imóvel excluído" });
    }
  };

  const filteredProperties =
    filter === "all" ? properties : properties.filter((p) => p.status === filter);

  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Imóveis" subtitle="Gerencie seu portfólio de imóveis" />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {[
              { id: "all", label: "Todos" },
              { id: "available", label: "Disponíveis" },
              { id: "sold", label: "Vendidos" },
              { id: "rented", label: "Alugados" },
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
              setSelectedProperty(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo Imóvel
          </Button>
        </div>

        {filteredProperties.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum imóvel cadastrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Comece adicionando seu primeiro imóvel ao sistema
              </p>
              <Button
                className="gap-2"
                onClick={() => {
                  setSelectedProperty(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Adicionar Imóvel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProperties.map((property) => (
              <Card key={property.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <Building2 className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{property.title}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {property.address_neighborhood}, {property.address_city}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(property)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(property)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {property.bedrooms && (
                      <span className="flex items-center gap-1">
                        <Bed className="h-3 w-3" /> {property.bedrooms}
                      </span>
                    )}
                    {property.bathrooms && (
                      <span className="flex items-center gap-1">
                        <Bath className="h-3 w-3" /> {property.bathrooms}
                      </span>
                    )}
                    {property.parking_spots && (
                      <span className="flex items-center gap-1">
                        <Car className="h-3 w-3" /> {property.parking_spots}
                      </span>
                    )}
                    {property.area_total && (
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3 w-3" /> {property.area_total}m²
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      {property.sale_price && (
                        <p className="text-sm font-bold text-primary">
                          {formatPrice(property.sale_price)}
                        </p>
                      )}
                      {property.rent_price && (
                        <p className="text-xs text-muted-foreground">
                          Aluguel: {formatPrice(property.rent_price)}/mês
                        </p>
                      )}
                    </div>
                    <Badge className={cn("text-[10px]", statusColors[property.status])}>
                      {statusLabels[property.status]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <PropertyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        property={selectedProperty}
        onSuccess={loadProperties}
      />
    </div>
  );
};

export default Properties;
