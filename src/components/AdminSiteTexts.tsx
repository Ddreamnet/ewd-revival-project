// ============================================================================
// ADMİN — SİTE METİNLERİ
// ============================================================================
// Landing sayfasındaki her metin alanı `@/lib/translations` sözlüğünde bir yol
// ile duruyor (örn. "hero.title"). Bu ekran o yolları gezip düzenlenebilir
// kutulara çevirir; kaydedilen değer `site_content` tablosuna yazılır ve siteyi
// besleyen katman onu varsayılanın üstüne bindirir.
//
// "Sıfırla" satırı tablodan siler; alan koddaki varsayılan metnine döner.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { hataGoster } from "@/lib/notify";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, Save, Search } from "lucide-react";
import {
  buildEditableSections,
  isLocalized,
  type EditableField,
  type LocalizedValue,
} from "@/lib/siteContent";
import { LANGUAGES } from "@/lib/translations";

interface Props {
  onChanged: () => void;
}

export function AdminSiteTexts({ onChanged }: Props) {
  const sections = useMemo(() => buildEditableSections(), []);
  const [activeSection, setActiveSection] = useState(sections[0]?.key ?? "");
  const [overrides, setOverrides] = useState<Record<string, LocalizedValue>>({});
  const [drafts, setDrafts] = useState<Record<string, LocalizedValue>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchOverrides = useCallback(async () => {
    const { data, error } = await supabase.from("site_content").select("key, value");
    if (error) {
      toast({ title: "Hata", description: "Kayıtlı metinler yüklenemedi", variant: "destructive" });
    } else {
      const map: Record<string, LocalizedValue> = {};
      for (const row of data ?? []) {
        if (isLocalized(row.value)) map[row.key] = row.value;
      }
      setOverrides(map);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  /** Bir alanın o anki gösterilecek değeri: taslak › kayıtlı › varsayılan. */
  const valueOf = (field: EditableField): LocalizedValue =>
    drafts[field.path] ?? overrides[field.path] ?? field.fallback;

  const section = sections.find((s) => s.key === activeSection);
  const needle = query.trim().toLocaleLowerCase("tr");

  const visibleFields = useMemo(() => {
    if (!needle) return section?.fields ?? [];
    // Arama bütün bölümleri tarar; kullanıcı hangi bölümde olduğunu bilmek
    // zorunda kalmasın.
    return sections
      .flatMap((s) => s.fields)
      .filter(
        (field) =>
          field.path.toLocaleLowerCase("tr").includes(needle) ||
          field.label.toLocaleLowerCase("tr").includes(needle) ||
          field.fallback.tr.toLocaleLowerCase("tr").includes(needle),
      )
      .slice(0, 80);
  }, [needle, section, sections]);

  const dirtyPaths = Object.keys(drafts);

  const saveAll = async () => {
    if (dirtyPaths.length === 0) return;
    setSaving(true);

    const { data: session } = await supabase.auth.getUser();
    const rows = dirtyPaths.map((path) => ({
      key: path,
      value: drafts[path] as unknown as never,
      updated_by: session.user?.id ?? null,
    }));

    const { error } = await supabase.from("site_content").upsert(rows, { onConflict: "key" });
    setSaving(false);

    if (error) {
      hataGoster(error, "İşlem tamamlanamadı");
      return;
    }
    toast({ title: "Kaydedildi", description: `${rows.length} alan güncellendi` });
    setDrafts({});
    await fetchOverrides();
    onChanged();
  };

  const reset = async (path: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    if (!overrides[path]) return;

    const { error } = await supabase.from("site_content").delete().eq("key", path);
    if (error) {
      hataGoster(error, "İşlem tamamlanamadı");
      return;
    }
    await fetchOverrides();
    onChanged();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Metinlerde ara (tüm bölümler)"
            className="pl-8"
          />
        </div>
        <Button onClick={saveAll} disabled={saving || dirtyPaths.length === 0}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Kaydet{dirtyPaths.length > 0 ? ` (${dirtyPaths.length})` : ""}
        </Button>
      </div>

      {!needle && (
        <div className="flex gap-1.5 overflow-x-auto border-b-2 border-[color:var(--ewd-line)] pb-3">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              className="ewd-tab whitespace-nowrap"
              data-active={activeSection === s.key}
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {visibleFields.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Eşleşen metin bulunamadı.</p>
      ) : (
        <div className="space-y-5">
          {visibleFields.map((field) => {
            const value = valueOf(field);
            const isEdited = Boolean(overrides[field.path]) || Boolean(drafts[field.path]);
            const Box = field.multiline ? Textarea : Input;

            return (
              <div key={field.path} className="space-y-2 rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{field.label}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{field.path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {drafts[field.path] && <Badge className="text-[10px]">Kaydedilmedi</Badge>}
                    {isEdited && (
                      <Button variant="ghost" size="sm" onClick={() => reset(field.path)}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Sıfırla
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {LANGUAGES.map((lang) => (
                    <div key={lang.code}>
                      <Label className="flex items-center gap-1.5 text-[11px] uppercase text-muted-foreground">
                        <img src={lang.flagIcon} alt="" aria-hidden="true" className="h-3 w-[18px] rounded-[2px] object-cover" />
                        {lang.label}
                      </Label>
                      <Box
                        rows={field.multiline ? 3 : undefined}
                        dir={lang.rtl ? "rtl" : undefined}
                        value={value[lang.code]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [field.path]: { ...valueOf(field), [lang.code]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {needle && visibleFields.length === 80 && (
        <p className="text-center text-xs text-muted-foreground">
          İlk 80 sonuç gösteriliyor — aramayı daraltın.
        </p>
      )}
    </div>
  );
}
