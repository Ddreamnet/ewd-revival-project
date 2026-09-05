// ============================================================================
// ADMİN — DERSTEN KARELER (FOTOĞRAF & VİDEO)
// ============================================================================
// Landing sayfasındaki "Dersten Kareler" bölümünü besleyen `site_moments`
// tablosunu ve `site-media` deposunu yönetir.
//
// Gizlilik: yüklenen görsel ve videolardaki yüzler, kamera kutucukları ve
// isimler dosyanın İÇİNE işlenmiş olmalıdır. Üste konan bir örtü tam ekranda
// ya da dosya adresine gidilince açığa çıkar.

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { hataGoster } from "@/lib/notify";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Trash2, Upload, Video } from "lucide-react";
import { LANGUAGES, type Language } from "@/lib/translations";

type MediaType = "photo" | "video";

/** `tag_tr`, `caption_tr`, … — her metin alanı dil başına bir sütun tutar. */
type LocalizedColumns = { [K in `tag_${Language}` | `caption_${Language}`]: string };

interface Moment extends LocalizedColumns {
  id: string;
  media_type: string;
  media_url: string;
  poster_url: string | null;
  order_index: number;
  is_published: boolean;
}

const ACCEPT: Record<MediaType, string> = {
  photo: "image/*",
  video: "video/mp4,video/webm",
};

interface Props {
  onChanged: () => void;
}

