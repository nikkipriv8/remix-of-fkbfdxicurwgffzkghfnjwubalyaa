import { useMemo, useState } from "react";
import { Database, UploadCloud, Play, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type EntityKey = "profiles" | "properties" | "leads" | "tasks" | "visits";

const entityLabels: Record<EntityKey, string> = {
  profiles: "Perfis/Cargos (obrigatório)",
  properties: "Imóveis",
  leads: "Leads",
  tasks: "Tarefas",
  visits: "Visitas",
};

function parseJsonFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "")));
      } catch {
        reject(new Error("JSON inválido"));
      }
    };
    reader.readAsText(file);
  });
}

export default function MigrationManager() {
  const { toast } = useToast();
  const [files, setFiles] = useState<Partial<Record<EntityKey, File>>>({});
  const [counts, setCounts] = useState<Partial<Record<EntityKey, number>>>({});
  const [isUploading, setIsUploading] = useState<Partial<Record<EntityKey, boolean>>>({});
  const [isRunning, setIsRunning] = useState(false);

  const ready = useMemo(() => {
    return Boolean(files.profiles);
  }, [files.profiles]);

  const handlePickFile = async (entity: EntityKey, file: File | null) => {
    if (!file) return;
    setFiles((prev) => ({ ...prev, [entity]: file }));

    try {
      const json = await parseJsonFile(file);
      const items = Array.isArray(json) ? json : json?.items;
      const n = Array.isArray(items) ? items.length : 0;
      setCounts((prev) => ({ ...prev, [entity]: n }));
    } catch (e: any) {
      setCounts((prev) => ({ ...prev, [entity]: 0 }));
      toast({
        title: `Arquivo inválido (${entityLabels[entity]})`,
        description: e?.message || "Verifique o formato do JSON.",
        variant: "destructive",
      });
    }
  };

  const uploadEntity = async (entity: EntityKey, replace = true) => {
    const file = files[entity];
    if (!file) return;

    setIsUploading((prev) => ({ ...prev, [entity]: true }));
    try {
      const json = await parseJsonFile(file);
      const items = Array.isArray(json) ? json : json?.items;
      if (!Array.isArray(items)) {
        throw new Error('Esperado um JSON no formato: "[ ... ]" ou "{ items: [ ... ] }"');
      }

      const { data, error } = await supabase.functions.invoke("migration-manager", {
        body: {
          action: "import",
          entity,
          replace,
          items,
        },
      });

      if (error) throw error;

      toast({
        title: "Importado",
        description: data?.message || `${entityLabels[entity]} importado com sucesso.`,
      });
    } catch (e: any) {
      toast({
        title: "Erro ao importar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading((prev) => ({ ...prev, [entity]: false }));
    }
  };

  const clearAllStaging = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("migration-manager", {
        body: { action: "clear" },
      });
      if (error) throw error;
      toast({ title: "Staging limpo", description: data?.message || "Dados temporários removidos." });
    } catch (e: any) {
      toast({
        title: "Erro ao limpar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runMigration = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("migration-manager", {
        body: { action: "run" },
      });
      if (error) throw error;

      const summary = data?.summary;
      toast({
        title: "Migração concluída",
        description:
          summary?.message ||
          "Migração executada. Confira o resumo e corrija possíveis emails faltantes.",
      });
    } catch (e: any) {
      toast({
        title: "Erro na migração",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>Migração do projeto antigo</CardTitle>
              <CardDescription>
                Importe arquivos JSON e execute a migração com remapeamento por e-mail.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-secondary/40 p-4 space-y-2">
            <p className="text-sm font-medium">Formato esperado</p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>
                Um JSON com array: <span className="font-mono">{'[ {"..."}, {"..."} ]'}</span> (ou{" "}
                <span className="font-mono">{"{ items: [...] }"}</span>)
              </li>
              <li>
                <span className="font-medium">Perfis</span>: precisa ter pelo menos{" "}
                <span className="font-mono">email</span> e <span className="font-mono">role</span> (admin/broker/attendant)
              </li>
              <li>
                Os usuários devem ser recriados manualmente no sistema atual com o{" "}
                <span className="font-medium">mesmo e-mail</span>
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(entityLabels) as EntityKey[]).map((entity) => (
              <div key={entity} className="rounded-xl bg-secondary/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{entityLabels[entity]}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {files[entity]?.name || "Nenhum arquivo selecionado"}
                    </p>
                  </div>
                  {typeof counts[entity] === "number" && (
                    <Badge variant="secondary">{counts[entity]} itens</Badge>
                  )}
                </div>

                <Input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => handlePickFile(entity, e.target.files?.[0] || null)}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={entity === "profiles" ? "default" : "outline"}
                    onClick={() => uploadEntity(entity, true)}
                    disabled={!files[entity] || Boolean(isUploading[entity]) || isRunning}
                  >
                    {isUploading[entity] ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4 mr-2" />
                    )}
                    Importar (substituir)
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => uploadEntity(entity, false)}
                    disabled={!files[entity] || Boolean(isUploading[entity]) || isRunning}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Importar (somar)
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={runMigration}
              disabled={!ready || isRunning || Object.values(isUploading).some(Boolean)}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar migração
            </Button>

            <Button
              variant="outline"
              onClick={clearAllStaging}
              disabled={isRunning || Object.values(isUploading).some(Boolean)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar staging
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
