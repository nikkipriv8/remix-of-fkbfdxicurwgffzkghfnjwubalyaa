import { useState } from "react";
import {
  Phone,
  Mail,
  User,
  Calendar,
  MapPin,
  Home,
  DollarSign,
  X,
  Edit2,
  Save,
  Tag,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  priority: string;
  source: string;
  notes: string | null;
  preferred_property_type: string | null;
  preferred_transaction: string | null;
  min_budget: number | null;
  max_budget: number | null;
  preferred_neighborhoods: string[] | null;
  avatar_url?: string | null;
  created_at: string;
};

type ContactInfoPanelProps = {
  lead: Lead | null;
  phone: string;
  whatsappId: string;
  conversationId: string;
  onClose: () => void;
  onLeadUpdated: () => void;
};

export default function ContactInfoPanel({
  lead,
  phone,
  whatsappId,
  conversationId,
  onClose,
  onLeadUpdated,
}: ContactInfoPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedLead, setEditedLead] = useState<Partial<Lead>>(lead || {});

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarUrl = () => {
    if (lead?.avatar_url) return lead.avatar_url;
    const seed = lead?.name || phone;
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&radius=50`;
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSave = async () => {
    if (!lead) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          name: editedLead.name,
          email: editedLead.email,
          status: editedLead.status as any,
          priority: editedLead.priority as any,
          notes: editedLead.notes,
          preferred_property_type: editedLead.preferred_property_type as any,
          preferred_transaction: editedLead.preferred_transaction as any,
          min_budget: editedLead.min_budget,
          max_budget: editedLead.max_budget,
        })
        .eq("id", lead.id);

      if (error) throw error;
      toast.success("Contato atualizado!");
      setIsEditing(false);
      onLeadUpdated();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const createLead = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("leads").insert({
        name: phone,
        phone: phone,
        whatsapp_id: whatsappId,
        source: "whatsapp",
        status: "new",
        priority: "medium",
      });

      if (error) throw error;

      // Link lead to conversation
      const { data: newLead } = await supabase
        .from("leads")
        .select("id")
        .eq("whatsapp_id", whatsappId)
        .maybeSingle();

      if (newLead) {
        await supabase
          .from("whatsapp_conversations")
          .update({ lead_id: newLead.id })
          .eq("id", conversationId);
      }

      toast.success("Lead criado com sucesso!");
      onLeadUpdated();
    } catch (error: any) {
      toast.error("Erro ao criar lead: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    new: "bg-info/10 text-info border-info/20",
    contacted: "bg-warning/10 text-warning border-warning/20",
    qualified: "bg-primary/10 text-primary border-primary/20",
    negotiating: "bg-accent/10 text-accent border-accent/20",
    converted: "bg-success/10 text-success border-success/20",
    lost: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const priorityColors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-warning/10 text-warning border-warning/20",
    high: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Informações do Contato</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Avatar e Nome */}
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-3">
              <AvatarImage src={getAvatarUrl()} alt={lead?.name || phone} loading="lazy" />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {lead ? getInitials(lead.name) : phone.slice(-2)}
              </AvatarFallback>
            </Avatar>
            {isEditing && lead ? (
              <Input
                value={editedLead.name || ""}
                onChange={(e) =>
                  setEditedLead({ ...editedLead, name: e.target.value })
                }
                className="text-center font-semibold"
              />
            ) : (
              <h4 className="font-semibold text-lg">
                {lead?.name || phone}
              </h4>
            )}
            <p className="text-sm text-muted-foreground">{phone}</p>
          </div>

          {!lead ? (
            /* Sem lead vinculado */
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Este contato ainda não está cadastrado como lead.
              </p>
              <Button onClick={createLead} disabled={isSaving} className="w-full">
                <User className="h-4 w-4 mr-2" />
                Cadastrar como Lead
              </Button>
            </div>
          ) : (
            /* Lead vinculado */
            <>
              {/* Status e Prioridade */}
              <div className="flex gap-2 justify-center">
                <Badge
                  variant="outline"
                  className={cn(statusColors[lead.status] || "")}
                >
                  {lead.status}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(priorityColors[lead.priority] || "")}
                >
                  {lead.priority}
                </Badge>
              </div>

              <Separator />

              {/* Informações de Contato */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Contato
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.phone}</span>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={editedLead.email || ""}
                        onChange={(e) =>
                          setEditedLead({ ...editedLead, email: e.target.value })
                        }
                        placeholder="Email"
                        className="h-8"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.email || "Não informado"}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Preferências */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Preferências
                </h5>
                <div className="space-y-2 text-sm">
                  {isEditing ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo de Imóvel</Label>
                        <Select
                          value={editedLead.preferred_property_type || ""}
                          onValueChange={(v) =>
                            setEditedLead({
                              ...editedLead,
                              preferred_property_type: v,
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="apartment">Apartamento</SelectItem>
                            <SelectItem value="house">Casa</SelectItem>
                            <SelectItem value="condo">Condomínio</SelectItem>
                            <SelectItem value="land">Terreno</SelectItem>
                            <SelectItem value="commercial">Comercial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Transação</Label>
                        <Select
                          value={editedLead.preferred_transaction || ""}
                          onValueChange={(v) =>
                            setEditedLead({
                              ...editedLead,
                              preferred_transaction: v,
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sale">Compra</SelectItem>
                            <SelectItem value="rent">Aluguel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {lead.preferred_property_type || "Não definido"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {lead.preferred_transaction === "sale"
                            ? "Compra"
                            : lead.preferred_transaction === "rent"
                            ? "Aluguel"
                            : "Não definido"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* Orçamento */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Orçamento
                </h5>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Mínimo</Label>
                      <Input
                        type="number"
                        value={editedLead.min_budget || ""}
                        onChange={(e) =>
                          setEditedLead({
                            ...editedLead,
                            min_budget: Number(e.target.value),
                          })
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Máximo</Label>
                      <Input
                        type="number"
                        value={editedLead.max_budget || ""}
                        onChange={(e) =>
                          setEditedLead({
                            ...editedLead,
                            max_budget: Number(e.target.value),
                          })
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    <p>
                      {formatCurrency(lead.min_budget)} -{" "}
                      {formatCurrency(lead.max_budget)}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Bairros */}
              {lead.preferred_neighborhoods &&
                lead.preferred_neighborhoods.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Bairros de Interesse
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {lead.preferred_neighborhoods.map((n, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {n}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {/* Notas */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium">Observações</h5>
                {isEditing ? (
                  <textarea
                    value={editedLead.notes || ""}
                    onChange={(e) =>
                      setEditedLead({ ...editedLead, notes: e.target.value })
                    }
                    className="w-full min-h-[80px] p-2 text-sm border rounded-md bg-background"
                    placeholder="Adicione observações..."
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {lead.notes || "Nenhuma observação"}
                  </p>
                )}
              </div>

              {/* Data de Cadastro */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Cadastrado em {new Date(lead.created_at).toLocaleDateString()}
              </div>

              {/* Botões de Ação */}
              <div className="pt-2">
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedLead(lead);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Editar Contato
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
