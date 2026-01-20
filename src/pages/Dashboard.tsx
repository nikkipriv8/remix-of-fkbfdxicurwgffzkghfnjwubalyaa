import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Users, 
  CalendarDays, 
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  Sparkles,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  totalProperties: number;
  availableProperties: number;
  totalLeads: number;
  newLeads: number;
  scheduledVisits: number;
  todayVisits: number;
}

interface RecentActivity {
  id: string;
  type: 'visit' | 'lead' | 'task' | 'message';
  title: string;
  description: string;
  timestamp: Date;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    availableProperties: 0,
    totalLeads: 0,
    newLeads: 0,
    scheduledVisits: 0,
    todayVisits: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { count: totalProperties } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true });
        
        const { count: availableProperties } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'available');

        const { count: totalLeads } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true });
        
        const { count: newLeads } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'new');

        const { count: scheduledVisits } = await supabase
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'scheduled');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { count: todayVisits } = await supabase
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .gte('scheduled_at', today.toISOString())
          .lt('scheduled_at', tomorrow.toISOString());

        setStats({
          totalProperties: totalProperties || 0,
          availableProperties: availableProperties || 0,
          totalLeads: totalLeads || 0,
          newLeads: newLeads || 0,
          scheduledVisits: scheduledVisits || 0,
          todayVisits: todayVisits || 0,
        });

        // Fetch recent activities
        const activities: RecentActivity[] = [];

        // Recent visits
        const { data: recentVisits } = await supabase
          .from('visits')
          .select('id, status, scheduled_at, updated_at, properties(title), leads(name)')
          .order('updated_at', { ascending: false })
          .limit(3);

        if (recentVisits) {
          recentVisits.forEach((visit: any) => {
            const isCompleted = visit.status === 'completed';
            activities.push({
              id: `visit-${visit.id}`,
              type: 'visit',
              title: isCompleted ? 'Visita realizada' : 'Visita agendada',
              description: `${visit.properties?.title || 'Imóvel'} - ${visit.leads?.name || 'Lead'}`,
              timestamp: new Date(visit.updated_at),
              icon: isCompleted ? CheckCircle2 : CalendarDays,
              iconBg: isCompleted ? 'bg-success/10' : 'bg-info/10',
              iconColor: isCompleted ? 'text-success' : 'text-info',
            });
          });
        }

        // Recent leads
        const { data: recentLeads } = await supabase
          .from('leads')
          .select('id, name, source, created_at')
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentLeads) {
          recentLeads.forEach((lead: any) => {
            activities.push({
              id: `lead-${lead.id}`,
              type: 'lead',
              title: lead.source === 'whatsapp' ? 'Novo lead via WhatsApp' : 'Novo lead cadastrado',
              description: lead.name,
              timestamp: new Date(lead.created_at),
              icon: lead.source === 'whatsapp' ? MessageSquare : Users,
              iconBg: 'bg-primary/10',
              iconColor: 'text-primary',
            });
          });
        }

        // Recent pending tasks
        const { data: pendingTasks } = await supabase
          .from('tasks')
          .select('id, title, due_date, created_at')
          .is('completed_at', null)
          .order('created_at', { ascending: false })
          .limit(3);

        if (pendingTasks) {
          pendingTasks.forEach((task: any) => {
            activities.push({
              id: `task-${task.id}`,
              type: 'task',
              title: 'Tarefa pendente',
              description: task.title,
              timestamp: new Date(task.created_at),
              icon: AlertCircle,
              iconBg: 'bg-warning/10',
              iconColor: 'text-warning',
            });
          });
        }

        // Sort by timestamp and take top 4
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setRecentActivities(activities.slice(0, 4));

      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Imóveis',
      value: stats.totalProperties,
      subtitle: `${stats.availableProperties} disponíveis`,
      icon: Home,
      gradient: 'from-primary to-primary/70',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      title: 'Leads',
      value: stats.totalLeads,
      subtitle: `${stats.newLeads} novos`,
      icon: Users,
      gradient: 'from-accent to-accent/70',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
    {
      title: 'Visitas',
      value: stats.scheduledVisits,
      subtitle: `${stats.todayVisits} hoje`,
      icon: CalendarDays,
      gradient: 'from-success to-success/70',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
  ];

  const formatTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Dashboard" subtitle="Visão geral do seu CRM" />
      
      <div className="p-6 space-y-6">
        {/* Welcome Banner */}
        <Card className="border-0 overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-white shadow-soft-lg animate-fade-in">
          <CardContent className="p-6 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
            <div className="relative flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-medium text-white/80">Agente IA Ativo</span>
                </div>
                <h2 className="text-2xl font-bold">Bem-vindo ao ImobCRM</h2>
                <p className="text-white/80 max-w-md">
                  Seu assistente de IA está ativo e pronto para atender seus clientes via WhatsApp.
                </p>
              </div>
              <Button 
                variant="secondary" 
                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm hidden md:flex gap-2"
                onClick={() => navigate('/whatsapp')}
              >
                Ver conversas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statCards.map((stat, index) => (
            <Card 
              key={stat.title} 
              className={cn(
                "border-0 shadow-soft card-hover opacity-0 animate-fade-in",
                `stagger-${index + 1}`
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">
                      {stat.subtitle}
                    </p>
                  </div>
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", stat.iconBg)}>
                    <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card className="border-0 shadow-soft opacity-0 animate-fade-in stagger-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickAction
                icon={Home}
                label="Cadastrar novo imóvel"
                description="Adicione um imóvel ao catálogo"
                gradient="from-primary/10 to-primary/5"
                iconColor="text-primary"
                onClick={() => navigate('/properties')}
              />
              <QuickAction
                icon={Users}
                label="Adicionar novo lead"
                description="Registre um novo cliente potencial"
                gradient="from-accent/10 to-accent/5"
                iconColor="text-accent"
                onClick={() => navigate('/leads')}
              />
              <QuickAction
                icon={CalendarDays}
                label="Agendar visita"
                description="Marque uma visita para um lead"
                gradient="from-success/10 to-success/5"
                iconColor="text-success"
                onClick={() => navigate('/visits')}
              />
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-0 shadow-soft opacity-0 animate-fade-in stagger-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Nenhuma atividade recente</p>
                  <p className="text-sm text-muted-foreground/70">
                    Comece cadastrando um imóvel ou lead
                  </p>
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    icon={activity.icon}
                    iconBg={activity.iconBg}
                    iconColor={activity.iconColor}
                    title={activity.title}
                    description={activity.description}
                    time={formatTime(activity.timestamp)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ 
  icon: Icon, 
  label,
  description,
  gradient,
  iconColor,
  onClick,
}: { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  gradient: string;
  iconColor: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r transition-all duration-200 group hover:shadow-md hover:-translate-y-0.5 text-left",
        gradient
      )}
    >
      <div className={cn("h-10 w-10 rounded-xl bg-card flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform", iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
    </button>
  );
}

function ActivityItem({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  time,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3 group">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", iconBg)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  );
}
