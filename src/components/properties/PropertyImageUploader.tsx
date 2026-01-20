import { useMemo, useRef, useState } from "react";
import { Upload, Star, Trash2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UploadedImage = {
  url: string;
  path: string;
  name: string;
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadToPropertyBucket(file: File, folderKey: string) {
  const ext = file.name.split(".").pop() || "bin";
  const base = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""));
  const uuid = crypto.randomUUID();
  const path = `properties/${folderKey}/${uuid}-${base}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("property-images")
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("property-images").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Falha ao obter URL pública da imagem");

  return {
    url: data.publicUrl,
    path,
    name: file.name,
  } satisfies UploadedImage;
}

export function PropertyImageUploader({
  folderKey,
  coverUrl,
  images,
  onChange,
  disabled,
}: {
  folderKey: string;
  coverUrl: string;
  images: string[];
  onChange: (next: { coverUrl: string; images: string[] }) => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const items = useMemo(() => {
    const list = images.filter(Boolean);
    // ensure cover is present in gallery list (optional)
    const normalized = coverUrl && !list.includes(coverUrl) ? [coverUrl, ...list] : list;
    return Array.from(new Set(normalized));
  }, [images, coverUrl]);

  const setCover = (url: string) => {
    onChange({ coverUrl: url, images: items.filter((u) => u !== url) });
  };

  const remove = (url: string) => {
    const nextItems = items.filter((u) => u !== url);
    const nextCover = coverUrl === url ? (nextItems[0] ?? "") : coverUrl;
    const nextImages = nextItems.filter((u) => u !== nextCover);
    onChange({ coverUrl: nextCover, images: nextImages });
  };

  const handlePick = () => inputRef.current?.click();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!folderKey) {
      toast({
        title: "Erro",
        description: "Código do imóvel não encontrado para organizar as fotos.",
        variant: "destructive",
      });
      return;
    }

    const files = Array.from(fileList);
    setIsUploading(true);

    try {
      const uploaded = await Promise.all(files.map((f) => uploadToPropertyBucket(f, folderKey)));
      const newUrls = uploaded.map((u) => u.url);

      const merged = Array.from(new Set([...items, ...newUrls]));
      const nextCover = coverUrl || merged[0] || "";
      const nextImages = merged.filter((u) => u !== nextCover);
      onChange({ coverUrl: nextCover, images: nextImages });

      toast({ title: "Fotos enviadas", description: `${uploaded.length} arquivo(s) enviado(s) com sucesso.` });
    } catch (e: any) {
      toast({
        title: "Falha no upload",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Fotos do imóvel *</p>
          <p className="text-xs text-muted-foreground">
            Envie a capa e as demais fotos. Depois você pode escolher qual é a imagem principal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || isUploading}
          />
          <Button type="button" variant="outline" className="gap-2" onClick={handlePick} disabled={disabled || isUploading}>
            <Upload className="h-4 w-4" />
            {isUploading ? "Enviando..." : "Enviar fotos"}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-6 text-center">
          <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nenhuma foto enviada</p>
          <p className="text-xs text-muted-foreground">Envie pelo menos 1 foto para salvar o imóvel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((url) => {
            const isCover = !!coverUrl && coverUrl === url;
            return (
              <div key={url} className="group relative overflow-hidden rounded-xl border border-border bg-secondary/20">
                <img
                  src={url}
                  alt={isCover ? "Capa do imóvel" : "Foto do imóvel"}
                  loading="lazy"
                  className="h-28 w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isCover ? "default" : "secondary"}
                    className={cn("h-8 px-2 gap-1", isCover && "pointer-events-none")}
                    onClick={() => setCover(url)}
                    disabled={disabled || isUploading}
                    title={isCover ? "Capa" : "Definir como capa"}
                  >
                    <Star className="h-3.5 w-3.5" />
                    <span className="text-xs">{isCover ? "Capa" : "Capa"}</span>
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={() => remove(url)}
                    disabled={disabled || isUploading}
                    title="Remover foto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        * A primeira foto marcada como capa será a imagem principal exibida no catálogo.
      </p>
    </div>
  );
}
