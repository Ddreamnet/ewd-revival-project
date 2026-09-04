/**
 * Günlüğün bir günü: tarih başlığı, o gün yapılanların listesi ve fotoğraflar.
 *
 * İki kılıkta çalışır. Okuma kılığında sayfa bir anı defteri gibi görünür;
 * düzenleme kılığında (üstteki "Düzenle" düğmesi) yazı alanları, silme ve
 * sıralama düğmeleri açılır. Fotoğraf eklemek her iki kılıkta da mümkün —
 * en sık yapılan iş o.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import type { TripDay, TripPhoto, UploadProgress } from "@/hooks/useTripDiary";
import type { useTripDiary } from "@/hooks/useTripDiary";
import { dayAnchor, dayNumber, labelFor } from "@/lib/trip";
import { isNative } from "@/lib/platform";
import { pickImagesNative } from "@/lib/nativeCamera";

/** Gün kartları sırayla mor · pembe · sarı giyer. */
const ACCENTS = [
  { ink: "#7C3AED", line: "#DDC8F2", wash: "#F4EDFF", deep: "#5B21B6" },
  { ink: "#EC4899", line: "#F8C8DC", wash: "#FFF1F7", deep: "#BE185D" },
  { ink: "#D9A21B", line: "#F3DDA0", wash: "#FEF6DC", deep: "#8A6410" },
];

type Diary = ReturnType<typeof useTripDiary>;

interface TripDayCardProps {
  data: TripDay;
  editing: boolean;
  /** Yalnızca bu güne ait yükleme; başka gün yükleniyorsa null. */
  upload: UploadProgress | null;
  diary: Diary;
  onOpenPhoto: (day: string, index: number) => void;
}