export function AdminSiteMoments({ onChanged }: Props) {
  const [rows, setRows] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<MediaType | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const posterFor = useRef<string | null>(null);
  const posterInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_moments")
      .select("*")
      .order("media_type")
      .order("order_index");

    if (error) {
      toast({ title: "Hata", description: "Kareler yüklenemedi", variant: "destructive" });
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const photos = rows.filter((r) => r.media_type === "photo");
  const videos = rows.filter((r) => r.media_type === "video");

  /** Dosyayı `site-media` deposuna koyar ve herkese açık adresini döndürür. */
  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("site-media").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
    });
    if (error) {
      hataGoster(error, "Dosya yüklenemedi");
      return null;
    }
    return supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: MediaType) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // Aynı dosya tekrar seçilebilsin.
    if (files.length === 0) return;

    setUploading(type);
    const siblings = type === "photo" ? photos : videos;
    let inserted = 0;

    for (const [i, file] of files.entries()) {
      const url = await uploadFile(file, type === "photo" ? "kareler" : "videolar");
      if (!url) continue;
      const { error } = await supabase.from("site_moments").insert({
        media_type: type,
        media_url: url,
        order_index: siblings.length + i,
        caption_tr: "",
        is_published: true,
      });
      if (error) {
        hataGoster(error, "İşlem tamamlanamadı");
        continue;
      }
      inserted += 1;
    }

    setUploading(null);
    if (inserted > 0) {
      toast({
        title: "Yüklendi",
        description: `${inserted} dosya eklendi. Açıklamalarını girmeyi unutmayın.`,
      });
      await fetchRows();
      onChanged();
    }
  };

  const handlePosterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const id = posterFor.current;
    event.target.value = "";
    if (!file || !id) return;

    setSavingId(id);
    const url = await uploadFile(file, "kapaklar");
    if (url) {
      await supabase.from("site_moments").update({ poster_url: url }).eq("id", id);
      await fetchRows();
      onChanged();
    }
    setSavingId(null);
  };

  /** Alan bazlı kaydetme — kutudan çıkınca (onBlur) yazılır. */
  const patch = async (id: string, patchValue: Partial<Moment>) => {
    setSavingId(id);
    const { error } = await supabase.from("site_moments").update(patchValue).eq("id", id);
    setSavingId(null);
    if (error) {
      hataGoster(error, "İşlem tamamlanamadı");
      return;
    }
    onChanged();
  };

  const remove = async (row: Moment) => {
    if (!confirm("Bu kareyi silmek istiyor musunuz?")) return;
    const { error } = await supabase.from("site_moments").delete().eq("id", row.id);
    if (error) {
      hataGoster(error, "İşlem tamamlanamadı");
      return;
    }
    // Depodaki dosya, aynı adresi kullanan başka bir kayıt olabileceği için
    // bilerek silinmiyor; depo temizliği elle yapılır.
    await fetchRows();
    onChanged();
  };

  const move = async (list: Moment[], index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    // Tek RPC: önceden liste uzunluğu kadar ayrı UPDATE gidiyordu (20 öğede
    // 20 istek) ve yarısı düşerse sıralama bozuk kalıyordu, geri alma yoktu.
    const { error } = await supabase.rpc("rpc_reorder_site_moments", {
      p_orders: reordered.map((row, i) => ({ id: row.id, order_index: i })),
    });
    if (error) {
      hataGoster(error, "Sıralama güncellenemedi");
      await fetchRows();
      return;
    }
    await fetchRows();
    onChanged();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderRow = (row: Moment, index: number, list: Moment[]) => (
    <Card key={row.id} className="space-y-3 p-3">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => move(list, index, -1)}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === list.length - 1}
            onClick={() => move(list, index, 1)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {row.media_type === "photo" ? (
            <img src={row.media_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <video src={row.media_url} poster={row.poster_url || undefined} muted className="h-full w-full object-cover" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={row.is_published ? "default" : "secondary"} className="text-xs">
              {row.is_published ? "Yayında" : "Gizli"}
            </Badge>
            {savingId === row.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <span className="truncate text-[11px] text-muted-foreground">{row.media_url.split("/").pop()}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {LANGUAGES.map((lang) => (
              <div key={lang.code}>
                <Label className="text-[11px] uppercase text-muted-foreground">
                  Açıklama {lang.label}
                </Label>
                <Input
                  dir={lang.rtl ? "rtl" : undefined}
                  defaultValue={row[`caption_${lang.code}`]}
                  placeholder={lang.code === "tr" ? "Zorunlu" : "Boşsa Türkçesi"}
                  onBlur={(e) => {
                    if (e.target.value !== row[`caption_${lang.code}`]) {
                      patch(row.id, { [`caption_${lang.code}`]: e.target.value } as Partial<Moment>);
                    }
                  }}
                />
              </div>
            ))}
          </div>

          {row.media_type === "photo" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {LANGUAGES.map((lang) => (
                <div key={lang.code}>
                  <Label className="text-[11px] uppercase text-muted-foreground">
                    Etiket {lang.label}
                  </Label>
                  <Input
                    dir={lang.rtl ? "rtl" : undefined}
                    defaultValue={row[`tag_${lang.code}`]}
                    placeholder="OYUN / QUİZ…"
                    onBlur={(e) => {
                      if (e.target.value !== row[`tag_${lang.code}`]) {
                        patch(row.id, { [`tag_${lang.code}`]: e.target.value } as Partial<Moment>);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {row.media_type === "video" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                posterFor.current = row.id;
                posterInput.current?.click();
              }}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              {row.poster_url ? "Kapak görselini değiştir" : "Kapak görseli yükle"}
            </Button>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          <Switch
            checked={row.is_published}
            onCheckedChange={(v) => {
              setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_published: v } : r)));
              patch(row.id, { is_published: v });
            }}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(row)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <strong>Gizlilik:</strong> yüklediğiniz fotoğraf ve videolarda öğrenci/öğretmen yüzleri ve isimleri
        dosyanın içine işlenmiş şekilde kapatılmış olmalıdır. Site üzerinde eklenen bir örtü, dosya adresine
        doğrudan gidildiğinde koruma sağlamaz.
      </p>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <ImageIcon className="h-4 w-4" /> Fotoğraflar ({photos.length})
          </h3>
          <Button onClick={() => photoInput.current?.click()} disabled={uploading !== null}>
            {uploading === "photo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Fotoğraf yükle
          </Button>
          <input
            ref={photoInput}
            type="file"
            accept={ACCEPT.photo}
            multiple
            hidden
            onChange={(e) => handleUpload(e, "photo")}
          />
        </div>
        {photos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz fotoğraf yok.</p>
        ) : (
          <div className="space-y-2">{photos.map((row, i) => renderRow(row, i, photos))}</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <Video className="h-4 w-4" /> Videolar ({videos.length})
          </h3>
          <Button onClick={() => videoInput.current?.click()} disabled={uploading !== null}>
            {uploading === "video" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Video yükle
          </Button>
          <input
            ref={videoInput}
            type="file"
            accept={ACCEPT.video}
            multiple
            hidden
            onChange={(e) => handleUpload(e, "video")}
          />
        </div>
        {videos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz video yok.</p>
        ) : (
          <div className="space-y-2">{videos.map((row, i) => renderRow(row, i, videos))}</div>
        )}
      </section>

      <input ref={posterInput} type="file" accept="image/*" hidden onChange={handlePosterUpload} />
    </div>
  );
}
