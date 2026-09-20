/**
 * useStudentTopics — "öğrenci konularını getir" kalıbının hook'u.
 * Okuma mantığı `@/lib/topicsService` içinde; burada yalnızca durum yönetimi var.
 */
import { useCallback, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { loadStudentTopics } from "@/lib/topicsService";
import type { Branch } from "@/lib/branch";
import type { Topic } from "@/lib/types";

interface UseStudentTopicsReturn {
  /** Öğrenciye özel + global konular, sıralı. */
  allTopics: Topic[];
  /** Yalnızca öğrenciye özel konular (CRUD için). */
  studentOnlyTopics: Topic[];
  loading: boolean;
  refetch: () => Promise<void>;
  /**
   * Listeyi yerinde değiştirir — işaretleme gibi tek satırlık değişikliklerde
   * sunucudan yeniden okumak yerine. Hata olursa çağıran eski hâli geri yazar.
   */
  mutate: (updater: (prev: Topic[]) => Topic[]) => void;
}

/**
 * @param knownBranch Bilinen dil şubesi — geçilirse konu sorgusu bir tur
 *   erken başlar (profil okuması atlanır).
 */
export function useStudentTopics(
  studentUserId: string | undefined,
  knownBranch?: Branch,
): UseStudentTopicsReturn {
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [studentOnlyTopics, setStudentOnlyTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  /** Ekrandaki liste hangi öğrencinin — iskelet yalnızca öğrenci değişince. */
  const loadedFor = useRef<string | null>(null);
  /** Geç dönen eski yanıt yenisinin üstüne yazmasın. */
  const requestSeq = useRef(0);

  const refetch = useCallback(async () => {
    if (!studentUserId) return;

    // İskelet yalnızca ilk yüklemede ve öğrenci değişince (önceki öğrencinin
    // konuları ekranda kalmasın). Aynı öğrenci için yeniden okuma sessizdir:
    // her okumada `loading` açılınca liste iskelete dönüp geri geliyor,
    // ekran "gidip geliyordu".
    if (loadedFor.current !== studentUserId) setLoading(true);

    const seq = ++requestSeq.current;
    try {
      const { all, own } = await loadStudentTopics(studentUserId, knownBranch);
      if (seq !== requestSeq.current) return;
      loadedFor.current = studentUserId;
      setAllTopics(all);
      setStudentOnlyTopics(own);
    } catch {
      if (seq !== requestSeq.current) return;
      toast({
        title: "Hata",
        description: "Konular yüklenemedi",
        variant: "destructive",
      });
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [studentUserId, knownBranch, toast]);

  const mutate = useCallback((updater: (prev: Topic[]) => Topic[]) => {
    // Yoldaki bir okuma, yerinde yapılan değişikliği eski veriyle ezmesin.
    requestSeq.current++;
    setLoading(false);
    setAllTopics(updater);
  }, []);

  return { allTopics, studentOnlyTopics, loading, refetch, mutate };
}
