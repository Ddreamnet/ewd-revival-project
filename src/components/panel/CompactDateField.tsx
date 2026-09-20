/**
 * Dar tarih alanı — "16 Eylül".
 *
 * Yerli `<input type="date">` biçimini değiştiremiyor: tarayıcı yıl dahil
 * tam tarihi ve kendi ayırıcısını basıyor, alan da en az 160px istiyor.
 * Ders listesinde her satırda bir tanesi olduğu için satır ikiye katlanıyordu.
 * Burada görünen şey bir düğme (gün + ay, yıl yok — ders listesinde hepsi
 * aynı yıl), tıklanınca projenin kendi takvimi açılıyor.
 */
import { useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parseLocalDate } from "@/lib/lessonTypes";
import { cn } from "@/lib/utils";

interface CompactDateFieldProps {
  /** yyyy-MM-dd */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Değiştirilmiş bir tarih — kehribar çerçeveyle işaretlenir. */
  highlighted?: boolean;
  title?: string;
  className?: string;
}

/** Yerel saat diliminde yyyy-MM-dd — toISOString() UTC'ye kaydırıp günü bir
 *  geri alabiliyor. */
const toLocalISO = (date: Date) => format(date, "yyyy-MM-dd");

export function CompactDateField({
  value,
  onChange,
  disabled,
  highlighted,
  title,
  className,
}: CompactDateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseLocalDate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={title}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold tabular-nums",
            "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            highlighted ? "border-amber-500 text-amber-600" : "border-input hover:bg-muted",
            className,
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          {selected ? format(selected, "d MMMM", { locale: tr }) : "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          locale={tr}
          onSelect={(date) => {
            if (!date) return;
            onChange(toLocalISO(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
