import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { OrnateFrame } from "@/components/landing/OrnateFrame";

/** Kaydırmanın slaytı çevirmesi için gereken en küçük yatay yol. */
const SWIPE_MIN = 40;
const SWIPE_RATIO = 0.16;
/** Bu kadar kısa ve yersiz bir hareket sürükleme değil, dokunuştur. */
const TAP_SLOP = 8;
const TAP_MS = 420;

export interface LightboxItem {
  kind: "photo" | "video";
  src: string;
  poster?: string;
  caption: string;
  tag: string;
}

export interface LightboxLabels {
  close: string;
  prev: string;
  next: string;
  goTo: string;
  play: string;
  pause: string;
  soundOn: string;
  soundOff: string;
  hint: string;
}

interface MomentLightboxProps {
  items: LightboxItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  labels: LightboxLabels;
}

/**
 * Fotoğraf ve videoların büyütüldüğü diyalog: medya pembe inci çerçevenin
 * içinde durur, slaytlar arasında ok tuşları, fare ile sürükleme ve parmakla
 * kaydırma ile geçilir.
 *
 * Sürükleme tek bir işaretçi (pointer) akışıyla yürüyor: fare, kalem ve
 * dokunma aynı koddan geçiyor. İlk birkaç pikselde hareketin ekseni
 * kilitleniyor — video üzerinde başlayan dikey bir hareket şeridi
 * oynatmıyor, kısa ve yersiz bir hareket ise dokunuş sayılıp videoyu
 * durdurup başlatıyor.
 */
