import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Check, ChevronRight, ClipboardList } from "lucide-react";
import { EmptyState, SectionDivider } from "@/components/panel/PanelBits";
import type { PanelHomeworkGroup } from "@/hooks/useTeacherPanel";

interface HomeworkScreenProps {
  homework: PanelHomeworkGroup[];
  /** Bir gruba dokununca o öğrencinin ödev listesi açılır. */
  onOpen: (studentId: string) => void;
  /** Tam genişlikte birincil eylem — ödev gönder. */
  onSend: () => void;
}

/**
 * Ödev kutusu — bekleyenler üstte pembe kartlarda, değerlendirilenler
 * kesikli ayırıcının altında. Altta tam genişlikte birincil eylem
 * (FAB yerine, iki platformda da aynı bileşen).
 */
export function HomeworkScreen({
  homework,
  onOpen,
  onSend,
}: HomeworkScreenProps) {
  const { pending, reviewed } = useMemo(() => {
    const pendingList = homework.filter((h) => h.fromStudent && h.unread);
    const reviewedList = homework.filter((h) => !(h.fromStudent && h.unread));
    return { pending: pendingList, reviewed: reviewedList.slice(0, 30) };
  }, [homework]);

  const row = (group: PanelHomeworkGroup, isNew: boolean) => (
    <li key={group.batchId}>
      <button type="button" className="pnl-hw" data-state={isNew ? "new" : "done"} onClick={() => onOpen(group.studentId)}>
        <span className="pnl-hw__icon" aria-hidden="true">
          {isNew ? <ClipboardList className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
          {/* Ödev adı üstte: tek satırda "uzun öğrenci adı · ödev adı" olunca
              ödevin ne olduğu kırpılıp kayboluyordu. */}
          <span className="pnl-hw__title truncate">{group.title}</span>
          <span className="pnl-hw__meta truncate">
            {group.studentName} · {group.fromStudent ? "yükledi" : "gönderildi"}{" "}
            {formatDistanceToNow(new Date(group.createdAt), { addSuffix: true, locale: tr })}
            {group.fileCount > 1 ? ` · ${group.fileCount} dosya` : ""}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0" style={{ color: isNew ? "var(--ewd-pink-line)" : "var(--ewd-muted-3)" }} aria-hidden="true" />
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-3 py-5">
      {homework.length === 0 ? (
        <EmptyState
          title="Ödev kutusu boş"
          text="Öğrencileriniz ödev yüklediğinde ya da siz ödev gönderdiğinizde burada görünür."
        />
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="grid gap-2.5 md:grid-cols-2">{pending.map((g) => row(g, true))}</ul>
          )}

          {reviewed.length > 0 && (
            <>
              <SectionDivider label="Değerlendirildi" />
              <ul className="grid gap-2.5 md:grid-cols-2">{reviewed.map((g) => row(g, false))}</ul>
            </>
          )}
        </>
      )}

      {/* Bakiye özeti burada yoktu: o Bakiye sekmesinin işi, ödev kutusunda
          ikinci bir yerde tekrar etmesi ekranı uzatıyordu. */}
      <div className="mt-1 md:max-w-xs">
        <button type="button" className="pnl-btn pnl-btn--pink pnl-btn--block" onClick={onSend}>
          Ödev gönder
        </button>
      </div>
    </div>
  );
}
