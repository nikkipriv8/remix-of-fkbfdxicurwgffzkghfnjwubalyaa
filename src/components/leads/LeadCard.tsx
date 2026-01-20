import { Phone, Mail, Calendar, MoreVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface LeadCardProps {
  lead: Lead;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onScheduleVisit?: (lead: Lead) => void;
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/20 text-warning",
  high: "bg-accent/20 text-accent",
  urgent: "bg-destructive/20 text-destructive",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export default function LeadCard({ lead, onEdit, onDelete, onScheduleVisit }: LeadCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow bg-card">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium truncate">{lead.name}</h4>
            {lead.email && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {lead.email}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(lead)}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onScheduleVisit?.(lead)}>
                Agendar Visita
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => onDelete?.(lead)}
              >
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          {lead.phone}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Badge 
            variant="secondary" 
            className={cn("text-[10px] px-1.5 py-0", priorityColors[lead.priority])}
          >
            {priorityLabels[lead.priority]}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {new Date(lead.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
