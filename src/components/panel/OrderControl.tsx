/**
 * Sıra numarası — yazarak taşıma.
 *
 * Sürükleme kısa listelerde iyi ama uzun listede çalışmıyor: yeni eklenen bir
 * konu en sona düşüyor ve onu en başa taşımak, listeyi kaydırırken parmağı
 * basılı tutmayı gerektiriyor — telefonda neredeyse imkânsız. Burada numara
 * bir düğme: tıkla, yeni sırayı yaz, onayla. Yanındaki ⤒ ise en sık ihtiyacı
 * (yeni eklenen şeyi başa almak) tek dokunuşa indiriyor.
 *
 * Sürükleme kaldırılmadı — ikisi aynı kaydetme yolunu kullanıyor.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowUpToLine, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderControlProps {
  /** 0 tabanlı mevcut sıra. */
  index: number;
  total: number;
  /** 0 tabanlı hedef sıraya taşı. */
  onMove: (toIndex: number) => void;
  className?: string;
  /** Ekran okuyucu için "konu" / "kaynak" gibi bir ad. */
  itemLabel?: string;
}

export function OrderControl({ index, total, onMove, className, itemLabel = "öğe" }: OrderControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    setEditing(false);
    if (!Number.isFinite(parsed)) return;
    // Kullanıcı 1 tabanlı düşünür; liste 0 tabanlı.
    const target = Math.min(Math.max(parsed, 1), total) - 1;
    if (target !== index) onMove(target);
  };

  if (editing) {
    return (
      <span className={cn("flex shrink-0 items-center gap-0.5", className)} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={1}
          max={total}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label={`Yeni sıra (1–${total})`}
          className="h-7 w-11 rounded-md border border-input bg-background px-1 text-center text-[13px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={commit}
          aria-label="Sırayı onayla"
          className="grid h-7 w-7 place-items-center rounded-md text-primary hover:bg-muted"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Vazgeç"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className={cn("flex shrink-0 items-center gap-0.5", className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => {
          setDraft(String(index + 1));
          setEditing(true);
        }}
        aria-label={`${index + 1}. ${itemLabel} — sırayı değiştir`}
        className="h-7 min-w-7 rounded-md px-1.5 text-[13px] font-semibold tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {index + 1}
      </button>
      {index > 0 ? (
        <button
          type="button"
          onClick={() => onMove(0)}
          aria-label={`${itemLabel} en başa taşı`}
          title="En başa taşı"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowUpToLine className="h-3.5 w-3.5" />
        </button>
      ) : (
        // İlk satırda düğme yok ama yeri duruyor: yoksa o satırın tutamağı,
        // ikonu ve başlığı diğerlerine göre 28px sola kayıyor ve liste
        // hizasını kaybediyordu.
        <span aria-hidden className="h-7 w-7" />
      )}
    </span>
  );
}
