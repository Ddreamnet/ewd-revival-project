import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrackingRecord {
  id: string;
  student_id: string;
  teacher_id: string;
  lessons_per_week: number;
  completed_lessons: string; // JSON string: '["1","2","3"]'
  lesson_dates: string; // JSON string: '{"1":"2026-03-05",...}'
  month_start_date: string;
  created_at: string;
  updated_at: string;
}

interface LessonSlot {
  id: string;
  student_id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface BalanceRecord {
  id: string;
  teacher_id: string;
  total_minutes: number;
  completed_regular_lessons: number;
  completed_trial_lessons: number;
  regular_lessons_minutes: number;
  trial_lessons_minutes: number;
}

// Returns day of week (0=Sun, 1=Mon, ... 6=Sat) for a date string 'YYYY-MM-DD'
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.getUTCDay();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const dryRun: boolean = body.dry_run !== false; // default to dry_run=true
    const tracking: TrackingRecord[] = body.tracking || [];
    const lessons: LessonSlot[] = body.lessons || [];
    const balance: BalanceRecord[] = body.balance || [];

    const log: string[] = [];
    const manualReview: string[] = [];
    const errors: string[] = [];

    log.push(`=== DATA RECOVERY ${dryRun ? "(DRY RUN)" : "(LIVE)"} ===`);
    log.push(`Tracking records: ${tracking.length}`);
    log.push(`Lesson slots: ${lessons.length}`);
    log.push(`Balance records: ${balance.length}`);

    // Step 0: Get archived students
    const { data: archivedStudents } = await supabase
      .from("students")
      .select("student_id, teacher_id")
      .eq("is_archived", true);

    const archivedSet = new Set(
      (archivedStudents || []).map((s: any) => `${s.student_id}|${s.teacher_id}`)
    );
    log.push(`Archived students: ${archivedSet.size}`);

    // Build template lookup: student_id|teacher_id → slots[]
    const templateMap = new Map<string, LessonSlot[]>();
    for (const slot of lessons) {
      const key = `${slot.student_id}|${slot.teacher_id}`;
      if (!templateMap.has(key)) templateMap.set(key, []);
      templateMap.get(key)!.push(slot);
    }

