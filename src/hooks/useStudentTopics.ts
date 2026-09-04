/**
 * useStudentTopics — "öğrenci konularını getir" kalıbının hook'u.
 * Okuma mantığı `@/lib/topicsService` içinde; burada yalnızca durum yönetimi var.
 */
import { useCallback, useState } from "react";
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

  const refetch = useCallback(async () => {
    if (!studentUserId) return;

    // Öğrenci değişince önceki öğrencinin konuları ekranda kalmasın.
    setLoading(true);
    try {
      const { all, own } = await loadStudentTopics(studentUserId, knownBranch);
      setAllTopics(all);
      setStudentOnlyTopics(own);
    } catch {
      toast({
        title: "Hata",
        description: "Konular yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [studentUserId, knownBranch, toast]);

  return { allTopics, studentOnlyTopics, loading, refetch };
}
