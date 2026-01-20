import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Shield,
  UserCog,
  Headphones,
  Loader2,
  Search,
  MoreVertical,
  Mail,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles"> & {
  actual_role?: 'admin' | 'broker' | 'attendant';
};

const roleConfig = {
  admin: {
    label: "Administrador",
    description: "Acesso total ao sistema",
    icon: Shield,
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
  broker: {
    label: "Moderador",
    description: "Gerencia equipe e leads",
    icon: UserCog,
    color: "bg-primary/10 text-primary border-primary/20",
  },
  attendant: {
    label: "Atendente",
    description: "Visualiza e atende clientes",
    icon: Headphones,
    color: "bg-success/10 text-success border-success/20",
  },
};

export default function UserManagement() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for editing
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "attendant" as "admin" | "broker" | "attendant",
    is_active: true,
  });

  const canManageUsers =
    currentProfile?.role === "admin" || currentProfile?.role === "broker";
  const isAdmin = currentProfile?.role === "admin";

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles from secure user_roles table
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Create a map of user_id to role
      const rolesMap = new Map(
        rolesData?.map((r) => [r.user_id, r.role]) || []
      );

      // Combine profiles with actual roles
      const usersWithRoles = (profilesData || []).map((profile) => ({
        ...profile,
        actual_role: rolesMap.get(profile.user_id) || "attendant",
      }));

      setUsers(usersWithRoles);
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleEditUser = (user: Profile) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || "",
      role: user.actual_role || user.role,
      is_active: user.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      // Update profile data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone || null,
          is_active: editForm.is_active,
        })
        .eq("id", selectedUser.id);

      if (profileError) throw profileError;

      // Update role in user_roles table (secure)
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: editForm.role })
        .eq("user_id", selectedUser.user_id);

      if (roleError) throw roleError;

      toast.success("Usuário atualizado com sucesso!");
      setIsEditDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao atualizar usuário: " + (error?.message || "Tente novamente"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (user: Profile) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !user.is_active })
        .eq("id", user.id);

      if (error) throw error;

      toast.success(
        user.is_active ? "Usuário desativado" : "Usuário ativado"
      );
      loadUsers();
    } catch {
      toast.error("Erro ao alterar status do usuário");
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone && user.phone.includes(searchQuery))
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!canManageUsers) {
    return (
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Gestão de Usuários</CardTitle>
              <CardDescription>
                Você não tem permissão para gerenciar usuários
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Gestão de Usuários</CardTitle>
                <CardDescription>
                  Gerencie os usuários e seus cargos
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary/50 border-0"
            />
          </div>

          {/* Role Legend */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(roleConfig).map(([key, config]) => (
              <Badge
                key={key}
                variant="outline"
                className={cn("gap-1.5", config.color)}
              >
                <config.icon className="h-3 w-3" />
                {config.label}
              </Badge>
            ))}
          </div>

          {/* Users List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const userRole = user.actual_role || user.role;
                const config = roleConfig[userRole];
                const RoleIcon = config.icon;
                const isCurrentUser = user.id === currentProfile?.id;

                return (
                  <div
                    key={user.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl transition-colors",
                      user.is_active
                        ? "bg-secondary/50 hover:bg-secondary"
                        : "bg-muted/50 opacity-60"
                    )}
                  >
                    {/* Avatar */}
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{user.full_name}</p>
                        {isCurrentUser && (
                          <Badge variant="secondary" className="text-xs">
                            Você
                          </Badge>
                        )}
                        {!user.is_active && (
                          <Badge variant="outline" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Role Badge */}
                    <Badge variant="outline" className={cn("gap-1.5", config.color)}>
                      <RoleIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>

                    {/* Actions */}
                    {isAdmin && !isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                            {user.is_active ? (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações e permissões do usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input
                id="edit-name"
                value={editForm.full_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, full_name: e.target.value })
                }
                className="bg-secondary/50 border-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                value={editForm.email}
                disabled
                className="bg-secondary/50 border-0 opacity-60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
                placeholder="(00) 00000-0000"
                className="bg-secondary/50 border-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Cargo</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: "admin" | "broker" | "attendant") =>
                  setEditForm({ ...editForm, role: value })
                }
              >
                <SelectTrigger className="bg-secondary/50 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        <span>{config.label}</span>
                        <span className="text-xs text-muted-foreground">
                          - {config.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
              <div>
                <Label htmlFor="edit-active">Usuário Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Desativar impede o acesso ao sistema
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={editForm.is_active}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
