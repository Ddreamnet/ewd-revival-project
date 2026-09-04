/**
 * Yalova & İstanbul gezisi — kişisel günlük.
 *
 * Panelin ya da sitenin geri kalanıyla ilgisi yok: menülerde görünmez,
 * arama motorlarına kapalıdır ve admin dışında biri adresi bilse bile 404
 * görür. Tasarım dili landing sayfasının aynısı (krem zemin, mor mürekkep,
 * el yazısı vurgular) — orada olduğu gibi burada da koyu mod yok.
 *
 * Yol `/mytriptolove`; sayfaya panelin sağ üstündeki kalp düğmesinden girilir.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Heart, Loader2, Lock, Pencil } from "lucide-react";

import { BackSwipeWrapper } from "@/components/BackSwipeWrapper";
import { TripBulkUpload } from "@/components/trip/TripBulkUpload";
import { TripDayCard } from "@/components/trip/TripDayCard";
import { TripLightbox } from "@/components/trip/TripLightbox";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTripDiary } from "@/hooks/useTripDiary";
import { useAndroidBackButton } from "@/hooks/usePanelPlatform";
import { TRIP_DAYS, TRIP_RANGE_LABEL, dayAnchor, labelFor } from "@/lib/trip";
import NotFound from "./NotFound";

export default function TripPage() {
  const { profile, initializing, loading: authLoading } = useAuthContext();
  const isAdmin = profile?.roles?.includes("admin") ?? false;

  /* Arama motorları bu sayfayı hiç görmesin. */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  if (initializing || (authLoading && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--ewd-cream)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--ewd-purple)" }} />
      </div>
    );
  }

  // Gizli sayfa: yetkisi olmayan için var olmasın.
  if (!isAdmin) return <NotFound />;

  return <TripDiary />;
}

