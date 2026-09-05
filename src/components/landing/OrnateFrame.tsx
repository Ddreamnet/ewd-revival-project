import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Pembe inci çerçeve — `cerceve.jpeg` referansının vektörel karşılığı.
 *
 * Referans bir fotoğraftı: ölçeklenince bulanıklaşır, dört köşesi sabit oranda
 * gerilirdi. Burada çerçeve tek bir SVG olarak çiziliyor; kalınlık her zaman
 * piksel cinsinden sabit kalır, inciler kutu ne kadar büyürse o kadar çoğalır.
 *
 * Katmanlar dıştan içe (kalınlığın katı olarak):
 *   0.00  dış kenar gölgesi      0.28  geniş yüz (ana pembe)
 *   0.06  parlak dış pah         0.56  içe basamak (koyu çizgi)
 *   0.22  oluk (koyu çizgi)      0.61  inci kanalı → inciler → iç dudak
 *
 * `children` çerçevenin ağzına oturur: SVG arkada durur, medya kutusu tam
 * açıklık ölçüsünde yuvarlatılıp kırpılır — köşeler çerçevenin üstüne taşmaz.
 */

/** İnciler kalınlığa göre ölçülür: yarıçap ve merkezler arası aralık. */
const PEARL_GAP = 0.34;
const PEARL_RADIUS = 0.15;

interface OrnateFrameProps {
  children: ReactNode;
  /** Verilmezse kutunun kısa kenarından hesaplanır. */
  thickness?: number;
  className?: string;
  style?: CSSProperties;
}

