/**
 * Öğrenci konularının tek okuma yolu.
 *
 * "öğrenciye özel konular + global konular + tamamlanma durumu → birleştir"
 * kalıbı üç yerde ayrı ayrı yazılmıştı (öğretmen paneli, öğrenci paneli,
 * admin paneli) ve zamanla birbirinden ayrıştı. Artık tek kaynak burada;
 * `useStudentTopics` ve admin paneli aynı fonksiyonu çağırır.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Branch } from "./branch";
import type { Resource, Topic } from "./types";

export interface StudentTopicsResult {
  /** Öğrenciye özel + global, sıralı. */
  all: Topic[];
  /** Yalnızca öğrenciye özel konular (admin/öğretmen CRUD'u için). */
  own: Topic[];
}

/**
 * @param knownBranch Öğrencinin dil şubesi biliniyorsa geçin — bilinmiyorsa
 *   profilden okunur ve bu bir ağ turu daha demektir. Öğrenci paneli kendi
 *   profilini zaten elinde tuttuğu için oradan geçiriliyor.
 */
export async function loadStudentTopics(
  studentUserId: string,
  knownBranch?: Branch,
): Promise<StudentTopicsResult> {
  // Global müfredat dil şubesine göre ayrıldı: Fransızca öğrenciye İngilizce
  // konuları görünmemeli. RLS öğretmen/öğrenci için bunu zaten kapatıyor, ama
  // admin iki şubeyi de okuyabildiği için filtre burada da gerekli.
  let branch: Branch;
  if (knownBranch) {
    branch = knownBranch;
  } else {
    const { data: studentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("language")
      .eq("user_id", studentUserId)
      .single();
    if (profileError) throw profileError;
    branch = studentProfile?.language ?? "en";
  }

  const [studentTopicsRes, globalTopicsRes, completionRes] = await Promise.all([
    supabase.from("topics").select("*, resources (*)").eq("student_id", studentUserId).order("order_index"),
    supabase
      .from("global_topics")
      .select("*, global_topic_resources(*)")
      .eq("language", branch)
      .order("order_index"),
    supabase.from("student_resource_completion").select("*").eq("student_id", studentUserId),
  ]);

  if (studentTopicsRes.error) throw studentTopicsRes.error;
  if (globalTopicsRes.error) throw globalTopicsRes.error;
  if (completionRes.error) throw completionRes.error;

  const completion = new Map<string, { is_completed: boolean; completed_at: string | null }>();
  for (const row of completionRes.data ?? []) {
    completion.set(row.resource_id, {
      is_completed: row.is_completed,
      completed_at: row.completed_at,
    });
  }

  const toResource = (r: {
    id: string;
    title: string;
    description: string | null;
    resource_type: string;
    resource_url: string;
    order_index: number;
  }): Resource => {
    const done = completion.get(r.id);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      resource_type: r.resource_type,
      resource_url: r.resource_url,
      order_index: r.order_index,
      is_completed: done?.is_completed ?? false,
      completed_at: done?.completed_at ?? null,
    };
  };

  const own: Topic[] = (studentTopicsRes.data ?? []).map((topic) => ({
    id: topic.id,
    title: topic.title,
    description: topic.description,
    is_completed: topic.is_completed,
    completed_at: topic.completed_at,
    order_index: topic.order_index,
    isGlobal: false,
    resources: ((topic.resources as Parameters<typeof toResource>[0][]) ?? [])
      .map(toResource)
      .sort((a, b) => a.order_index - b.order_index),
  }));

  // Aynı başlıklı global konu, öğrenciye özel olanla çakışmasın.
  const ownTitles = new Set(own.map((t) => t.title));

  const global: Topic[] = (globalTopicsRes.data ?? [])
    .filter((topic) => !ownTitles.has(topic.title))
    .map((topic) => {
      const resources = ((topic.global_topic_resources as Parameters<typeof toResource>[0][]) ?? [])
        .map(toResource)
        .sort((a, b) => a.order_index - b.order_index);
      const allDone = resources.length > 0 && resources.every((r) => r.is_completed);
      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        is_completed: allDone,
        completed_at: allDone ? new Date().toISOString() : null,
        // Global konular listenin sonunda kalsın.
        order_index: topic.order_index + 1000,
        resources,
        isGlobal: true,
      };
    });

  const all = [...own, ...global].sort((a, b) => {
    if (a.isGlobal !== b.isGlobal) return a.isGlobal ? 1 : -1;
    return a.order_index - b.order_index;
  });

  return { all, own };
}
