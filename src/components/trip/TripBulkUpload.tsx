/**
 * Toplu fotoğraf yükleme — sayfanın en üstünde.
 *
 * Karışık seçilen fotoğraflar EXIF'teki çekim tarihine göre günlere dağılır.
 * Gece yarısını geçen bir gün hâlâ önceki gündür: sınır sabah 06:00
 * (`DAY_CUTOFF_HOUR`).
 */

import { useRef, useState } from "react";
import { CalendarClock, Loader2, UploadCloud } from "lucide-react";

import type { BulkResult, useTripDiary } from "@/hooks/useTripDiary";
import { DAY_CUTOFF_HOUR, dayAnchor, labelFor } from "@/lib/trip";

type Diary = ReturnType<typeof useTripDiary>;

export function TripBulkUpload({ diary }: { diary: Diary }) {
  const [result, setResult] = useState<BulkResult | null>(null);
  const [dropping, setDropping] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Toplu yüklemede ilerleme kaydının günü yok.
  const progress = diary.upload && diary.upload.day === null ? diary.upload : null;
  const busy = progress !== null;

  const run = async (files: File[]) => {
    if (files.length === 0) return;
    setResult(null);
    const summary = await diary.addPhotosByDate(files);
    if (summary) setResult(summary);
  };

  return (
    <section className="mx-auto max-w-[1080px] px-4 pt-1 sm:px-6">
      <div
        className="rounded-[26px] border-[3px] border-dashed p-4 transition-colors sm:p-5"
        style={{
          background: dropping ? "var(--ewd-lilac-tint)" : "#FFFDF8",
          borderColor: dropping ? "var(--ewd-purple-deep)" : "var(--ewd-lilac-line)",
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDropping(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDropping(false);
          run(Array.from(event.dataTransfer.files));
        }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
            style={{ background: "var(--ewd-lilac-tint)", color: "var(--ewd-purple-deep)" }}
            aria-hidden="true"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-extrabold" style={{ color: "var(--ewd-ink)" }}>
              {busy ? `Yükleniyor — ${progress.done} / ${progress.total}` : "Toplu fotoğraf yükle"}
            </p>
            <p className="text-[13px] font-medium leading-[1.45]" style={{ color: "var(--ewd-body-soft)" }}>
              Hepsini birden seçin; her fotoğraf çekildiği güne gider. Gece {DAY_CUTOFF_HOUR}
              :00'dan önce çekilenler bir önceki güne yazılır.
            </p>
          </div>

          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="ewd-btn ewd-btn--purple ewd-btn--sm shrink-0"
          >
            {busy ? "Yükleniyor…" : "Fotoğrafları seç"}
          </button>
        </div>

        {result && !busy && (
          <div
            className="mt-3.5 flex flex-col gap-2 border-t-2 border-dashed pt-3.5"
            style={{ borderColor: "var(--ewd-lilac-line-soft)" }}
          >
            {result.perDay.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="ewd-label text-[10px]" style={{ color: "var(--ewd-purple-deep)" }}>
                  DAĞITILDI
                </span>
                {result.perDay.map(({ day, count }) => (
                  <a
                    key={day}
                    href={`#${dayAnchor(day)}`}
                    className="rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
                    style={{ background: "var(--ewd-lilac-tint)", color: "var(--ewd-purple-deep)" }}
                  >
                    {labelFor(day).short} · {count}
                  </a>
                ))}
              </div>
            )}

            {result.clamped > 0 && (
              <Note>
                {result.clamped} fotoğrafın tarihi gezi aralığının dışındaydı; en yakın güne konuldu.
              </Note>
            )}

            {result.undated.length > 0 && (
              <Note>
                {result.undated.length} fotoğrafın çekim tarihi okunamadı, yüklenmedi
                {result.undated.length <= 3 ? ` (${result.undated.join(", ")})` : ""}. Bunları ilgili
                günün kendi kutusundan ekleyin.
              </Note>
            )}

            {result.uploaded === 0 && result.undated.length === 0 && <Note>Hiçbir şey yüklenmedi.</Note>}
          </div>
        )}

        {/* Native seçici bilerek kullanılmıyor: Capacitor kamerası dosyayı
            yeniden kodlarken EXIF'i siliyor, o zaman tarihe göre dağıtamayız.
            Dosya seçici hem iOS hem Android WebView'de özgün dosyayı verir. */}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            run(files);
          }}
        />
      </div>
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex items-start gap-2 text-[12.5px] font-semibold leading-[1.45]"
      style={{ color: "var(--ewd-body-soft)" }}
    >
      <CalendarClock className="mt-[1px] h-4 w-4 shrink-0" style={{ color: "var(--ewd-pink-mid)" }} />
      {children}
    </p>
  );
}
