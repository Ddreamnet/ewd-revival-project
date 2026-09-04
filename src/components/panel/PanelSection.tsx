import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

interface PanelSectionProps {
  title: string;
  /** Başlığın sağındaki özet — açmadan da görünsün diye (ör. "₺7.260"). */
  summary?: ReactNode;
  /** Başlığın altındaki kısa açıklama. */
  hint?: string;
  /**
   * Katlanabilir bölüm. Kapalıyken içerik hiç monte edilmez — ağır bölümler
   * (haftalık program, ödeme geçmişi) açılana kadar sorgu atmaz. Panel tek
   * sayfa olduğu için bu, açılışı hızlı tutmanın yolu.
   */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Başlık satırının sağına eklenen eylem (buton vb.). */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Tek sayfalık panelin bölüm başlığı.
 * Sekme yok: her şey aynı sayfada, bölüm bölüm.
 */
export function PanelSection({
  title,
  summary,
  hint,
  collapsible = false,
  defaultOpen = true,
  action,
  children,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = collapsible ? open : true;

  const heading = (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span
          className="text-[19px] font-black tracking-[-0.02em] md:text-[18px]"
          style={{ color: "var(--ewd-on-surface)" }}
        >
          {title}
        </span>
        {summary && (
          <span className="text-[13px] font-extrabold" style={{ color: "var(--ewd-accent)" }}>
            {summary}
          </span>
        )}
      </span>
      {hint && <span className="pnl-welcome">{hint}</span>}
    </div>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {collapsible ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 bg-transparent text-left"
            aria-expanded={expanded}
            onClick={() => setOpen((v) => !v)}
          >
            {heading}
            <ChevronDown
              className="h-5 w-5 shrink-0 transition-transform"
              style={{
                color: "var(--ewd-accent)",
                transform: expanded ? "rotate(180deg)" : undefined,
              }}
              aria-hidden="true"
            />
          </button>
        ) : (
          heading
        )}
        {action}
      </div>

      {expanded && children}
    </section>
  );
}
