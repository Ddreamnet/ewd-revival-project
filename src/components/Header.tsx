import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  /** Panelin adı — "Admin Paneli", "Öğretmen Paneli"… */
  title: string;
  /** İkinci satır, genelde "Hoş geldin, {ad}". */
  subtitle?: string;
  /** Başlığın yanındaki küçük rol etiketi. */
  badge?: string;
  rightActions?: ReactNode;
  /** Başlığın altında tam genişlik bir sekme şeridi. */
  tabs?: ReactNode;
}

/**
 * Panel başlığı — EWD görsel sisteminin panel karşılığı.
 * Üstte ince marka şeridi, altında logo · başlık · eylemler.
 * Açık ve koyu modda `--ewd-*` yüzey token'larından boyanır.
 */
export function Header({ title, subtitle, badge, rightActions, tabs }: HeaderProps) {
  return (
    <header className="ewd-panel-head dashboard-header sticky top-0 z-40">
      {/* Marka şeridi — mor · pembe · sarı */}
      <div className="flex h-1.5" aria-hidden="true">
        <span className="flex-[3]" style={{ background: "var(--ewd-purple)" }} />
        <span className="flex-[2]" style={{ background: "var(--ewd-pink)" }} />
        <span className="flex-1" style={{ background: "var(--ewd-yellow)" }} />
      </div>

      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" aria-label="English with Dilara" className="shrink-0">
            <img src="/uploads/logo.webp" alt="" className="h-11 w-auto sm:h-14" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[17px] font-black tracking-[-0.01em] text-[color:var(--ewd-on-surface)] sm:text-[20px]">
                {title}
              </h1>
              {badge && (
                <span
                  className="hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] sm:inline-block"
                  style={{ background: "var(--ewd-accent-wash)", color: "var(--ewd-accent)" }}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="truncate text-[13px] font-semibold text-[color:var(--ewd-on-surface-soft)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">{rightActions}</div>
      </div>

      {tabs && (
        <div className="mx-auto max-w-[1500px] px-3 pb-2.5 sm:px-5">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">{tabs}</div>
        </div>
      )}
    </header>
  );
}
