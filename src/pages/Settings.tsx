import { useState, useEffect } from "react";
import { User, Building, Bell, Shield, MessageSquare, Copy, Check, RefreshCw, Loader2, Wifi, WifiOff, Users } from "lucide-react";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import UserManagement from "@/components/settings/UserManagement";

const Settings = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [zapiStatus, setZapiStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
    creci: "",
  });

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        creci: profile.creci || "",
      });
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone || null,
          creci: profileForm.creci || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });
      
      // Refresh the profile in context
      if (refreshProfile) {
        refreshProfile();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Webhook URLs
  const baseWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook`;
  const webhooks = [
    { id: 'send', label: 'Ao enviar', url: `${baseWebhookUrl}?type=send` },
    { id: 'receive', label: 'Ao receber', url: `${baseWebhookUrl}?type=message` },
    { id: 'disconnect', label: 'Ao desconectar', url: `${baseWebhookUrl}?type=disconnected` },
    { id: 'connect', label: 'Ao conectar', url: `${baseWebhookUrl}?type=connected` },
    { id: 'presence', label: 'Presença do chat', url: `${baseWebhookUrl}?type=presence` },
    { id: 'status', label: 'Status da mensagem', url: `${baseWebhookUrl}?type=message-status` },
  ];

  const checkZapiStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-send', {
        body: { action: 'get-status' }
      });

      if (error) throw error;

      if (data?.connected) {
        setZapiStatus('connected');
      } else {
        setZapiStatus('disconnected');
      }
    } catch {
      setZapiStatus('disconnected');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkZapiStatus();
  }, []);

  const copyToClipboard = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedWebhook(id);
    toast({
      title: "Copiado!",
      description: "URL do webhook copiada para a área de transferência.",
    });
    setTimeout(() => setCopiedWebhook(null), 2000);
  };

  const canManageUsers = profile?.role === "admin" || profile?.role === "broker";

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <Header 
        title="Configurações" 
        subtitle="Gerencie seu perfil e preferências"
      />
      
      <main className="flex-1 p-6">
        <Tabs defaultValue="general" className="max-w-4xl">
          <TabsList className="mb-6">
            <TabsTrigger value="general" className="gap-2">
              <User className="h-4 w-4" />
              Geral
            </TabsTrigger>
            {canManageUsers && (
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Usuários
              </TabsTrigger>
            )}
            <TabsTrigger value="integrations" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Integrações
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Perfil */}
            <Card className="border-0 shadow-soft">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Perfil</CardTitle>
                    <CardDescription>
                      Suas informações pessoais
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input 
                      id="name" 
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      placeholder="Seu nome"
                      className="bg-secondary/50 border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      defaultValue={profile?.email || ""} 
                      disabled
                      className="bg-secondary/50 border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input 
                      id="phone" 
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="bg-secondary/50 border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creci">CRECI</Label>
                    <Input 
                      id="creci" 
                      value={profileForm.creci}
                      onChange={(e) => setProfileForm({ ...profileForm, creci: e.target.value })}
                      placeholder="Número do CRECI"
                      className="bg-secondary/50 border-0"
                    />
                  </div>
                </div>
                <Button 
                  className="mt-2" 
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>

            {/* Imobiliária */}
            <Card className="border-0 shadow-soft">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Building className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle>Imobiliária</CardTitle>
                    <CardDescription>
                      Configurações da sua imobiliária
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Em breve você poderá configurar os dados da sua imobiliária aqui.
                </p>
              </CardContent>
            </Card>

            {/* Notificações */}
            <Card className="border-0 shadow-soft">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <CardTitle>Notificações</CardTitle>
                    <CardDescription>
                      Gerencie suas preferências de notificação
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Em breve você poderá configurar suas notificações aqui.
                </p>
              </CardContent>
            </Card>

            {/* Segurança */}
            <Card className="border-0 shadow-soft">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle>Segurança</CardTitle>
                    <CardDescription>
                      Configurações de segurança da conta
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline">Alterar Senha</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            {/* WhatsApp / Z-API Integration */}
            <Card className="border-0 shadow-soft overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-success/10 to-success/5 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <CardTitle>Integração WhatsApp (Z-API)</CardTitle>
                      <CardDescription>
                        Configure sua conexão com o WhatsApp via Z-API
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={zapiStatus === 'connected' ? 'default' : 'secondary'}
                      className={cn(
                        "gap-1.5",
                        zapiStatus === 'connected' && "bg-success text-success-foreground"
                      )}
                    >
                      {zapiStatus === 'loading' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : zapiStatus === 'connected' ? (
                        <Wifi className="h-3 w-3" />
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      {zapiStatus === 'loading' ? 'Verificando...' : 
                       zapiStatus === 'connected' ? 'Conectado' : 'Desconectado'}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={checkZapiStatus}
                      disabled={isCheckingStatus}
                      className="h-8 w-8"
                    >
                      <RefreshCw className={cn("h-4 w-4", isCheckingStatus && "animate-spin")} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Webhook URLs */}
                <div>
                  <h4 className="text-sm font-semibold mb-4">Configure os Webhooks na Z-API</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Copie as URLs abaixo e configure nos campos correspondentes do painel da Z-API.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {webhooks.map((webhook) => (
                      <div 
                        key={webhook.id}
                        className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 group hover:bg-secondary transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {webhook.label}
                          </p>
                          <p className="text-xs font-mono truncate text-foreground">
                            {webhook.url}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(webhook.id, webhook.url)}
                        >
                          {copiedWebhook === webhook.id ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <h5 className="text-sm font-semibold mb-2">Como configurar:</h5>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Acesse o painel da Z-API</li>
                    <li>Vá em "Configure webhooks" na sua instância</li>
                    <li>Cole cada URL no campo correspondente</li>
                    <li>Salve as configurações</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
