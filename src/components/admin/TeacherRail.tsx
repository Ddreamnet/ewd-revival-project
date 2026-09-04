import { memo, useMemo, useState } from "react";
import { ChevronRight, Plus, Settings } from "lucide-react";
import { Avatar, EmptyState, IconButton, SearchField } from "@/components/panel/PanelBits";
import { toneForName } from "@/lib/panelFormat";
import { branchLabel, type Branch } from "@/lib/branch";
import type { Teacher } from "@/lib/types";

interface TeacherRailProps {
  teachers: Teacher[];
  /** Açık olan dil şubesi — boş durum metinleri buna göre yazılır. */
  branch: Branch;
  selectedId: string | null;
  loading: boolean;
  onSelect: (teacher: Teacher) => void;
  onCreate: () => void;
  onEdit: (teacher: Teacher) => void;
}

/** Admin panelinin sol rayı — öğretmen kartları, arama ve "öğretmen oluştur". */
export const TeacherRail = memo(function TeacherRail({
  teachers,
  branch,
  selectedId,
  loading,
  onSelect,
  onCreate,
  onEdit,
}: TeacherRailProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.full_name.toLocaleLowerCase("tr-TR").includes(q) ||
        t.email.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [teachers, query]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2
            className="text-[21px] font-black tracking-[-0.02em] md:text-[20px]"
            style={{ color: "var(--ewd-on-surface)" }}
          >
            Öğretmenler
          </h2>
          <span className="pnl-welcome">
            {branchLabel(branch)} · {teachers.length} öğretmen kayıtlı
          </span>
        </div>
        <IconButton label="Öğretmen oluştur" tone="purple" onClick={onCreate}>
          <Plus className="h-6 w-6" />
        </IconButton>
      </div>

      {teachers.length > 4 && (
        <SearchField value={query} onChange={setQuery} label="Öğretmen ara" placeholder="Öğretmen ara…" />
      )}

      {loading && teachers.length === 0 ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-[26px]"
              style={{ background: "var(--ewd-lilac-tint)" }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            teachers.length === 0
              ? `${branchLabel(branch)} şubesinde henüz öğretmen yok`
              : "Eşleşen öğretmen yok"
          }
          text={
            teachers.length === 0
              ? "Sağ üstteki + düğmesiyle bu şubenin ilk öğretmenini oluşturun."
              : "Farklı bir isimle aramayı deneyin."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((teacher) => {
            const active = teacher.user_id === selectedId;
            const activeStudents = teacher.students.filter((s) => !s.is_archived).length;
            const archived = teacher.students.length - activeStudents;

            return (
              <li key={teacher.user_id}>
                <div className="pnl-student relative" data-active={active}>
                  <button
                    type="button"
                    className="pnl-hit"
                    aria-label={`${teacher.full_name} — öğretmen detayını aç`}
                    aria-current={active ? "true" : undefined}
                    onClick={() => onSelect(teacher)}
                  />

                  <div className="pointer-events-none relative z-10 flex items-start gap-3.5">
                    <Avatar name={teacher.full_name} tone={toneForName(teacher.full_name)} />

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="pnl-student__name truncate">{teacher.full_name}</span>
                      <span className="pnl-student__mail">{teacher.email}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="pnl-chip pnl-chip--next">{activeStudents} öğrenci</span>
                        {archived > 0 && <span className="pnl-chip">{archived} arşivli</span>}
                      </span>
                    </div>

                    <IconButton
                      label={`${teacher.full_name} ayarları`}
                      className="pointer-events-auto h-[38px] w-[38px] rounded-xl border-0"
                      style={{ background: "var(--ewd-lilac-tint)", color: "var(--ewd-purple)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(teacher);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </IconButton>

                    <ChevronRight
                      className="mt-2.5 h-5 w-5 shrink-0 md:hidden"
                      style={{ color: "var(--ewd-muted-3)" }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
