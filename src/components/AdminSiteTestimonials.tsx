// ============================================================================
// ADMİN — VELİ YORUMLARI
// ============================================================================
// Landing sayfasındaki "Veli Yorumları" karuselini besleyen `site_testimonials`
// tablosunu yönetir. Yayından kaldırılan yorum tabloda kalır, sitede görünmez.

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { hataGoster } from "@/lib/notify";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { CONTENT_LANGUAGES, emptyLocalized, type LocalizedValue } from "@/lib/siteContent";
import { LANGUAGES, type Language } from "@/lib/translations";

/** `quote_tr`, `quote_en`, … — dil başına bir sütun. */
type QuoteColumns = { [K in `quote_${Language}`]: string };

interface Testimonial extends QuoteColumns {
  id: string;
  tags: LocalizedValue[];
  author_label: string | null;
  order_index: number;
  is_published: boolean;
}

/** Bütün dilleri boş bırakan yeni kayıt taslağı. */
const emptyDraft = (): Omit<Testimonial, "id" | "order_index"> => ({
  ...(Object.fromEntries(CONTENT_LANGUAGES.map((code) => [`quote_${code}`, ""])) as QuoteColumns),
  tags: [],
  author_label: "",
  is_published: true,
});

interface Props {
  /** Kaydetme sonrası açık duran landing sekmesinin tazelenmesi için. */
  onChanged: () => void;
}

export function AdminSiteTestimonials({ onChanged }: Props) {
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const { toast } = useToast();

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_testimonials")
      .select("*")
      .order("order_index");

    if (error) {
      toast({ title: "Hata", description: "Yorumlar yüklenemedi", variant: "destructive" });
    } else {
      setRows(
        (data ?? []).map((row) => ({
          ...row,
          tags: Array.isArray(row.tags) ? (row.tags as unknown as LocalizedValue[]) : [],
        })),
      );
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId("new");
  };

  const startEdit = (row: Testimonial) => {
    setDraft({
      ...(Object.fromEntries(
        CONTENT_LANGUAGES.map((code) => [`quote_${code}`, row[`quote_${code}`]]),
      ) as QuoteColumns),
      tags: row.tags,
      author_label: row.author_label ?? "",
      is_published: row.is_published,
    });
    setEditingId(row.id);
  };

  const save = async () => {
    if (!draft.quote_tr.trim()) {
      toast({ title: "Hata", description: "Türkçe yorum metni zorunlu", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      ...(Object.fromEntries(
        CONTENT_LANGUAGES.map((code) => [`quote_${code}`, draft[`quote_${code}`].trim()]),
      ) as QuoteColumns),
      tags: draft.tags.filter((tag) => tag.tr.trim()) as unknown as never,
      author_label: draft.author_label?.trim() || null,
      is_published: draft.is_published,
    };

    const { error } =
      editingId === "new"
        ? await supabase
            .from("site_testimonials")
            .insert({ ...payload, order_index: rows.length })
        : await supabase.from("site_testimonials").update(payload).eq("id", editingId!);

    setSaving(false);
    if (error) {
      hataGoster(error, "İşlem tamamlanamadı");
      return;
    }
    toast({ title: "Kaydedildi", description: "Veli yorumu güncellendi" });
    setEditingId(null);
    await fetchRows();
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("Bu yorumu kalıcı olarak silmek istiyor musunuz?")) return;
    const { error } = await supabase.from("site_testimonials").delete().eq("id", id);
    if (error) {
      hataGoster(error, "İşlem tamamlanamadı");
      return;
    }
    await fetchRows();
    onChanged();
  };

  const togglePublished = async (row: Testimonial) => {
    const { error } = await supabase
      .from("site_testimonials")
      .update({ is_published: !row.is_published })
      .eq("id", row.id);
    if (error) {
      hataGoster(error, "İşlem tamamlanamadı");
      return;
    }
    await fetchRows();
    onChanged();
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setRows(reordered); // İyimser sıralama — istek dönmeden liste yerine oturur.
    // Tek RPC: önceden liste uzunluğu kadar ayrı UPDATE gidiyordu (20 öğede
    // 20 istek) ve yarısı düşerse sıralama bozuk kalıyordu, geri alma yoktu.
    const { error } = await supabase.rpc("rpc_reorder_site_testimonials", {
      p_orders: reordered.map((row, i) => ({ id: row.id, order_index: i })),
    });
    if (error) hataGoster(error, "Sıralama güncellenemedi");
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

  if (editingId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{editingId === "new" ? "Yeni veli yorumu" : "Yorumu düzenle"}</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
            <X className="mr-1 h-4 w-4" /> Vazgeç
          </Button>
        </div>

        <div className="space-y-3">
          {LANGUAGES.map((lang) => (
            <div key={lang.code}>
              <Label>
                Yorum — {lang.nameTr}
                {lang.code === "tr" ? " *" : ""}
              </Label>
              <Textarea
                rows={lang.code === "tr" ? 5 : 4}
                dir={lang.rtl ? "rtl" : undefined}
                value={draft[`quote_${lang.code}`]}
                onChange={(e) => setDraft({ ...draft, [`quote_${lang.code}`]: e.target.value })}
                placeholder={lang.code === "tr" ? "Velinin mesajı" : "Boş bırakılırsa Türkçesi gösterilir"}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Etiketler</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft({ ...draft, tags: [...draft.tags, emptyLocalized()] })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Etiket ekle
            </Button>
          </div>
          {draft.tags.length === 0 && (
            <p className="text-xs text-muted-foreground">Etiket zorunlu değil.</p>
          )}
          {draft.tags.map((tag, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2">
              {LANGUAGES.map((lang) => (
                <Input
                  key={lang.code}
                  className="min-w-[130px] flex-1"
                  dir={lang.rtl ? "rtl" : undefined}
                  value={tag[lang.code]}
                  placeholder={lang.label}
                  onChange={(e) => {
                    const tags = [...draft.tags];
                    tags[i] = { ...tags[i], [lang.code]: e.target.value };
                    setDraft({ ...draft, tags });
                  }}
                />
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive"
                onClick={() => setDraft({ ...draft, tags: draft.tags.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={draft.is_published}
            onCheckedChange={(v) => setDraft({ ...draft, is_published: v })}
          />
          <span className="text-sm">{draft.is_published ? "Sitede yayında" : "Yayında değil"}</span>
        </div>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Kaydet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Karuseldeki sıra buradaki sıradır. Yayından kaldırılan yorum silinmez, yalnızca sitede görünmez.
        </p>
        <Button onClick={startNew}>
          <Plus className="mr-2 h-4 w-4" /> Yeni yorum
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Henüz veli yorumu eklenmemiş.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <Card key={row.id} className="flex items-start gap-3 p-3">
              <div className="flex shrink-0 flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={row.is_published ? "default" : "secondary"} className="text-xs">
                    {row.is_published ? "Yayında" : "Gizli"}
                  </Badge>
                  {row.tags.map((tag, i) => (
                    <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                      {tag.tr}
                    </span>
                  ))}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{row.quote_tr}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Switch checked={row.is_published} onCheckedChange={() => togglePublished(row)} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(row.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
