import { useCallback, useEffect, useMemo } from "react";
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
  onUploadHomework: () => void;
  onOpenHomework: () => void;
  onOpenAbout: () => void;
  onLessonToggled: (lessonId: string, completed: boolean) => void;
  onRefresh: () => void;
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
  onUploadHomework,
  onOpenHomework,
  onOpenAbout,
  onLessonToggled,
  onRefresh,
  showHeaderCard = true,
}: StudentWorkspaceProps) {
  const { toast } = useToast();
  const { allTopics, loading, refetch } = useStudentTopics(student.userId);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const pct = student.totalCount > 0 ? Math.round((student.completedCount / student.totalCount) * 100) : 0;

  const ringStyle = useMemo(
    () => ({
      background: `conic-gradient(var(--ewd-purple) 0turn ${pct / 100}turn, var(--ewd-lilac) ${pct / 100}turn 1turn)`,
    }),
    [pct],
  );

  const toggleResource = useCallback(
    async (_topic: Topic, resource: Resource) => {
      const next = !resource.is_completed;
      try {
        const { error } = await supabase.from("student_resource_completion").upsert(
          {
            student_id: student.userId,
            resource_id: resource.id,
            is_completed: next,
            completed_at: next ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,resource_id" },
        );
        if (error) throw error;
        refetch();
      } catch (error) {
        toast({
          title: "Hata",
          description: error instanceof Error ? error.message : "Kaynak güncellenemedi",
          variant: "destructive",
        });
      }
    },
    [student.userId, refetch, toast],
  );

  const toggleTopic = useCallback(
    async (topic: Topic) => {
      const next = !topic.is_completed;
      try {
        if (topic.isGlobal) {
          // Global konunun kendi satırı öğrenciye ait değil; tamamlanma
          // durumu kaynak kaynak tutulur. Tek istekte hepsini yaz.
          if (topic.resources.length === 0) return;
          const { error } = await supabase.from("student_resource_completion").upsert(
            topic.resources.map((r) => ({
              student_id: student.userId,
              resource_id: r.id,
              is_completed: next,
              completed_at: next ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "student_id,resource_id" },
          );
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("topics")
            .update({
              is_completed: next,
              completed_at: next ? new Date().toISOString() : null,
            })
            .eq("id", topic.id);
          if (error) throw error;
        }
        refetch();
      } catch (error) {
        toast({
          title: "Hata",
          description: error instanceof Error ? error.message : "Konu güncellenemedi",
          variant: "destructive",
        });
      }
    },
    [student.userId, refetch, toast],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <div className="pnl-card pnl-card--lg p-4 md:p-5">
        {showHeaderCard && (
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-5">
            <div className="flex items-center gap-4 md:gap-4">
              <span className="pnl-ring" style={ringStyle} aria-hidden="true">
                <span className="pnl-ring__inner">%{pct}</span>
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h2
                  className="truncate text-2xl font-black tracking-[-0.02em] md:text-[24px]"
                  style={{ color: "var(--ewd-on-surface)" }}
                >
                  {student.name}
                </h2>
              </div>
            </div>

            <div className="pnl-actions md:flex-wrap md:justify-end">
              <button type="button" className="pnl-btn pnl-btn--purple" onClick={onUploadHomework}>
                Ödev yükle
              </button>
              <button type="button" className="pnl-btn pnl-btn--outline" onClick={onOpenHomework}>
                Ödevler
                {unreadHomeworkCount > 0 && <span className="pnl-btn__count">{unreadHomeworkCount}</span>}
              </button>
              <button type="button" className="pnl-btn pnl-btn--soft" onClick={onOpenAbout}>
                Hakkında
              </button>
            </div>
          </div>
        )}

        <div className={showHeaderCard ? "mt-5" : ""}>
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
        onToggleTopic={toggleTopic}
        onToggleResource={toggleResource}
      />
    </div>
  );
}
