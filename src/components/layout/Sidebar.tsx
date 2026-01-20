import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2,
  LayoutDashboard,
  Home,
  Users,
  CalendarDays,
  MessageSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Home, label: 'Imóveis', path: '/properties' },
  { icon: Users, label: 'Leads', path: '/leads' },
  { icon: CalendarDays, label: 'Visitas', path: '/visits' },
  { icon: ListTodo, label: 'Tarefas', path: '/tasks' },
  { icon: MessageSquare, label: 'WhatsApp', path: '/whatsapp', badge: true },
];

const bottomItems = [
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const NavItem = ({ item, isActive }: { item: typeof menuItems[0]; isActive: boolean }) => {
    const content = (
      <Link
        to={item.path}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )}
      >
        <item.icon className={cn(
          'h-5 w-5 shrink-0 transition-transform duration-200',
          !isActive && 'group-hover:scale-110'
        )} />
        {!collapsed && (
          <>
            <span className="text-sm font-medium">{item.label}</span>
            {item.badge && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground animate-pulse-soft">
                3
              </span>
            )}
          </>
        )}
        {collapsed && item.badge && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">
            3
          </span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col border-r border-sidebar-border',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center h-16 px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-white tracking-tight">
                ImobCRM
              </span>
              <span className="text-[10px] text-sidebar-muted font-medium tracking-wider uppercase">
                Real Estate
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* AI Assistant Banner */}
      {!collapsed && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-gradient-to-r from-sidebar-primary/20 to-accent/20 border border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sidebar-accent flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-white">Agente IA</p>
              <p className="text-[10px] text-sidebar-muted">Ativo no WhatsApp</p>
            </div>
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          </div>
        </div>
      )}

      {/* Main navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={location.pathname === item.path}
          />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px bg-sidebar-border" />

      {/* Bottom section */}
      <div className="px-3 py-2 space-y-1">
        {bottomItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={location.pathname === item.path}
          />
        ))}
      </div>

      {/* User section */}
      <div className="p-3 border-t border-sidebar-border">
        <div
          className={cn(
            'flex items-center gap-3 p-2 rounded-xl bg-sidebar-accent/50',
            collapsed ? 'justify-center' : ''
          )}
        >
          <Avatar className="h-9 w-9 shrink-0 ring-2 ring-sidebar-border">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
              {profile?.full_name ? getInitials(profile.full_name) : 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-white">
                  {profile?.full_name || 'Usuário'}
                </p>
                <p className="text-xs text-sidebar-muted truncate">
                  {profile?.role === 'admin' ? 'Administrador' : 
                   profile?.role === 'broker' ? 'Corretor' : 'Atendente'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sidebar-muted hover:text-white hover:bg-sidebar-accent shrink-0"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-card border border-border shadow-soft flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
