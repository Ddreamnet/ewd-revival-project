/**
 * Panelin küçük biçimlendirme / eşleme yardımcıları.
 * Bileşen dosyalarından ayrı tutuluyor ki hot-reload bileşen sınırlarını
 * kaybetmesin.
 */

/** 4800 → "80 sa"; 95 → "1 sa 35 dk"; 45 → "45 dk". */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} dk`;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

/**
 * Ders rayının satır başına kaç kutu göstereceği.
 *
 * Paket dengeli satırlara bölünsün: 4 derslik paket tek satır, 8 derslik
 * paket 4'er 4'er iki satır, 12 derslik paket 6'şar iki satır. (Eski
 * panelin `getRowConfig` davranışının aynısı.)
 */
export function railColumns(total: number): number {
  if (total <= 0) return 1;
  if (total <= 4) return total;
  if (total <= 8) return 4;
  return 6;
}

/**
 * Bir adı iki marka renginden birine kararlı biçimde eşler.
 * Tasarımda ilk öğrenci mor, ikincisi pembe; liste sırası değişse de aynı
 * öğrenci her ekranda aynı renkte görünsün diye ada göre türetiliyor.
 */
export function toneForName(name: string): "purple" | "pink" {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 2 === 0 ? "purple" : "pink";
}
