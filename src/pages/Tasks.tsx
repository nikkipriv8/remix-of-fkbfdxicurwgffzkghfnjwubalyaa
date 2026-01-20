import { useState, useEffect, useCallback } from "react";
import { CheckSquare, Plus, Circle, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import TaskFormDialog from "@/components/tasks/TaskFormDialog";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;

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

const Tasks = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const loadTasks = useCallback(async () => {
    if (!profile?.id) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", profile.id)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) {
      toast({ title: "Erro ao carregar tarefas", variant: "destructive" });
    } else {
      setTasks(data || []);
    }
    setIsLoading(false);
  }, [profile?.id, toast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useRealtimeSubscription({
    table: "tasks",
    onInsert: (newTask) => {
      if (newTask.user_id === profile?.id) {
        setTasks((prev) => [...prev, newTask].sort((a, b) => 
          (a.due_date || "").localeCompare(b.due_date || "")
        ));
      }
    },
    onUpdate: (updatedTask) =>
      setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))),
    onDelete: (deletedTask) => setTasks((prev) => prev.filter((t) => t.id !== deletedTask.id)),
  });

  const toggleComplete = async (task: Task) => {
    const completed_at = task.completed_at ? null : new Date().toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at })
      .eq("id", task.id);

    if (error) {
      toast({ title: "Erro ao atualizar tarefa", variant: "destructive" });
    }
  };

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`Excluir tarefa "${task.title}"?`)) return;

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast({ title: "Erro ao excluir tarefa", variant: "destructive" });
    } else {
      toast({ title: "Tarefa excluída" });
    }
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return !t.completed_at;
    if (filter === "today") {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      return due >= today && due < tomorrow && !t.completed_at;
    }
    if (filter === "overdue") {
      if (!t.due_date) return false;
      return new Date(t.due_date) < today && !t.completed_at;
    }
    return true;
  });

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.completed_at) return false;
    return new Date(task.due_date) < today;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Tarefas" subtitle="Gerencie suas tarefas e lembretes" />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {[
              { id: "all", label: "Todas" },
              { id: "pending", label: "Pendentes" },
              { id: "today", label: "Hoje" },
              { id: "overdue", label: "Atrasadas" },
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
              setSelectedTask(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>

        {filteredTasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckSquare className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma tarefa pendente</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie tarefas para organizar seu trabalho
              </p>
              <Button
                className="gap-2"
                onClick={() => {
                  setSelectedTask(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Criar Primeira Tarefa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <Card
                key={task.id}
                className={cn(
                  "transition-all",
                  task.completed_at && "opacity-60"
                )}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <Checkbox
                    checked={!!task.completed_at}
                    onCheckedChange={() => toggleComplete(task)}
                    className="h-5 w-5"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className={cn(
                          "font-medium",
                          task.completed_at && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </h4>
                      {isOverdue(task) && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(task.due_date).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    <Badge className={cn("text-[10px]", priorityColors[task.priority])}>
                      {priorityLabels[task.priority]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(task)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(task)}
                    >
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask}
        onSuccess={loadTasks}
      />
    </div>
  );
};

export default Tasks;