export function MomentLightbox({ items, index, onIndexChange, onClose, labels }: MomentLightboxProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const drag = useRef<{ id: number; x: number; y: number; at: number; axis: null | "x" | "y" } | null>(null);

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const count = items.length;
  const current = items[index];

  const go = useCallback(
    (delta: number) => onIndexChange((index + delta + count) % count),
    [index, count, onIndexChange],
  );

  /* ---------------------------------------------------- klavye + gövde kilidi */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  useEffect(() => {
    // Diyalog açıkken arkadaki sayfa kaymasın; kapanınca eski değer geri gelsin.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      focused?.focus?.();
    };
  }, []);

  /* ------------------------------------------------------------------ video */

  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i !== index) {
        video.pause();
        video.currentTime = 0;
      }
    });

    const active = videoRefs.current[index];
    if (items[index]?.kind === "video" && active) {
      // Önce sesli açmayı dene: kullanıcı zaten tıklayarak geldiği için
      // tarayıcılar çoğunlukla izin verir. Vermeyen tarayıcıda sessize alıp
      // yeniden başlatıyoruz; ziyaretçi hoparlör düğmesiyle sesi açabilir.
      active.muted = false;
      setMuted(false);
      active.play().then(
        () => setPlaying(true),
        () => {
          active.muted = true;
          setMuted(true);
          active.play().then(
            () => setPlaying(true),
            () => setPlaying(false),
          );
        },
      );
    } else {
      setPlaying(false);
    }
  }, [index, items]);

  const toggleMuted = useCallback(() => {
    const video = videoRefs.current[index];
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted && video.paused) {
      video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  }, [index]);

  const togglePlay = useCallback(() => {
    const video = videoRefs.current[index];
    if (!video) return;
    if (video.paused) {
      video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    } else {
      video.pause();
      setPlaying(false);
    }
  }, [index]);

  /* --------------------------------------------------------------- sürükleme */

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: Date.now(), axis: null };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const state = drag.current;
    if (!state || state.id !== e.pointerId) return;
    const dx = e.clientX - state.x;
    const dy = e.clientY - state.y;

    if (!state.axis) {
      if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return;
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (state.axis === "x") stageRef.current?.setPointerCapture(e.pointerId);
    }
    if (state.axis === "x") setOffset(dx);
  };

  const endDrag = (e: React.PointerEvent) => {
    const state = drag.current;
    if (!state || state.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    setOffset(0);

    const dx = e.clientX - state.x;
    const width = stageRef.current?.clientWidth ?? 1;
    const threshold = Math.max(SWIPE_MIN, width * SWIPE_RATIO);

    if (state.axis === "x" && Math.abs(dx) > threshold && count > 1) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    const dy = e.clientY - state.y;
    const isTap =
      !state.axis &&
      Math.abs(dx) < TAP_SLOP &&
      Math.abs(dy) < TAP_SLOP &&
      Date.now() - state.at < TAP_MS;
    if (isTap && current?.kind === "video") togglePlay();
  };

  /* ------------------------------------------------------------------ çizim */

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current?.caption}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-y-auto overscroll-contain px-3 py-5 sm:px-6"
      style={{ background: "rgba(28,8,60,0.88)", backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={labels.close}
        className="absolute right-3 top-3 z-20 grid h-12 w-12 place-items-center rounded-full text-[#6D28D9] transition-colors hover:bg-white sm:right-6 sm:top-6"
        style={{ background: "#FFF8EF", boxShadow: "0 5px 0 #7E3D96" }}
      >
        <X className="h-6 w-6" strokeWidth={3} />
      </button>

      <div className="relative flex w-full max-w-[980px] flex-col items-center">
        <div className="relative w-full">
          <OrnateFrame className="w-full">
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="relative overflow-hidden bg-[#2E1065] select-none"
              style={{
                aspectRatio: "16 / 10",
                touchAction: "none",
                cursor: dragging ? "grabbing" : "grab",
              }}
            >
              <div
                className="flex h-full w-full"
                style={{
                  transform: `translateX(calc(${-index * 100}% + ${offset}px))`,
                  transition: dragging
                    ? "none"
                    : "transform 520ms cubic-bezier(.22,1,.36,1)",
                }}
              >
                {items.map((item, i) => (
                  <div key={item.src} className="h-full w-full shrink-0">
                    {item.kind === "photo" ? (
                      <img
                        src={item.src}
                        alt={item.caption}
                        draggable={false}
                        className="pointer-events-none h-full w-full object-contain"
                      />
                    ) : (
                      <video
                        ref={(el) => {
                          videoRefs.current[i] = el;
                        }}
                        src={item.src}
                        poster={item.poster || undefined}
                        loop
                        playsInline
                        preload="metadata"
                        controlsList="nodownload"
                        className="pointer-events-none h-full w-full object-contain"
                      />
                    )}
                  </div>
                ))}
              </div>

              {current?.kind === "video" && (
                <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2.5">
                  <StageControl
                    label={playing ? labels.pause : labels.play}
                    onClick={togglePlay}
                    dim={playing}
                  >
                    {playing ? (
                      <Pause className="h-5 w-5" strokeWidth={3} />
                    ) : (
                      <Play className="ml-0.5 h-5 w-5" strokeWidth={3} />
                    )}
                  </StageControl>
                  <StageControl
                    label={muted ? labels.soundOn : labels.soundOff}
                    onClick={toggleMuted}
                    dim={!muted}
                  >
                    {muted ? (
                      <VolumeX className="h-5 w-5" strokeWidth={3} />
                    ) : (
                      <Volume2 className="h-5 w-5" strokeWidth={3} />
                    )}
                  </StageControl>
                </div>
              )}

              <span
                className="pointer-events-none absolute right-4 top-4 rounded-full px-3.5 py-2 text-[11px] font-black tracking-[0.12em]"
                style={{ background: "#FBD34F", color: "#6B4A00" }}
              >
                {current?.tag}
              </span>
            </div>
          </OrnateFrame>

          {count > 1 && (
            <>
              <StageArrow side="left" label={labels.prev} onClick={() => go(-1)} />
              <StageArrow side="right" label={labels.next} onClick={() => go(1)} />
            </>
          )}
        </div>

        <p className="mt-5 max-w-[640px] text-center text-[15px] font-semibold leading-[1.45] text-[#F5E9FF] [text-wrap:pretty] sm:text-[17px]">
          {current?.caption}
        </p>

        {count > 1 && (
          <>
            <div className="flex items-center justify-center gap-2.5 pt-4">
              {items.map((item, i) => (
                <button
                  key={item.src}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`${labels.goTo} ${i + 1}`}
                  aria-current={i === index}
                  className="ewd-hit-44 h-2.5 rounded-full transition-[width,background-color] duration-[400ms]"
                  style={{
                    width: i === index ? 34 : 10,
                    background: i === index ? "#FBD34F" : "rgba(255,248,239,0.4)",
                  }}
                />
              ))}
            </div>
            <p className="pt-3 text-center text-[12px] font-semibold tracking-[0.04em] text-[#C4A6E8]">
              {labels.hint}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Sahnenin sol altındaki küçük denetim düğmesi (oynat/duraklat, ses).
 * `dim`: iş görürken geri çekilsin — video oynarken düğmeler öne çıkmasın.
 */
function StageControl({
  label,
  onClick,
  dim,
  children,
}: {
  label: string;
  onClick: () => void;
  dim: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid h-12 w-12 place-items-center rounded-full text-[#6D28D9] transition-opacity hover:bg-white hover:opacity-100 ${
        dim ? "opacity-60" : "opacity-100"
      }`}
      style={{ background: "#FFF8EF", boxShadow: "0 4px 0 #C9B6F5" }}
    >
      {children}
    </button>
  );
}

/** Çerçevenin iki yanındaki ok — dar ekranda çerçeveye biraz biner. */
function StageArrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-[#6D28D9] transition-colors hover:bg-white lg:h-[60px] lg:w-[60px] ${
        side === "left" ? "-left-1 lg:-left-9" : "-right-1 lg:-right-9"
      }`}
      style={{ background: "#FFF8EF", boxShadow: "0 5px 0 #C9B6F5" }}
    >
      <Icon className="h-6 w-6" strokeWidth={3} />
    </button>
  );
}