    // Sort each template by day_of_week, then start_time
    for (const [, slots] of templateMap) {
      slots.sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      });
    }

    // =============================================
    // PHASE 1: Process lesson_instances rebuild
    // =============================================
    log.push("\n=== PHASE 1: LESSON INSTANCES REBUILD ===");

    let totalDeleted = 0;
    let totalInserted = 0;
    let lpwUpdates = 0;

    for (const tr of tracking) {
      const studentTeacherKey = `${tr.student_id}|${tr.teacher_id}`;

      // Skip archived
      if (archivedSet.has(studentTeacherKey)) {
        log.push(`SKIP archived: ${tr.student_id}`);
        continue;
      }

      // Parse completed_lessons and lesson_dates
      let completedLessons: string[] = [];
      let lessonDates: Record<string, string> = {};

      try {
        completedLessons = JSON.parse(tr.completed_lessons || "[]");
      } catch {
        errors.push(`Failed to parse completed_lessons for ${tr.student_id}`);
        continue;
      }

      try {
        lessonDates = JSON.parse(tr.lesson_dates || "{}");
      } catch {
        errors.push(`Failed to parse lesson_dates for ${tr.student_id}`);
        continue;
      }

      const completedSet = new Set(completedLessons.map(String));
      const lessonDateEntries = Object.entries(lessonDates)
        .map(([k, v]) => ({ lessonNumber: parseInt(k), date: v }))
        .sort((a, b) => a.lessonNumber - b.lessonNumber);

      // If no lesson_dates, skip (nothing to rebuild)
      if (lessonDateEntries.length === 0) {
        // Check if there are completed lessons with no dates (edge case)
        if (completedLessons.length > 0) {
          manualReview.push(
            `${tr.student_id}: has ${completedLessons.length} completed but empty lesson_dates`
          );
        }
        log.push(`SKIP empty lesson_dates: ${tr.student_id}`);
        continue;
      }

      // Get templates for this student
      const templates = templateMap.get(studentTeacherKey) || [];

      if (templates.length === 0) {
        manualReview.push(
          `${tr.student_id}: has ${lessonDateEntries.length} lesson_dates but NO template slots`
        );
        continue;
      }

      // ---- lessons_per_week resolution ----
      const slotCount = templates.length;
      const inferredLpw = Math.ceil(lessonDateEntries.length / 4);
      const trackingLpw = tr.lessons_per_week;

      let resolvedLpw: number;
      if (slotCount === inferredLpw) {
        resolvedLpw = slotCount; // unanimous
      } else if (slotCount === trackingLpw) {
        resolvedLpw = slotCount; // 2 of 3 agree
      } else if (inferredLpw === trackingLpw) {
        resolvedLpw = inferredLpw; // 2 of 3 agree
      } else {
        // All 3 differ
        manualReview.push(
          `${tr.student_id}: lpw conflict - slots=${slotCount}, inferred=${inferredLpw}, tracking=${trackingLpw}. Using slot_count.`
        );
        resolvedLpw = slotCount; // default to template slots
      }

      // Build template lookup by day_of_week
      const templatesByDay = new Map<number, LessonSlot[]>();
      for (const t of templates) {
        if (!templatesByDay.has(t.day_of_week)) templatesByDay.set(t.day_of_week, []);
        templatesByDay.get(t.day_of_week)!.push(t);
      }

      // ---- Map lesson_dates to instances ----
      // Group lessons by date
      const lessonsByDate = new Map<string, number[]>();
      for (const entry of lessonDateEntries) {
        if (!lessonsByDate.has(entry.date)) lessonsByDate.set(entry.date, []);
        lessonsByDate.get(entry.date)!.push(entry.lessonNumber);
      }

      const instancesForInsert: any[] = [];
      const unmatchedSlots = [...templates].sort((a, b) => a.start_time.localeCompare(b.start_time));
      let unmatchedIdx = 0;

      for (const [dateStr, lessonNums] of lessonsByDate) {
        lessonNums.sort((a, b) => a - b);
        const dow = getDayOfWeek(dateStr);
        const daySlots = templatesByDay.get(dow) || [];

        // Sort day slots by start_time ASC
        const sortedDaySlots = [...daySlots].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        );

        for (let i = 0; i < lessonNums.length; i++) {
          const ln = lessonNums[i];
          let startTime: string;
          let endTime: string;

          if (i < sortedDaySlots.length) {
            // Direct match to day-of-week template slot
            startTime = sortedDaySlots[i].start_time;
            endTime = sortedDaySlots[i].end_time;
          } else {
            // No matching slot for this day → rescheduled lesson
            // Use next unmatched template slot by global order
            if (unmatchedIdx < unmatchedSlots.length) {
              startTime = unmatchedSlots[unmatchedIdx].start_time;
              endTime = unmatchedSlots[unmatchedIdx].end_time;
              unmatchedIdx++;
              manualReview.push(
                `${tr.student_id}: lesson ${ln} on ${dateStr} (dow=${dow}) has no matching template slot for that day. Used fallback slot ${startTime}-${endTime}.`
              );
            } else {
              // No more slots to assign, use first template
              startTime = templates[0].start_time;
              endTime = templates[0].end_time;
              manualReview.push(
                `${tr.student_id}: lesson ${ln} on ${dateStr} ran out of template slots. Used first slot.`
              );
            }
          }

          const isCompleted = completedSet.has(String(ln));

          instancesForInsert.push({
            student_id: tr.student_id,
            teacher_id: tr.teacher_id,
            lesson_number: ln,
            lesson_date: dateStr,
            start_time: startTime,
            end_time: endTime,
            status: isCompleted ? "completed" : "planned",
            package_cycle: 1, // all current data is cycle 1
            rescheduled_count: 0,
          });
        }
      }

      // Renumber by chronological order
      instancesForInsert.sort((a, b) => {
        if (a.lesson_date !== b.lesson_date) return a.lesson_date.localeCompare(b.lesson_date);
        return a.start_time.localeCompare(b.start_time);
      });
      for (let i = 0; i < instancesForInsert.length; i++) {
        instancesForInsert[i].lesson_number = i + 1;
      }

      // Validate contiguous completion
      const completedCount = instancesForInsert.filter((x: any) => x.status === "completed").length;
      const firstNCompleted = instancesForInsert
        .slice(0, completedCount)
        .every((x: any) => x.status === "completed");
      const restPlanned = instancesForInsert
        .slice(completedCount)
        .every((x: any) => x.status === "planned");

      if (!firstNCompleted || !restPlanned) {
        manualReview.push(
          `${tr.student_id}: non-contiguous completion after rebuild! completed=${completedCount}, total=${instancesForInsert.length}`
        );
      }

      log.push(
        `Student ${tr.student_id}: ${completedCount} completed / ${instancesForInsert.length} total, lpw=${resolvedLpw}`
      );

      if (!dryRun) {
        // Get current package_cycle
        const { data: currentTracking } = await supabase
          .from("student_lesson_tracking")
          .select("package_cycle, lessons_per_week")
          .eq("student_id", tr.student_id)
          .eq("teacher_id", tr.teacher_id)
          .maybeSingle();

        const currentCycle = currentTracking?.package_cycle || 1;

        // Delete current instances for this student/teacher/cycle
        const { count: deleteCount } = await supabase
          .from("lesson_instances")
          .delete({ count: "exact" })
          .eq("student_id", tr.student_id)
          .eq("teacher_id", tr.teacher_id)
          .eq("package_cycle", currentCycle);

        totalDeleted += deleteCount || 0;
        log.push(`  Deleted ${deleteCount} existing instances`);

        // Insert new instances
        for (const inst of instancesForInsert) {
          inst.package_cycle = currentCycle;
        }

        const { error: insertError } = await supabase
          .from("lesson_instances")
          .insert(instancesForInsert);

        if (insertError) {
          errors.push(`Insert error for ${tr.student_id}: ${insertError.message}`);
        } else {
          totalInserted += instancesForInsert.length;
          log.push(`  Inserted ${instancesForInsert.length} instances`);
        }

        // Update lessons_per_week if different
        if (currentTracking && currentTracking.lessons_per_week !== resolvedLpw) {
          const { error: lpwError } = await supabase
            .from("student_lesson_tracking")
            .update({ lessons_per_week: resolvedLpw, updated_at: new Date().toISOString() })
            .eq("student_id", tr.student_id)
            .eq("teacher_id", tr.teacher_id);

          if (lpwError) {
            errors.push(`LPW update error for ${tr.student_id}: ${lpwError.message}`);
          } else {
            lpwUpdates++;
            log.push(`  Updated lessons_per_week: ${currentTracking.lessons_per_week} → ${resolvedLpw}`);
          }
        }
      }
    }

    log.push(`\nTotal deleted: ${totalDeleted}, Total inserted: ${totalInserted}, LPW updates: ${lpwUpdates}`);

    // =============================================
    // PHASE 2: Teacher balance recovery
    // =============================================
    log.push("\n=== PHASE 2: TEACHER BALANCE RECOVERY ===");

    for (const b of balance) {
      if (!dryRun) {
        // Get current balance
        const { data: currentBalance } = await supabase
          .from("teacher_balance")
          .select("*")
          .eq("teacher_id", b.teacher_id)
          .maybeSingle();

        if (!currentBalance) {
          log.push(`SKIP balance: teacher ${b.teacher_id} not found in current DB`);
          continue;
        }

        const oldTotal = currentBalance.total_minutes;
        const newTotal = b.total_minutes;
        const delta = newTotal - oldTotal;

        if (delta === 0 &&
            currentBalance.completed_regular_lessons === b.completed_regular_lessons &&
            currentBalance.trial_lessons_minutes === b.trial_lessons_minutes) {
          log.push(`Balance unchanged for teacher ${b.teacher_id}`);
          continue;
        }

        // Update balance
        const { error: balError } = await supabase
          .from("teacher_balance")
          .update({
            total_minutes: b.total_minutes,
            completed_regular_lessons: b.completed_regular_lessons,
            completed_trial_lessons: b.completed_trial_lessons,
            regular_lessons_minutes: b.regular_lessons_minutes,
            trial_lessons_minutes: b.trial_lessons_minutes,
            manual_adjustment_minutes: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("teacher_id", b.teacher_id);

        if (balError) {
          errors.push(`Balance update error for ${b.teacher_id}: ${balError.message}`);
        } else {
          log.push(
            `Balance updated for ${b.teacher_id}: ${oldTotal}→${newTotal} min, ` +
            `${currentBalance.completed_regular_lessons}→${b.completed_regular_lessons} lessons`
          );

          // Audit log
          await supabase.from("balance_events").insert({
            teacher_id: b.teacher_id,
            event_type: "data_repair",
            amount_minutes: delta,
            notes: `Recovery: restore truth applied. ${oldTotal}→${newTotal} min, ${currentBalance.completed_regular_lessons}→${b.completed_regular_lessons} completed.`,
          });
        }
      } else {
        log.push(`[DRY] Would update balance for ${b.teacher_id}: total=${b.total_minutes}, completed=${b.completed_regular_lessons}`);
      }
    }

    // =============================================
    // Summary
    // =============================================
    log.push("\n=== MANUAL REVIEW ===");
    if (manualReview.length === 0) {
      log.push("None.");
    } else {
      for (const mr of manualReview) log.push(`⚠️ ${mr}`);
    }

    if (errors.length > 0) {
      log.push("\n=== ERRORS ===");
      for (const e of errors) log.push(`❌ ${e}`);
    }

    return new Response(JSON.stringify({ log, manualReview, errors, dryRun }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
