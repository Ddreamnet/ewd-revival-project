/**
 * İstanbul gezisi günlüğü — sabitler ve tarih yardımcıları.
 *
 * Gezinin gün listesi veritabanında tutulmuyor; aralık burada tanımlı ve
 * sayfa günleri buradan üretiyor. Bir gün için yazı ya da fotoğraf eklenene
 * kadar `trip_days` / `trip_activities` / `trip_photos` tablolarında o güne
 * ait hiçbir satır olmaması normaldir.
 */

/** Gezinin ilk günü (dahil). */
export const TRIP_START = "2026-08-19";
/** Gezinin son günü (dahil). */
export const TRIP_END = "2026-09-03";

/** Fotoğrafların durduğu kapalı depo. */
export const TRIP_BUCKET = "trip-media";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/** "2026-08-25" → yerel saat diliminde o günün başı. (new Date(str) UTC okur, günü kaydırırdı.) */
function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatKey(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Geziye ait günler, ilk günden sonuncuya. */
export const TRIP_DAYS: string[] = (() => {
  const out: string[] = [];
  const cursor = parseDay(TRIP_START);
  const end = parseDay(TRIP_END);
  while (cursor <= end) {
    out.push(formatKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
})();

export interface DayLabel {
  /** "25" */
  dayOfMonth: string;
  /** "Ağustos" */
  month: string;
  /** "Ağu" */
  monthShort: string;
  /** "Pazartesi" */
  weekday: string;
  /** "25 Ağustos" */
  long: string;
  /** "25 Ağu" — dar yerler için. */
  short: string;
}

export function labelFor(day: string): DayLabel {
  const date = parseDay(day);
  const dayOfMonth = `${date.getDate()}`;
  const month = MONTHS[date.getMonth()];
  const monthShort = MONTHS_SHORT[date.getMonth()];
  return {
    dayOfMonth,
    month,
    monthShort,
    weekday: WEEKDAYS[date.getDay()],
    long: `${dayOfMonth} ${month}`,
    short: `${dayOfMonth} ${monthShort}`,
  };
}

/** "25 Ağustos – 3 Eylül 2026" */
export const TRIP_RANGE_LABEL = (() => {
  const start = labelFor(TRIP_START);
  const end = labelFor(TRIP_END);
  return `${start.long} – ${end.long} ${parseDay(TRIP_END).getFullYear()}`;
})();

/** Gündeki sıra: ilk gün 1. */
export function dayNumber(day: string): number {
  return TRIP_DAYS.indexOf(day) + 1;
}

/** Gün bölümünün çapa kimliği — üstteki tarih şeridi buraya kaydırıyor. */
export function dayAnchor(day: string): string {
  return `gun-${day}`;
}

/**
 * Bir günün bittiği saat.
 *
 * Gece devam eden bir gün, saat 24'ü geçtiği için takvimde ertesi güne
 * düşüyor. Sabah 06:00'dan önce çekilen fotoğraf hâlâ önceki günün.
 */
export const DAY_CUTOFF_HOUR = 6;

/** Çekim anını ait olduğu gezi gününe çevirir (06:00 kuralıyla). */
export function tripDayFor(moment: Date): string {
  const shifted = new Date(moment.getTime());
  shifted.setHours(shifted.getHours() - DAY_CUTOFF_HOUR);
  return formatKey(shifted);
}

/** Gezi aralığının dışına düşen günü en yakın gezi gününe çeker. */
export function clampToTrip(day: string): string {
  if (day < TRIP_START) return TRIP_START;
  if (day > TRIP_END) return TRIP_END;
  return day;
}

/** Gün gezi aralığında mı? (ISO tarihler dizgi olarak sıralanabilir.) */
export function isTripDay(day: string): boolean {
  return day >= TRIP_START && day <= TRIP_END;
}
