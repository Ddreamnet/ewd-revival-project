/**
 * Adminin "bugünün planı" kartı günde bir kez kendiliğinden açılır; hangi gün
 * gösterildiği tarayıcıda saklanır (bkz. components/admin/TodayPlanDialog).
 */
import { toDateStr } from "./lessonTypes";

const SHOWN_KEY = "ewd.admin.todayPlan.shown";

/** Plan bugün hiç gösterilmediyse true döner ve bugünü "gösterildi" yazar. */
export function claimDailyPlan(): boolean {
  const today = toDateStr(new Date());
  try {
    if (localStorage.getItem(SHOWN_KEY) === today) return false;
    localStorage.setItem(SHOWN_KEY, today);
    return true;
  } catch {
    // Depolama kapalı (gizli sekme): her açılışta sormaktansa hiç açma.
    return false;
  }
}
