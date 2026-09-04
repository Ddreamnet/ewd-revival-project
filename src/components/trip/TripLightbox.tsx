/**
 * Tam ekran fotoğraf görüntüleyici.
 *
 * Yalnızca açıldığı günün fotoğrafları arasında dolaşır: parmakla kaydırma,
 * oklar, klavye ve alttaki küçük kareler. Kaydırma sırasında dikey kaydırmayı
 * çalmamak için ilk birkaç pikselde yön seçiliyor — parmak aşağı gidiyorsa
 * şerit yerinde kalıyor.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { TripPhoto } from "@/hooks/useTripDiary";

interface TripLightboxProps {
  photos: TripPhoto[];
  index: number;
  dayLabel: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Sürüklemenin fotoğraf değiştirmeye yettiği mesafe. */
const SWIPE_THRESHOLD = 56;

export function TripLightbox({ photos, index, dayLabel, onIndexChange, onClose }: TripLightboxProps) {
  const [drag, setDrag] = useState(0);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const axis = useRef<"x" | "y" | null>(null);
  const dragRef = useRef(0);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= photos.length) return;
      onIndexChange(next);
    },
    [index, photos.length, onIndexChange],
  );

  /* Arkadaki sayfa kaymasın. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const current = photos[index];
  if (!current) return null;

  const setDragBoth = (value: number) => {
    dragRef.current = value;
    setDrag(value);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragging.current = true;
    axis.current = null;
    start.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;

    if (axis.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis.current !== "x") return;

    // İlk ve son fotoğrafta dışarı doğru sürüklemek zorlaşsın: şerit bitti.
    const atEdge = (index === 0 && dx > 0) || (index === photos.length - 1 && dx < 0);
    setDragBoth(atEdge ? dx * 0.32 : dx);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = dragRef.current;
    setDragBoth(0);
    if (dx <= -SWIPE_THRESHOLD) go(1);
    else if (dx >= SWIPE_THRESHOLD) go(-1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${dayLabel} — fotoğraf ${index + 1} / ${photos.length}`}
      className="fixed inset-0 z-[120] flex flex-col"
      style={{ background: "#140A29" }}
    >
      {/* ------------------------------------------------------- üst şerit */}
      <div
        className="flex items-center justify-between gap-3 px-4 pb-3"
        style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-black text-[#FFF8EF]">{dayLabel}</span>
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#C4B0E4]">
            {index + 1} / {photos.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#FFF8EF] transition-colors hover:bg-[rgba(255,248,239,0.16)]"
          style={{ background: "rgba(255,248,239,0.1)" }}
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* ----------------------------------------------------------- şerit */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full"
          style={{
            transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)`,
            transition: dragging.current ? "none" : "transform 340ms cubic-bezier(.22,1,.36,1)",
            touchAction: "pan-y",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="grid h-full w-full shrink-0 place-items-center px-3 pb-2"
              onClick={(event) => {
                // Fotoğrafın dışına dokunmak kapatsın; sürükleme sayılmasın.
                if (event.target === event.currentTarget && dragRef.current === 0) onClose();
              }}
            >
              {Math.abs(i - index) <= 1 && photo.url ? (
                <img
                  src={photo.url}
                  alt={photo.caption || `${dayLabel} fotoğrafı`}
                  draggable={false}
                  className="max-h-full max-w-full select-none rounded-[18px] object-contain"
                  style={{ boxShadow: "0 24px 60px -30px rgba(0,0,0,0.9)" }}
                />
              ) : null}
            </div>
          ))}
        </div>

        {index > 0 && <Arrow side="left" onClick={() => go(-1)} />}
        {index < photos.length - 1 && <Arrow side="right" onClick={() => go(1)} />}
      </div>

      {/* ------------------------------------------------------- alt şerit */}
      <div
        className="flex flex-col gap-3 px-4 pt-3"
        style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
      >
        {current.caption && (
          <p className="mx-auto max-w-[680px] text-center text-[14px] font-semibold leading-[1.45] text-[#EFE0FF] [text-wrap:pretty]">
            {current.caption}
          </p>
        )}

        {photos.length > 1 && (
          <div className="flex justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`${i + 1}. fotoğrafa git`}
                aria-current={i === index}
                className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] transition-[border-color,opacity]"
                style={{
                  border: `2px solid ${i === index ? "#FBD34F" : "rgba(255,248,239,0.22)"}`,
                  opacity: i === index ? 1 : 0.6,
                }}
              >
                {photo.url && (
                  <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki fotoğraf" : "Sonraki fotoğraf"}
      className={`absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-[#2E1065] transition-colors hover:bg-white sm:grid ${
        side === "left" ? "left-3" : "right-3"
      }`}
      style={{ background: "#FFF8EF", boxShadow: "0 5px 0 rgba(0,0,0,0.25)" }}
    >
      <Icon className="h-6 w-6" strokeWidth={3} />
    </button>
  );
}
