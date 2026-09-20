import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Info } from "lucide-react";
import { IconButton } from "@/components/panel/PanelBits";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStudentTopics } from "@/hooks/useStudentTopics";
import type { PanelStudent } from "@/hooks/useTeacherPanel";
import type { Resource, Topic } from "@/lib/types";
import { LessonRail } from "./LessonRail";
import { TopicList } from "./TopicList";

interface StudentWorkspaceProps {
  student: PanelStudent;
  teacherId: string;
  unreadHomeworkCount: number;
  /** Ödev listesi — yükleme de onun dibindeki düğmeden yapılıyor. */
  onOpenHomework: () => void;
  onOpenAbout: () => void;
  onLessonToggled: (lessonId: string, completed: boolean) => void;
  onRefresh: () => void;
  /** Ödev diyaloğu kapandıkça artar — orada silinen kaynak ödevi burada da sönsün. */
  homeworkRevision?: number;
  /** Masaüstünde başlık kartı, mobilde ekran başlığı zaten var. */
  showHeaderCard?: boolean;
}

/**
 * Seçili öğrencinin çalışma alanı: başlık kartı (ilerleme halkası + eylemler),
 * salt okunur "hakkında" notu, paket ders rayı ve konu listesi.
 */
export function StudentWorkspace({
  student,
  teacherId,
  unreadHomeworkCount,
  onOpenHomework,
  onOpenAbout,
  onLessonToggled,
  onRefresh,
  homeworkRevision = 0,
  showHeaderCard = true,
}: StudentWorkspaceProps) {
  const { toast } = useToast();
  const { allTopics, loading, refetch, mutate } = useStudentTopics(student.userId);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /** Bu öğretmenin bu öğrenciye ödev olarak verdiği kaynaklar. */
  const [homeworkIds, setHomeworkIds] = useState<Set<string>>(() => new Set());
  /** Yanıtı beklenen işaretler — aynı düğmeye art arda basılırsa ikincisi yutulur. */
  const pending = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("homework_submissions")
      .select("resource_id")
      .eq("student_id", student.userId)
      .eq("teacher_id", teacherId)
      .not("resource_id", "is", null)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setHomeworkIds(new Set(data.map((row) => row.resource_id as string)));
      });
    return () => {
      cancelled = true;
    };
  }, [student.userId, teacherId, homeworkRevision]);

  const pct = student.totalCount > 0 ? Math.round((student.completedCount / student.totalCount) * 100) : 0;

  const ringStyle = useMemo(
    () => ({
      background: `conic-gradient(var(--ewd-purple) 0turn ${pct / 100}turn, var(--ewd-lilac) ${pct / 100}turn 1turn)`,
    }),
    [pct],
  );

  /*
   * İşaretlemeler iyimser: ekran hemen değişir, istek arkadan gider, hata
   * olursa eski hâl geri yazılır. Eskiden her işaretten sonra liste sunucudan
   * yeniden okunuyor, okuma sırasında da iskelete dönüyordu — tek bir kaynağı
   * işaretlemek bütün ekranı "gidip getiriyordu".
   */
  const toggleResource = useCallback(
    async (topic: Topic, resource: Resource) => {
      const key = `done:${resource.id}`;
      if (pending.current.has(key)) return;
      pending.current.add(key);

      const next = !resource.is_completed;
      const stamp = next ? new Date().toISOString() : null;
      const apply = (done: boolean, at: string | null) =>
        mutate((prev) =>
          prev.map((t) => {
            if (t.id !== topic.id) return t;
            const resources = t.resources.map((r) =>
              r.id === resource.id ? { ...r, is_completed: done, completed_at: at } : r,
            );
            // Global konunun kendi "işlendi"si yok; kaynaklarından türer.
            if (!t.isGlobal) return { ...t, resources };
            const allDone = resources.length > 0 && resources.every((r) => r.is_completed);
            return { ...t, resources, is_completed: allDone, completed_at: allDone ? at : null };
          }),
        );

      apply(next, stamp);
      try {
        const { error } = await supabase.from("student_resource_completion").upsert(
          {
            student_id: student.userId,
            resource_id: resource.id,
            is_completed: next,
            completed_at: stamp,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,resource_id" },
        );
        if (error) throw error;
      } catch (error) {
        apply(!next, resource.completed_at ?? null);
        toast({
          title: "Hata",
          description: error instanceof Error ? error.message : "Kaynak güncellenemedi",
          variant: "destructive",
        });
      } finally {
        pending.current.delete(key);
      }
    },
    [student.userId, mutate, toast],
  );

  const toggleTopic = useCallback(
    async (topic: Topic) => {
      // Global konunun kendi satırı öğrenciye ait değil; tamamlanma durumu
      // kaynak kaynak tutulur. Kaynağı yoksa işaretlenecek bir şey de yok.
      if (topic.isGlobal && topic.resources.length === 0) return;

      const key = `topic:${topic.id}`;
      if (pending.current.has(key)) return;
      pending.current.add(key);

      const next = !topic.is_completed;
      const stamp = next ? new Date().toISOString() : null;

      mutate((prev) =>
        prev.map((t) => {
          if (t.id !== topic.id) return t;
          const resources = t.isGlobal
            ? t.resources.map((r) => ({ ...r, is_completed: next, completed_at: stamp }))
            : t.resources;
          return { ...t, resources, is_completed: next, completed_at: stamp };
        }),
      );

      try {
        if (topic.isGlobal) {
          // Tek istekte hepsini yaz.
          const { error } = await supabase.from("student_resource_completion").upsert(
            topic.resources.map((r) => ({
              student_id: student.userId,
              resource_id: r.id,
              is_completed: next,
              completed_at: stamp,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "student_id,resource_id" },
          );
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("topics")
            .update({ is_completed: next, completed_at: stamp })
            .eq("id", topic.id);
          if (error) throw error;
        }
      } catch (error) {
        // Konuyu işaretlemeden önceki hâliyle geri koy.
        mutate((prev) => prev.map((t) => (t.id === topic.id ? topic : t)));
        toast({
          title: "Hata",
          description: error instanceof Error ? error.message : "Konu güncellenemedi",
          variant: "destructive",
        });
      } finally {
        pending.current.delete(key);
      }
    },
    [student.userId, mutate, toast],
  );

  /**
   * Kaynağı ödev olarak verir / geri alır.
   *
   * Ödev satırı `homework_submissions`a yazılır: öğrenci kaynağı "Konularım"da
   * değil "Ödevlerim"de görür, bildirim ve anlık bildirim de yüklenen ödevle
   * aynı yoldan (tablonun tetikleyicisi) gider. "İşlendi" işaretinden
   * bağımsızdır; ikisi birlikte de açık olabilir.
   */
  const toggleHomework = useCallback(
    async (topic: Topic, resource: Resource) => {
      const key = `hw:${resource.id}`;
      if (pending.current.has(key)) return;
      pending.current.add(key);

      const next = !homeworkIds.has(resource.id);
      const apply = (on: boolean) =>
        setHomeworkIds((prev) => {
          const copy = new Set(prev);
          if (on) copy.add(resource.id);
          else copy.delete(resource.id);
          return copy;
        });

      apply(next);
      try {
        if (next) {
          const { error } = await supabase.from("homework_submissions").insert({
            batch_id: crypto.randomUUID(),
            student_id: student.userId,
            teacher_id: teacherId,
            resource_id: resource.id,
            title: resource.title,
            description: topic.title,
            file_url: resource.resource_url,
            file_type: `resource/${resource.resource_type || "other"}`,
            file_name: resource.title,
          });
          // 23505: başka sekmede zaten verilmiş — istenen durum bu, hata değil.
          if (error && error.code !== "23505") throw error;
        } else {
          const { error } = await supabase
            .from("homework_submissions")
            .delete()
            .eq("student_id", student.userId)
            .eq("teacher_id", teacherId)
            .eq("resource_id", resource.id);
          if (error) throw error;
        }
      } catch (error) {
        apply(!next);
        toast({
          title: "Hata",
          description: error instanceof Error ? error.message : "Ödev güncellenemedi",
          variant: "destructive",
        });
      } finally {
        pending.current.delete(key);
      }
    },
    [student.userId, teacherId, homeworkIds, toast],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <div className="pnl-card pnl-card--lg p-4 md:p-5">
        {showHeaderCard && (
          /* Tek satır: halka · ad · "Hakkında" · "Ödevler" (en sağda).
             Eskiden "Ödevler" adın ALTINDA ayrı bir satırdı; ondan önce de
             tam genişlikte üç düğmelik bir panoydu. Yükleme ödev kartının
             dibinde (HomeworkListDialog `allowUpload`).
             Telefonda halka yok: aynı bilgiyi hemen altındaki ders rayı
             veriyor, 64px'lik halka ise ada 50px bırakıp "Elif Nu…" diye
             kırptırıyordu. Ad yine de sığmazsa iki satıra sarar. */
          <div className="flex items-center gap-2.5 md:gap-3.5">
            <span className="pnl-ring pnl-ring--sm max-md:hidden" style={ringStyle} aria-hidden="true">
              <span className="pnl-ring__inner">%{pct}</span>
            </span>

            <h2
              className="line-clamp-2 min-w-0 flex-1 break-words text-[16px] font-extrabold leading-tight tracking-[-0.01em] md:line-clamp-1 md:text-[20px]"
              style={{ color: "var(--ewd-on-surface)" }}
            >
              {student.name}
            </h2>

            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              <IconButton
                label={`${student.name} hakkında`}
                className="h-8 w-8 rounded-xl border-0 md:h-9 md:w-9"
                style={{ background: "var(--ewd-lilac-tint)", color: "var(--ewd-purple)" }}
                onClick={onOpenAbout}
              >
                <Info className="h-4 w-4" />
              </IconButton>
              {/* Telefonda ikon yok, yan boşluk dar: ada yer kalsın. */}
              <button
                type="button"
                className="pnl-btn pnl-btn--outline pnl-btn--sm max-md:px-3"
                onClick={onOpenHomework}
              >
                <BookOpen className="hidden h-4 w-4 md:block" aria-hidden />
                Ödevler
                {unreadHomeworkCount > 0 && (
                  <span className="pnl-btn__count" aria-label={`${unreadHomeworkCount} yeni`}>
                    {unreadHomeworkCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        <div className={showHeaderCard ? "mt-4" : ""}>
          {/* İlerleme çubuğu burada yok: masaüstünde ilerleme halkası, her
              yerde de ders rayının kendisi aynı bilgiyi zaten veriyor. */}
          <LessonRail
            student={student}
            teacherId={teacherId}
            onLessonToggled={onLessonToggled}
            onRefresh={onRefresh}
          />
        </div>
      </div>

      <TopicList
        topics={allTopics}
        loading={loading}
        editable
        homeworkIds={homeworkIds}
        onToggleTopic={toggleTopic}
        onToggleResource={toggleResource}
        onToggleHomework={toggleHomework}
      />
    </div>
  );
}
