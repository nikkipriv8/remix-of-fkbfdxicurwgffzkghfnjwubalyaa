import { Bell, Search, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect, ReactNode } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function Header({ title, subtitle, children }: HeaderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  return (
    <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="animate-fade-in flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
      
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar imóveis, leads..."
            className="pl-9 w-72 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-xl"
          />
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl hover:bg-secondary"
          onClick={toggleTheme}
        >
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl hover:bg-secondary">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full gradient-accent text-[10px] font-bold text-white flex items-center justify-center shadow-lg">
            3
          </span>
        </Button>
      </div>
    </header>
  );
}