export function OrnateFrame({ children, thickness, className = "", style }: OrnateFrameProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const sync = () => {
      const rect = host.getBoundingClientRect();
      setBox((prev) =>
        Math.abs(prev.w - rect.width) < 0.5 && Math.abs(prev.h - rect.height) < 0.5
          ? prev
          : { w: rect.width, h: rect.height },
      );
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const { w, h } = box;
  // Kalınlık kısa kenarın oranı: dar ekranda çerçeve fotoğrafı yutmasın,
  // geniş ekranda ince bir şerit gibi kalmasın.
  const t = Math.round(thickness ?? Math.max(18, Math.min(46, Math.min(w, h) * 0.075)));
  const outerRadius = t * 1.05;
  const openRadius = Math.max(6, outerRadius - t);
  const ready = w > 4 * t && h > 4 * t;

  return (
    <div ref={hostRef} className={`relative ${className}`} style={style}>
      {ready && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${uid}-bevel`} x1="0" y1="0" x2="0.25" y2="1">
              <stop offset="0" stopColor="#FCDCE7" />
              <stop offset="0.42" stopColor="#F0B0C7" />
              <stop offset="1" stopColor="#D98BA8" />
            </linearGradient>
            <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="0.2" y2="1">
              <stop offset="0" stopColor="#F6C4D6" />
              <stop offset="0.38" stopColor="#E9A0B9" />
              <stop offset="1" stopColor="#D07E9C" />
            </linearGradient>
            <linearGradient id={`${uid}-channel`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#CE7F9C" />
              <stop offset="1" stopColor="#E099B3" />
            </linearGradient>
            <radialGradient id={`${uid}-pearl`} cx="0.32" cy="0.26" r="0.8">
              <stop offset="0" stopColor="#FFF8FB" />
              <stop offset="0.34" stopColor="#FADFE8" />
              <stop offset="0.72" stopColor="#EFB0C6" />
              <stop offset="1" stopColor="#C97292" />
            </radialGradient>
          </defs>

          {/* Dıştan içe iç içe geçen bantlar — her biri bir öncekinin üstüne
              biner, aradaki fark o katmanın genişliği kadar bir şerit bırakır. */}
          <Band w={w} h={h} inset={0} radius={outerRadius} fill="#CB7391" />
          <Band w={w} h={h} inset={t * 0.06} radius={outerRadius} fill={`url(#${uid}-bevel)`} />
          <Band w={w} h={h} inset={t * 0.22} radius={outerRadius} fill="#CE7C99" />
          <Band w={w} h={h} inset={t * 0.28} radius={outerRadius} fill={`url(#${uid}-face)`} />
          <Band w={w} h={h} inset={t * 0.56} radius={outerRadius} fill="#B96181" />
          <Band w={w} h={h} inset={t * 0.61} radius={outerRadius} fill={`url(#${uid}-channel)`} />

          {pearlPoints(w, h, t, outerRadius).map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r={t * PEARL_RADIUS} fill={`url(#${uid}-pearl)`} />
          ))}

          <Band w={w} h={h} inset={t * 0.9} radius={outerRadius} fill="#FBDCE6" />
          <Band w={w} h={h} inset={t * 0.965} radius={outerRadius} fill="#C87796" />
        </svg>
      )}

      {/* Medya kutusu: çerçevenin ağzıyla aynı ölçüde yuvarlatılır, iç gölge
          fotoğrafı çerçevenin içine oturtur. */}
      <div className="relative" style={{ padding: ready ? t : 0 }}>
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: ready ? openRadius : 0,
            boxShadow: ready ? "inset 0 2px 12px rgba(90,26,54,0.32)" : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Kutunun `inset` kadar içine çekilmiş, köşeleri orantılı yuvarlatılmış dolgu. */
function Band({
  w,
  h,
  inset,
  radius,
  fill,
}: {
  w: number;
  h: number;
  inset: number;
  radius: number;
  fill: string;
}) {
  return (
    <rect
      x={inset}
      y={inset}
      width={Math.max(0, w - inset * 2)}
      height={Math.max(0, h - inset * 2)}
      rx={Math.max(2, radius - inset)}
      ry={Math.max(2, radius - inset)}
      fill={fill}
    />
  );
}

/**
 * İnci dizisinin merkez noktaları: yuvarlatılmış dikdörtgenin çevresi eşit
 * aralığa bölünür. Aralık çevreye göre yuvarlandığı için dizi köşelerde
 * kırılmadan kapanır — sabit adım kullanılsa son inci ile ilk inci çakışırdı.
 */
function pearlPoints(w: number, h: number, t: number, outerRadius: number): [number, number][] {
  const inset = t * 0.745;
  const x = inset;
  const y = inset;
  const bw = w - inset * 2;
  const bh = h - inset * 2;
  const r = Math.max(2, Math.min(outerRadius - inset, Math.min(bw, bh) / 2));

  const sideW = bw - 2 * r;
  const sideH = bh - 2 * r;
  const arc = (Math.PI / 2) * r;
  const perimeter = 2 * sideW + 2 * sideH + 4 * arc;

  const count = Math.max(12, Math.round(perimeter / (t * PEARL_GAP)));
  const step = perimeter / count;
  const points: [number, number][] = [];

  for (let i = 0; i < count; i++) {
    let d = i * step;

    if (d < sideW) {
      points.push([x + r + d, y]);
      continue;
    }
    d -= sideW;
    if (d < arc) {
      const a = -Math.PI / 2 + (d / arc) * (Math.PI / 2);
      points.push([x + bw - r + r * Math.cos(a), y + r + r * Math.sin(a)]);
      continue;
    }
    d -= arc;
    if (d < sideH) {
      points.push([x + bw, y + r + d]);
      continue;
    }
    d -= sideH;
    if (d < arc) {
      const a = (d / arc) * (Math.PI / 2);
      points.push([x + bw - r + r * Math.cos(a), y + bh - r + r * Math.sin(a)]);
      continue;
    }
    d -= arc;
    if (d < sideW) {
      points.push([x + bw - r - d, y + bh]);
      continue;
    }
    d -= sideW;
    if (d < arc) {
      const a = Math.PI / 2 + (d / arc) * (Math.PI / 2);
      points.push([x + r + r * Math.cos(a), y + bh - r + r * Math.sin(a)]);
      continue;
    }
    d -= arc;
    if (d < sideH) {
      points.push([x, y + bh - r - d]);
      continue;
    }
    d -= sideH;
    const a = Math.PI + (d / arc) * (Math.PI / 2);
    points.push([x + r + r * Math.cos(a), y + r + r * Math.sin(a)]);
  }

  return points;
}