export function TripDayCard({ data, editing, upload, diary, onOpenPhoto }: TripDayCardProps) {
  const { day, title, activities, photos } = data;
  const label = labelFor(day);
  const accent = ACCENTS[(dayNumber(day) - 1) % ACCENTS.length];

  const fileInput = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  /** Yeni eklenen satır kendiliğinden odaklansın. */
  const [focusId, setFocusId] = useState<string | null>(null);

  const busy = upload !== null;
  const isEmpty = activities.length === 0 && photos.length === 0;

  const pickPhotos = async () => {
    if (busy) return;
    if (isNative) {
      const files = await pickImagesNative();
      if (files && files.length > 0) diary.addPhotos(day, files);
      return;
    }
    fileInput.current?.click();
  };

  const addRow = async () => {
    const id = await diary.addActivity(day);
    if (id) setFocusId(id);
  };

  return (
    <section id={dayAnchor(day)} className="scroll-mt-[104px]">
      <article
        className="relative overflow-hidden rounded-[30px] border-[3px] px-4 py-5 transition-colors sm:rounded-[36px] sm:px-7 sm:py-7"
        style={{
          background: dropping ? accent.wash : "#FFFDF8",
          borderColor: dropping ? accent.ink : accent.line,
          boxShadow: "var(--ewd-shadow-card)",
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
          const files = Array.from(event.dataTransfer.files);
          if (files.length > 0) diary.addPhotos(day, files);
        }}
      >
        {/* ------------------------------------------------------- başlık */}
        <header className="flex items-start gap-3.5">
          <div
            className="grid h-[60px] w-[56px] shrink-0 place-content-center justify-items-center gap-0.5 rounded-[18px]"
            style={{ background: accent.wash, border: `2px solid ${accent.line}` }}
          >
            <span className="text-[23px] font-black leading-none" style={{ color: accent.deep }}>
              {label.dayOfMonth}
            </span>
            <span className="ewd-label text-[10px] leading-none" style={{ color: accent.deep }}>
              {label.monthShort}
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h2 className="ewd-h3 text-[23px] sm:text-[27px]">{label.long}</h2>
              <span className="text-[13px] font-bold" style={{ color: "var(--ewd-body-soft)" }}>
                {label.weekday}
              </span>
              <span
                className="ewd-label rounded-full px-2.5 py-1 text-[10px]"
                style={{ background: accent.wash, color: accent.deep }}
              >
                {dayNumber(day)}. gün
              </span>
            </div>

            {editing ? (
              <input
                defaultValue={title}
                placeholder="Bu güne bir başlık — isteğe bağlı"
                className="ewd-script w-full max-w-[420px] rounded-[14px] border-2 bg-white px-3 py-1.5 text-[26px] leading-tight outline-none"
                style={{ borderColor: accent.line, color: accent.ink }}
                onBlur={(event) => {
                  if (event.target.value.trim() !== title) diary.saveTitle(day, event.target.value);
                }}
              />
            ) : (
              title && (
                <p className="ewd-script text-[27px] leading-none sm:text-[32px]" style={{ color: accent.ink }}>
                  {title}
                </p>
              )
            )}
          </div>

          <button
            type="button"
            onClick={pickPhotos}
            disabled={busy}
            className="hidden shrink-0 items-center gap-2 rounded-full border-2 bg-white px-4 py-2.5 text-[13px] font-extrabold transition-colors disabled:opacity-60 sm:inline-flex"
            style={{ borderColor: accent.line, color: accent.deep }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Fotoğraf ekle
          </button>
        </header>

        {/* -------------------------------------------------- neler yaptık */}
        {(activities.length > 0 || editing) && (
          <div className="mt-5">
            <SectionLabel text="NELER YAPTIK" color={accent.deep} line={accent.line} />

            {activities.length === 0 && editing && (
              <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--ewd-faint)" }}>
                Henüz bir şey yazılmadı. Aşağıdan ilk satırı ekleyin.
              </p>
            )}

            <ul className="mt-3 flex flex-col gap-2">
              {activities.map((activity, index) => (
                <li
                  key={activity.id}
                  className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[18px] px-3.5 py-3"
                  style={{ background: accent.wash }}
                >
                  {editing ? (
                    <>
                      <AutoTextarea
                        value={activity.text}
                        autoFocus={focusId === activity.id}
                        borderColor={accent.line}
                        onCommit={(text) => diary.saveActivity(activity.id, text)}
                        onEnter={addRow}
                      />
                      {/* Düğmeler tek sıra: dar ekranda yazı alanının altına sarar. */}
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <RowButton
                          label="Yukarı taşı"
                          disabled={index === 0}
                          onClick={() => diary.moveActivity(day, index, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </RowButton>
                        <RowButton
                          label="Aşağı taşı"
                          disabled={index === activities.length - 1}
                          onClick={() => diary.moveActivity(day, index, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </RowButton>
                        <RowButton
                          label="Satırı sil"
                          danger
                          onClick={() => {
                            if (activity.text.trim() && !confirm("Bu satır silinsin mi?")) return;
                            diary.removeActivity(activity.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </RowButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: accent.ink }}
                        aria-hidden="true"
                      />
                      <p
                        className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] font-semibold leading-[1.5] [text-wrap:pretty]"
                        style={{ color: "var(--ewd-ink)" }}
                      >
                        {activity.text || "…"}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {editing && (
              <button
                type="button"
                onClick={addRow}
                className="mt-2.5 inline-flex items-center gap-2 rounded-full border-2 border-dashed bg-white px-4 py-2.5 text-[13px] font-extrabold transition-colors"
                style={{ borderColor: accent.line, color: accent.deep }}
              >
                <Plus className="h-4 w-4" />
                Satır ekle
              </button>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- fotoğraflar */}
        <div className="mt-5">
          {photos.length > 0 && (
            <SectionLabel
              text={`FOTOĞRAFLAR · ${photos.length}`}
              color={accent.deep}
              line={accent.line}
            />
          )}

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) =>
              editing ? (
                <EditablePhoto
                  key={photo.id}
                  photo={photo}
                  index={index}
                  total={photos.length}
                  accentLine={accent.line}
                  onMove={(delta) => diary.movePhoto(day, index, delta)}
                  onCaption={(caption) => diary.savePhotoCaption(photo.id, caption)}
                  onRemove={() => {
                    if (confirm("Bu fotoğraf silinsin mi?")) diary.removePhoto(photo);
                  }}
                />
              ) : (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpenPhoto(day, index)}
                  aria-label={photo.caption || `${label.long} — ${index + 1}. fotoğrafı aç`}
                  className="group relative aspect-square overflow-hidden rounded-[20px] border-[3px] border-white"
                  style={{ background: accent.wash, boxShadow: "var(--ewd-shadow-inner)" }}
                >
                  {photo.url && (
                    <img
                      src={photo.url}
                      alt={photo.caption}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
                    />
                  )}
                  {photo.caption && (
                    <span
                      className="pointer-events-none absolute inset-x-0 bottom-0 truncate px-3 py-2 text-left text-[12px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: "linear-gradient(to top, rgba(24,10,44,0.85), transparent)" }}
                    >
                      {photo.caption}
                    </span>
                  )}
                </button>
              ),
            )}

            {/* Ekleme kutucuğu — ızgaranın sonunda. */}
            <button
              type="button"
              onClick={pickPhotos}
              disabled={busy}
              className="grid aspect-square place-content-center justify-items-center gap-2 rounded-[20px] border-[3px] border-dashed px-2 text-center transition-colors disabled:opacity-70"
              style={{ borderColor: accent.line, background: accent.wash, color: accent.deep }}
            >
              {busy ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <span className="text-[12px] font-extrabold">
                    {upload.done} / {upload.total}
                  </span>
                </>
              ) : (
                <>
                  <ImagePlus className="h-7 w-7" />
                  <span className="text-[12px] font-extrabold leading-tight">
                    Fotoğraf ekle
                    <span className="hidden sm:block font-bold opacity-70">ya da sürükleyip bırakın</span>
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {isEmpty && !editing && (
          <p className="mt-4 text-[13px] font-semibold" style={{ color: "var(--ewd-faint)" }}>
            Bu gün için henüz bir şey yazılmadı. Üstteki “Düzenle” ile başlayabilirsiniz.
          </p>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = ""; // aynı dosya tekrar seçilebilsin
            if (files.length > 0) diary.addPhotos(day, files);
          }}
        />
      </article>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Parçalar                                                            */
/* ------------------------------------------------------------------ */

function SectionLabel({ text, color, line }: { text: string; color: string; line: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="ewd-label text-[11px]" style={{ color }}>
        {text}
      </span>
      <span className="h-0 flex-1 border-t-2 border-dashed" style={{ borderColor: line }} />
    </div>
  );
}

function RowButton({
  label,
  children,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white transition-colors disabled:opacity-30"
      style={{ color: danger ? "#BE185D" : "var(--ewd-body-soft)" }}
    >
      {children}
    </button>
  );
}

/** Yazdıkça uzayan alan; odaktan çıkınca kaydeder. */
function AutoTextarea({
  value,
  autoFocus,
  borderColor,
  onCommit,
  onEnter,
}: {
  value: string;
  autoFocus?: boolean;
  borderColor: string;
  onCommit: (text: string) => void;
  onEnter: () => void;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  return (
    <textarea
      ref={ref}
      value={text}
      rows={1}
      autoFocus={autoFocus}
      placeholder="Ne yaptık?"
      className="w-full min-w-0 resize-none rounded-[12px] border-2 bg-white px-3 py-2 text-[15px] font-semibold leading-[1.5] outline-none sm:w-auto sm:flex-1"
      style={{ borderColor, color: "var(--ewd-ink)" }}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (text !== value) onCommit(text);
      }}
      onKeyDown={(event) => {
        // Enter: satırı bitir ve bir yenisini aç. Alt satır için Shift+Enter.
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (text !== value) onCommit(text);
          onEnter();
        }
      }}
    />
  );
}

function EditablePhoto({
  photo,
  index,
  total,
  accentLine,
  onMove,
  onCaption,
  onRemove,
}: {
  photo: TripPhoto;
  index: number;
  total: number;
  accentLine: string;
  onMove: (delta: number) => void;
  onCaption: (caption: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative aspect-square overflow-hidden rounded-[20px] border-[3px] border-white"
        style={{ boxShadow: "var(--ewd-shadow-inner)" }}
      >
        {photo.url && <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />}

        <button
          type="button"
          onClick={onRemove}
          aria-label="Fotoğrafı sil"
          className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full text-white"
          style={{ background: "rgba(24,10,44,0.6)" }}
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="absolute bottom-1.5 left-1.5 flex gap-1">
          <PhotoMoveButton label="Öne al" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </PhotoMoveButton>
          <PhotoMoveButton label="Sona al" disabled={index === total - 1} onClick={() => onMove(1)}>
            <ChevronRight className="h-4 w-4" />
          </PhotoMoveButton>
        </div>
      </div>

      <input
        defaultValue={photo.caption}
        placeholder="Açıklama"
        className="w-full rounded-[12px] border-2 bg-white px-2.5 py-1.5 text-[12px] font-semibold outline-none"
        style={{ borderColor: accentLine, color: "var(--ewd-ink)" }}
        onBlur={(event) => {
          if (event.target.value !== photo.caption) onCaption(event.target.value);
        }}
      />
    </div>
  );
}

function PhotoMoveButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-full text-white disabled:opacity-30"
      style={{ background: "rgba(24,10,44,0.6)" }}
    >
      {children}
    </button>
  );
}
