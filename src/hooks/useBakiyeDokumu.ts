/**
 * Bakiye dökümü — özet + bu dönemde bakiyeye yazılan dersler, canlı.
 *
 * Öğretmenin "Bakiyem" diyaloğu ile adminin ödemeler sekmesi aynı kaynaktan
 * beslenir: `rpc_bakiye_dokumu`. Özet ile liste tek çağrıda, tek anlık
 * görüntüden geldiği için ekranda biri ötekinden bayat kalamaz.
 *
 * Canlılık defterin kendisinden: `balance_events`'e düşen her satır (ders
 * işlendi, geri alındı, deneme, manuel dakika, ödeme) dökümü yeniden çeker.
 * Defter yalnızca ekleme aldığı için INSERT'i dinlemek yeter. Telefon uykudan
 * dönünce kaçan olaylar için ön plana gelişte de tazelenir.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppResume } from "@/hooks/usePanelPlatform";
import { hataGoster } from "@/lib/notify";

export interface BakiyeOzeti {
  total_minutes: number;
  completed_regular_lessons: number;
  completed_trial_lessons: number;
  regular_lessons_minutes: number;
  trial_lessons_minutes: number;
}

export interface BakiyeDersi {
  id: string;
  /** Bakiyeye yazılan kaçıncı ders. Önceki dönemde ödenmiş bir dersin geri alınmasıysa `null`. */
  sira: number | null;
  tur: "ders" | "deneme";
  /** Öğrenci ya da aday adı; kayıt silinmişse `null`. */
  ad: string | null;
  /** yyyy-MM-dd */
  tarih: string;
  /** HH:MM — ders kaydı silinmişse `null`. */
  bas: string | null;
  bit: string | null;
  dakika: number;
}

export interface BakiyeDokumu {
  bakiye: BakiyeOzeti;
  /** Açılıştan devreden, listede satırı olmayan ders sayısı. İlk ödemeyle sıfırlanır. */
  devir: number;
  /** Yeniden eskiye. */
  dersler: BakiyeDersi[];
}

type DokumCevabi = BakiyeDokumu & { success: boolean; error?: string };

export function useBakiyeDokumu(teacherId: string) {
  const [dokum, setDokum] = useState<BakiyeDokumu | null>(null);
  /** Ödeme kapatıldıkça artar — ödeme geçmişini gösteren ekran buna bakıp tazeler. */
  const [odemeSayaci, setOdemeSayaci] = useState(0);
  const sonIstek = useRef(0);

  const yenile = useCallback(async () => {
    if (!teacherId) return;
    // Arka arkaya iki olay iki istek doğurur; geç dönen eski cevap yenisini ezmesin.
    const istek = ++sonIstek.current;
    try {
      const { data, error } = await supabase.rpc("rpc_bakiye_dokumu", { p_teacher_id: teacherId });
      if (error) throw error;
      if (istek !== sonIstek.current) return;
      const cevap = data as unknown as DokumCevabi;
      if (!cevap.success) throw new Error(cevap.error);
      setDokum({ bakiye: cevap.bakiye, devir: cevap.devir, dersler: cevap.dersler });
    } catch (error) {
      if (istek === sonIstek.current) hataGoster(error, "Bakiye bilgisi yüklenemedi");
    }
  }, [teacherId]);

  useEffect(() => {
    if (!teacherId) return;
    setDokum(null);
    yenile();

    const channel = supabase
      .channel(`bakiye-dokumu-${teacherId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "balance_events", filter: `teacher_id=eq.${teacherId}` },
        (payload) => {
          yenile();
          if ((payload.new as { event_type?: string }).event_type === "payout") setOdemeSayaci((n) => n + 1);
        },
      )
      .subscribe();

    return () => {
      // Bekleyen cevap, değişen öğretmenin dökümünün üstüne yazmasın.
      sonIstek.current += 1;
      supabase.removeChannel(channel);
    };
  }, [teacherId, yenile]);

  useAppResume(yenile);

  return { dokum, yenile, odemeSayaci };
}
