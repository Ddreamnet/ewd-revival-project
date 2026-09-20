/**
 * UUID v4 üretir.
 *
 * `crypto.randomUUID` iOS 15.4 ile geldi; uygulamanın asgari hedefi iOS 15.0
 * olduğu için 15.0–15.3 cihazlarda tanımsız ve çağıran akış (ödev yükleme)
 * orada çöküyordu. `getRandomValues` her hedefte var.
 */
export function yeniUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // sürüm 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 varyantı
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