function TripDiary() {
  const navigate = useNavigate();
  const diary = useTripDiary();
  const [editing, setEditing] = useState(false);
  const [viewer, setViewer] = useState<{ day: string; index: number } | null>(null);
  const [activeDay, setActiveDay] = useState(TRIP_DAYS[0]);
  const stripRef = useRef<HTMLDivElement>(null);

  /* Sekme başlığı — sayfadan çıkınca eski hâline döner. */
  useEffect(() => {
    const previous = document.title;
    document.title = "Yalova & İstanbul gezisi";
    return () => {
      document.title = previous;
    };
  }, []);

  const openPhoto = useCallback((day: string, index: number) => setViewer({ day, index }), []);
  const closeViewer = useCallback(() => setViewer(null), []);

  /* Android geri tuşu: önce görüntüleyiciyi kapatır, sonra panele döner. */
  useAndroidBackButton(() => {
    if (viewer) {
      setViewer(null);
      return true;
    }
    navigate("/dashboard");
    return true;
  });

  /* Üstteki tarih şeridi hangi günde olduğumuzu göstersin. */
  useEffect(() => {
    if (diary.loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const topMost = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (topMost) setActiveDay(topMost.target.id.replace("gun-", ""));
      },
      { rootMargin: "-110px 0px -55% 0px" },
    );
    for (const day of TRIP_DAYS) {
      const element = document.getElementById(dayAnchor(day));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [diary.loading]);

  /* Etkin tarih şeridin dışında kalmasın — yalnızca şeridi kaydırır. */
  useEffect(() => {
    const strip = stripRef.current;
    const pill = strip?.querySelector<HTMLElement>(`[data-day="${activeDay}"]`);
    if (!strip || !pill) return;
    const target = pill.offsetLeft - strip.clientWidth / 2 + pill.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeDay]);

  const goToDay = (day: string) => {
    document.getElementById(dayAnchor(day))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const viewerPhotos = useMemo(
    () => (viewer ? (diary.days.find((d) => d.day === viewer.day)?.photos ?? []) : []),
    [viewer, diary.days],
  );

  /* Açıkken son fotoğraf silinirse görüntüleyici boşluğa bakmasın. */
  useEffect(() => {
    if (!viewer) return;
    if (viewerPhotos.length === 0) setViewer(null);
    else if (viewer.index > viewerPhotos.length - 1) {
      setViewer({ day: viewer.day, index: viewerPhotos.length - 1 });
    }
  }, [viewer, viewerPhotos]);

  return (
    <BackSwipeWrapper>
      {/* Dış kap zoom'un dışında: içerideki 100vh %75'e indiği için sayfanın
          altında kalan şerit de krem kalsın. */}
      <div className="ewd-light min-h-screen" style={{ background: "var(--ewd-cream)" }}>
      {/* Sayfa bir adım geriden görünsün diye %75: tarayıcı uzaklaştırması gibi
          yeniden akar (transform: scale'in aksine yapışkan şerit ve kaydırma
          bozulmaz). Tam ekran fotoğraf görüntüleyici bunun dışında — o ekranı
          doldurmalı. */}
      <div className="landing-body min-h-screen" style={{ background: "var(--ewd-cream)", zoom: 0.75 }}>
        {/* ============================================================ giriş */}
        <header className="px-4 pb-6 pt-4 sm:px-6">
          <div
            className="ewd-dots relative mx-auto max-w-[1080px] overflow-hidden rounded-[30px] border-[3px] px-5 py-6 sm:rounded-[38px] sm:px-8 sm:py-8"
            style={{
              background: "var(--ewd-cream-hi)",
              borderColor: "#EFDFF9",
              ["--dot" as string]: "#F3D9E6",
              boxShadow: "var(--ewd-shadow-card)",
            }}
          >
            {/* Sağ üst köşede eriyen yıldız dokusu — landing'in kart süslemeleri gibi. */}
            <span
              className="pointer-events-none absolute -right-10 -top-10 h-[260px] w-[300px] opacity-[0.35]"
              style={{
                backgroundImage: "url(/ewd/pat/tile-star-pink.png)",
                backgroundSize: "150px",
                maskImage: "radial-gradient(closest-side, #000, transparent)",
                WebkitMaskImage: "radial-gradient(closest-side, #000, transparent)",
              }}
              aria-hidden="true"
            />

            <div className="relative flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-2 rounded-full border-2 bg-white px-4 py-2.5 text-[13px] font-extrabold transition-colors hover:bg-[#F4EDFF]"
                style={{ borderColor: "var(--ewd-lilac-line-soft)", color: "var(--ewd-ink)" }}
              >
                <ArrowLeft className="h-4 w-4" />
                Panele dön
              </button>

              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className={`ewd-btn ewd-btn--sm ${editing ? "ewd-btn--purple" : "ewd-btn--outline"}`}
              >
                {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                {editing ? "Bitti" : "Düzenle"}
              </button>
            </div>

            <div className="relative mt-6 flex flex-col items-start gap-2.5">
              <span
                className="ewd-label rounded-full px-5 py-2.5"
                style={{ background: "#FBD34F", color: "#6B4A00" }}
              >
                {TRIP_RANGE_LABEL}
              </span>

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="ewd-h2">Yalova &amp; İstanbul</h1>
                <span className="ewd-script text-[40px] leading-none text-[#EC4899] sm:text-[56px]">
                  gezisi
                </span>
              </div>

              <p className="ewd-lead max-w-[620px]">
                Yalova'dan İstanbul'a, {TRIP_DAYS.length} günün günlüğü: her gün ne yaptığımız ve o
                günden kalan kareler. Bir günü açmak için üstteki tarihlere, fotoğrafı büyütmek için
                karelere dokunun.
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Stat text={`${TRIP_DAYS.length} gün`} />
                <Stat text={`${diary.photoCount} fotoğraf`} />
                <Stat text={`${diary.activityCount} not`} />
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
                  style={{ background: "var(--ewd-lilac-tint)", color: "var(--ewd-purple-deep)" }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Yalnızca sen görüyorsun
                </span>
              </div>
            </div>
          </div>
        </header>

        <TripBulkUpload diary={diary} />

        {/* ==================================================== tarih şeridi */}
        <nav
          className="sticky top-0 z-30 border-y-2"
          style={{
            background: "rgba(255,248,239,0.94)",
            backdropFilter: "blur(10px)",
            borderColor: "var(--ewd-lilac-hair)",
          }}
        >
          <div
            ref={stripRef}
            className="mx-auto flex max-w-[1080px] gap-2 overflow-x-auto px-4 py-2.5 sm:px-6"
            style={{ scrollbarWidth: "none" }}
          >
            {TRIP_DAYS.map((day) => {
              const label = labelFor(day);
              const active = day === activeDay;
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  onClick={() => goToDay(day)}
                  aria-current={active}
                  className="shrink-0 rounded-full border-2 px-3.5 py-2 text-[13px] font-extrabold transition-colors"
                  style={{
                    background: active ? "var(--ewd-purple-deep)" : "#FFFDF8",
                    borderColor: active ? "var(--ewd-purple-deep)" : "var(--ewd-lilac-line-soft)",
                    color: active ? "#FFF8EF" : "var(--ewd-ink)",
                  }}
                >
                  {label.short}
                </button>
              );
            })}
          </div>
        </nav>

        {/* =========================================================== günler */}
        <main className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
          {diary.loading
            ? TRIP_DAYS.slice(0, 3).map((day) => (
                <div
                  key={day}
                  className="h-56 animate-pulse rounded-[34px]"
                  style={{ background: "var(--ewd-lilac-tint)" }}
                />
              ))
            : diary.days.map((data) => (
                <TripDayCard
                  key={data.day}
                  data={data}
                  editing={editing}
                  upload={diary.upload?.day === data.day ? diary.upload : null}
                  diary={diary}
                  onOpenPhoto={openPhoto}
                />
              ))}
        </main>

        <footer className="px-4 pb-12 text-center sm:px-6">
          <p
            className="inline-flex items-center gap-2 text-[13px] font-bold"
            style={{ color: "var(--ewd-faint)" }}
          >
            <Heart className="h-4 w-4" style={{ color: "#EC4899" }} />
            Yalova &amp; İstanbul, {TRIP_RANGE_LABEL}
          </p>
        </footer>
      </div>
      </div>

      {viewer && viewerPhotos.length > 0 && (
        <TripLightbox
          photos={viewerPhotos}
          index={Math.min(viewer.index, viewerPhotos.length - 1)}
          dayLabel={`${labelFor(viewer.day).long} ${labelFor(viewer.day).weekday}`}
          onIndexChange={(index) => setViewer({ day: viewer.day, index })}
          onClose={closeViewer}
        />
      )}
    </BackSwipeWrapper>
  );
}

function Stat({ text }: { text: string }) {
  return (
    <span
      className="rounded-full px-3 py-1.5 text-[12px] font-bold"
      style={{ background: "#FFFDF8", border: "2px solid var(--ewd-lilac-line-soft)", color: "var(--ewd-ink)" }}
    >
      {text}
    </span>
  );
}
