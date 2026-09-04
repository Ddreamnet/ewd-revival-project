import { ReactNode, forwardRef, memo } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Yuvarlak ikon butonu                                                */
/* ------------------------------------------------------------------ */

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ekran okuyucu etiketi — ikon butonlarında zorunlu. */
  label: string;
  /** Sağ üstteki sayaç (bildirim). */
  count?: number;
  tone?: "default" | "purple" | "back";
  /** Masaüstünde 42px'e iner (mobilde 48 kalır). */
  compact?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, count, tone = "default", compact = false, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "pnl-iconbtn",
        compact && "pnl-iconbtn--sm",
        tone === "purple" && "pnl-iconbtn--purple",
        tone === "back" && "pnl-iconbtn--back",
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="pnl-badge-dot">{count > 99 ? "99+" : count}</span>
      )}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Arama alanı                                                         */
/* ------------------------------------------------------------------ */

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Görsel etiketi olmadığı için ekran okuyucu adı. */
  label: string;
  className?: string;
}

export const SearchField = memo(function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: SearchFieldProps) {
  return (
    <div className={cn("pnl-search", className)}>
      <Search className="h-4 w-4 shrink-0" style={{ color: "var(--ewd-on-surface-faint)" }} aria-hidden="true" />
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Sayaç kutusu                                                        */
/* ------------------------------------------------------------------ */

export const CountBox = memo(function CountBox({
  value,
  label,
  tone = "purple",
}: {
  value: ReactNode;
  label: string;
  tone?: "purple" | "yellow";
}) {
  return (
    <div className={cn("pnl-count", tone === "yellow" && "pnl-count--yellow")}>
      <span className="pnl-count__value">{value}</span>
      <span className="pnl-count__label">{label}</span>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Ünite ayırıcı                                                       */
/* ------------------------------------------------------------------ */

export function SectionDivider({ label, count }: { label: string; count?: string }) {
  return (
    <div className="pnl-divider">
      <span className="pnl-divider__label">{label}</span>
      <span className="pnl-divider__rule" aria-hidden="true" />
      {count && <span className="pnl-divider__count">{count}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Boş durum                                                           */
/* ------------------------------------------------------------------ */

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pnl-empty">
      <p className="pnl-empty__title">{title}</p>
      {text && <p className="pnl-empty__text">{text}</p>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* İlerleme çubuğu                                                     */
/* ------------------------------------------------------------------ */

export const ProgressBar = memo(function ProgressBar({
  value,
  max,
  tone = "purple",
  label,
}: {
  value: number;
  max: number;
  tone?: "purple" | "pink";
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn("pnl-progress", tone === "pink" && "pnl-progress--pink")}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? `${value} / ${max}`}
      >
        <span style={{ width: `${pct}%` }} />
      </span>
      {label && (
        <span className="shrink-0 text-[11px] font-extrabold md:text-xs" style={{ color: "var(--ewd-on-surface-soft)" }}>
          {label}
        </span>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

export const Avatar = memo(function Avatar({
  name,
  tone = "purple",
  size = "md",
}: {
  name: string;
  tone?: "purple" | "pink";
  size?: "md" | "sm";
}) {
  const letter = (name || "?").trim().charAt(0).toLocaleUpperCase("tr-TR");
  return (
    <span
      className={cn("pnl-avatar", tone === "pink" && "pnl-avatar--pink", size === "sm" && "pnl-avatar--sm")}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
});

/* ------------------------------------------------------------------ */
/* Mobil ekran başlığı (geri + başlık + eylem)                         */
/* ------------------------------------------------------------------ */

export function ScreenHeader({
  onBack,
  title,
  leading,
  trailing,
}: {
  onBack: () => void;
  title: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <IconButton label="Geri" tone="back" onClick={onBack}>
        <ChevronLeft className="h-6 w-6" />
      </IconButton>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {leading}
        <h2
          className="min-w-0 truncate text-[22px] font-black tracking-[-0.02em] md:text-[20px]"
          style={{ color: "var(--ewd-on-surface)" }}
        >
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sayaç şeridi (mobil)                                                */
/* ------------------------------------------------------------------ */

/**
 * İki sayaç kartının mobil karşılığı.
 * Kartlar üst bandı 350px'e çıkarıyordu; şerit tek satırda 34px.
 */
export const CountStrip = memo(function CountStrip({
  items,
}: {
  items: { value: ReactNode; label: string }[];
}) {
  return (
    <div className="pnl-countstrip">
      {items.map((item, i) => (
        <span key={i}>
          <b>{item.value}</b>
          {item.label}
        </span>
      ))}
    </div>
  );
});
