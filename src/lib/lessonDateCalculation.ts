/**
 * Local, query-free schedule checks used purely for messaging.
 *
 * Date placement itself lives on the server (free_lesson_slots and the
 * rpc_* reschedule functions); nothing here decides where a lesson goes.
 */

import { parseLocalDate } from "./lessonTypes";

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/**
 * A note for the admin when a date they picked falls outside the student's
 * usual lesson days. Informational only — the move still goes through.
 * Returns null when every date lands on a template day.
 */
export function nonTemplateWeekdayWarning(
  dateStrings: string[],
  templateDaysOfWeek: number[]
): string | null {
  if (templateDaysOfWeek.length === 0) return null;

  const offDays = [
    ...new Set(
      dateStrings
        .map((d) => parseLocalDate(d).getDay())
        .filter((dow) => !templateDaysOfWeek.includes(dow))
    ),
  ];
  if (offDays.length === 0) return null;

  const picked = offDays.map((d) => DAY_NAMES[d]).join(", ");
  const usual = [...new Set(templateDaysOfWeek)].sort().map((d) => DAY_NAMES[d]).join(", ");
  return `Seçilen ${picked} günü öğrencinin normal ders günlerinden (${usual}) farklı.`;
}
