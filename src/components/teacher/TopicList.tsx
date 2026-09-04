import { Fragment, memo, useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { SearchField, SectionDivider, EmptyState } from "@/components/panel/PanelBits";
import { Highlight } from "@/components/panel/Highlight";
import { getResourceIcon } from "@/lib/resourceUtils";
import type { Topic, Resource } from "@/lib/types";

/** Bir seferde çizilen konu sayısı — 76 kayıtlık liste tek seferde DOM'a basılmaz. */
const PAGE_SIZE = 8;

interface TopicListProps {
  topics: Topic[];
  loading: boolean;
  /** Öğretmen konuları işaretleyebilir; öğrenci panelinde salt okunur. */
  editable?: boolean;
  onToggleTopic?: (topic: Topic) => void;
  onToggleResource?: (topic: Topic, resource: Resource) => void;
}

interface TopicGroup {
  key: string;
  label: string;
  topics: Topic[];
}

/**
 * Ünite başlıklarıyla bölünmüş, aramalı konu listesi.
 *
 * Tasarımın çözdüğü sorun: 76 konu tek listede akıyordu. Burada konular
 * gruplanır (öğrenciye özel / genel), arama var ve her grup ilk sekiz kaydı
 * gösterip gerisini "Kalan N konuyu göster" ile açar — hepsi birden DOM'a
 * basılmaz.
 */
export const TopicList = memo(function TopicList({
  topics,
  loading,
  editable = false,
  onToggleTopic,
  onToggleResource,
}: TopicListProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [shownAll, setShownAll] = useState<Set<string>>(() => new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return topics;
    return topics.filter((topic) => {
      if (topic.title.toLocaleLowerCase("tr-TR").includes(q)) return true;
      if (topic.description?.toLocaleLowerCase("tr-TR").includes(q)) return true;
      return topic.resources.some((r) => r.title.toLocaleLowerCase("tr-TR").includes(q));
    });
  }, [topics, query]);

  const groups = useMemo<TopicGroup[]>(() => {
    const own = filtered.filter((t) => !t.isGlobal);
    const global = filtered.filter((t) => t.isGlobal);
    const result: TopicGroup[] = [];
    if (own.length) result.push({ key: "own", label: "Öğrenciye özel konular", topics: own });
    if (global.length) result.push({ key: "global", label: "Genel konular", topics: global });
    return result;
  }, [filtered]);

  /** İlk tamamlanmamış konu — ders akışında "bu derste" işlenen. */
  const currentTopicId = useMemo(() => topics.find((t) => !t.is_completed)?.id ?? null, [topics]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Konular yükleniyor">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-[20px]"
            style={{ background: "var(--ewd-lilac-tint)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Konu veya kaynak ara"
          placeholder="Konu veya kaynak ara…"
          className="w-full md:min-w-[260px] md:max-w-[330px]"
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={query ? "Eşleşen konu yok" : "Henüz konu yok"}
          text={
            query
              ? "Farklı bir kelimeyle aramayı deneyin."
              : "Bu öğrenciye konu atandığında burada listelenir."
          }
        />
      ) : (
        groups.map((group) => {
          const showAll = shownAll.has(group.key) || !!query;
          const visible = showAll ? group.topics : group.topics.slice(0, PAGE_SIZE);
          const remaining = group.topics.length - visible.length;
          const done = group.topics.filter((t) => t.is_completed).length;

          return (
            <Fragment key={group.key}>
              <SectionDivider label={group.label} count={`${done} / ${group.topics.length}`} />

              {visible.map((topic) => {
                const isOpen = expanded.has(topic.id);
                const state = topic.is_completed
                  ? "done"
                  : topic.id === currentTopicId
                    ? "current"
                    : "todo";

                return (
                  <div key={topic.id} className="flex flex-col gap-2">
                    <div className="pnl-topic" data-state={state}>
                      {editable ? (
                        <button
                          type="button"
                          className="pnl-topic__mark"
                          data-done={topic.is_completed}
                          aria-pressed={topic.is_completed}
                          aria-label={
                            topic.is_completed
                              ? `${topic.title} — işlenmedi olarak işaretle`
                              : `${topic.title} — işlendi olarak işaretle`
                          }
                          onClick={() => onToggleTopic?.(topic)}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="pnl-topic__mark" data-done={topic.is_completed} aria-hidden="true">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}

                      <button
                        type="button"
                        className="pnl-topic__open"
                        aria-expanded={isOpen}
                        onClick={() => toggleExpanded(topic.id)}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="pnl-topic__title">
                            <Highlight text={topic.title} query={query} />
                          </span>
                          {state === "current" && (
                            <span className="pnl-tag pnl-tag--lesson">Bu derste</span>
                          )}
                        </span>
                        {topic.description && (
                          <span
                            className={`pnl-topic__desc ${
                              isOpen ? "" : "line-clamp-1 hidden md:block"
                            }`}
                          >
                            <Highlight text={topic.description} query={query} />
                          </span>
                        )}
                      </button>

                      {topic.resources.length > 0 && (
                        <span className="pnl-topic__count">{topic.resources.length} kaynak</span>
                      )}
                      {isOpen ? (
                        <ChevronDown className="pnl-topic__chev h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="pnl-topic__chev h-4 w-4" aria-hidden="true" />
                      )}
                    </div>

                    {isOpen && (
                      <ul className="ml-4 flex flex-col gap-2 border-l-2 pl-4" style={{ borderColor: "var(--ewd-lilac-line-3)" }}>
                        {topic.resources.length === 0 ? (
                          <li className="py-1 text-[13px] font-medium" style={{ color: "var(--ewd-on-surface-faint)" }}>
                            Bu konuda henüz kaynak yok.
                          </li>
                        ) : (
                          topic.resources.map((resource) => (
                            <li
                              key={resource.id}
                              className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                              style={{ background: "var(--ewd-surface-3)" }}
                            >
                              {editable ? (
                                <button
                                  type="button"
                                  className="pnl-topic__mark"
                                  data-done={!!resource.is_completed}
                                  aria-pressed={!!resource.is_completed}
                                  aria-label={
                                    resource.is_completed
                                      ? `${resource.title} — işlenmedi olarak işaretle`
                                      : `${resource.title} — işlendi olarak işaretle`
                                  }
                                  onClick={() => onToggleResource?.(topic, resource)}
                                >
                                  <Check className="h-3 w-3" aria-hidden="true" />
                                </button>
                              ) : (
                                <span className="pnl-topic__mark" data-done={!!resource.is_completed} aria-hidden="true">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}

                              {getResourceIcon(resource.resource_type)}

                              <a
                                href={resource.resource_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-w-0 flex-1 flex-col"
                              >
                                <span className="truncate text-sm font-bold" style={{ color: "var(--ewd-on-surface)" }}>
                                  <Highlight text={resource.title} query={query} />
                                </span>
                                {resource.description && (
                                  <span className="truncate text-xs" style={{ color: "var(--ewd-on-surface-faint)" }}>
                                    {resource.description}
                                  </span>
                                )}
                              </a>

                              <a
                                href={resource.resource_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${resource.title} kaynağını aç`}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                                style={{ color: "var(--ewd-purple)" }}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}

              {remaining > 0 && (
                <button
                  type="button"
                  className="pnl-more"
                  onClick={() => setShownAll((prev) => new Set(prev).add(group.key))}
                >
                  Kalan {remaining} konuyu göster
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </Fragment>
          );
        })
      )}
    </div>
  );
});
