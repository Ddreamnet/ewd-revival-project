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
  completed_lessons: string;
  lesson_dates: string;
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

type Verdict = "SAFE_APPLY" | "MANUAL_REVIEW" | "SKIP_ARCHIVED" | "HARD_BLOCKER";

interface ClassifiedStudent {
  student_id: string;
  teacher_id: string;
  student_name: string;
  teacher_name: string;
  verdict: Verdict;
  reason_code: string;
  reason_detail: string;
  completed_count: number;
  total_lessons: number;
  lesson_dates_count: number;
  template_slot_count: number;
  resolved_lpw: number;
  instances_to_insert: any[];
  current_delete_count: number;
  template_source: "restore_json" | "current_db_fallback" | "none";
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.getUTCDay();
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const dryRun: boolean = body.dry_run !== false;
    const tracking: TrackingRecord[] = body.tracking || [];
    const lessons: LessonSlot[] = body.lessons || [];
    const balance: BalanceRecord[] = body.balance || [];

    const log: string[] = [];

    // ---- Fetch profiles for name resolution ----
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, role");
    
    const nameMap = new Map<string, string>();
    for (const p of allProfiles || []) {
      nameMap.set(p.user_id, p.full_name);
    }

    // ---- Fetch archived students ----
    const { data: archivedStudents } = await supabase
      .from("students")
      .select("student_id, teacher_id")
      .eq("is_archived", true);

    const archivedSet = new Set(
      (archivedStudents || []).map((s: any) => `${s.student_id}|${s.teacher_id}`)
    );

    // ---- Build template lookup ----
    const templateMap = new Map<string, LessonSlot[]>();
    for (const slot of lessons) {
      const key = `${slot.student_id}|${slot.teacher_id}`;
      if (!templateMap.has(key)) templateMap.set(key, []);
      templateMap.get(key)!.push(slot);
    }
    for (const [, slots] of templateMap) {
      slots.sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      });
    }

    // ---- DB FALLBACK: fetch templates for students missing from restore JSON ----
    const dbFallbackKeys = new Set<string>();
    const missingPairs: { student_id: string; teacher_id: string }[] = [];
    for (const tr of tracking) {
      const key = `${tr.student_id}|${tr.teacher_id}`;
      if (!templateMap.has(key) && !archivedSet.has(key)) {
        missingPairs.push({ student_id: tr.student_id, teacher_id: tr.teacher_id });
      }
    }

    if (missingPairs.length > 0) {
      const missingStudentIds = [...new Set(missingPairs.map(p => p.student_id))];
      const { data: dbSlots } = await supabase
        .from("student_lessons")
        .select("student_id, teacher_id, day_of_week, start_time, end_time, id")
        .in("student_id", missingStudentIds);

      // Only add slots for exact (student_id, teacher_id) pairs that were missing
      const missingKeySet = new Set(missingPairs.map(p => `${p.student_id}|${p.teacher_id}`));
      for (const slot of dbSlots || []) {
        const key = `${slot.student_id}|${slot.teacher_id}`;
        if (!missingKeySet.has(key)) continue;
        if (!templateMap.has(key)) templateMap.set(key, []);
        templateMap.get(key)!.push(slot as LessonSlot);
        dbFallbackKeys.add(key);
      }
      // Sort newly added slots
      for (const key of dbFallbackKeys) {
        const slots = templateMap.get(key);
        if (slots) {
          slots.sort((a, b) => {
            if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
            return a.start_time.localeCompare(b.start_time);
          });
        }
      }
    }

    // ---- Fetch current instance counts for delete estimates ----
    const { data: allInstances } = await supabase
      .from("lesson_instances")
      .select("student_id, teacher_id, package_cycle, id");

    const instanceCountMap = new Map<string, number>();
    for (const inst of allInstances || []) {
      const key = `${inst.student_id}|${inst.teacher_id}`;
      instanceCountMap.set(key, (instanceCountMap.get(key) || 0) + 1);
    }

    // =============================================
    // PASS 1: CLASSIFY
    // =============================================
    const classified: ClassifiedStudent[] = [];

    for (const tr of tracking) {
      const key = `${tr.student_id}|${tr.teacher_id}`;
      const studentName = nameMap.get(tr.student_id) || tr.student_id.substring(0, 8);
      const teacherName = nameMap.get(tr.teacher_id) || tr.teacher_id.substring(0, 8);

      const base = {
        student_id: tr.student_id,
        teacher_id: tr.teacher_id,
        student_name: studentName,
        teacher_name: teacherName,
        instances_to_insert: [] as any[],
        current_delete_count: instanceCountMap.get(key) || 0,
      };

      // CHECK 1: Archived?
      if (archivedSet.has(key)) {
        classified.push({
          ...base,
          verdict: "SKIP_ARCHIVED",
          reason_code: "ARCHIVED",
          reason_detail: "Student is archived",
          completed_count: 0,
          total_lessons: 0,
          lesson_dates_count: 0,
          template_slot_count: 0,
          resolved_lpw: 0,
        });
        continue;
      }

      // Parse data
      let completedLessons: string[] = [];
      let lessonDates: Record<string, string> = {};

      try {
        completedLessons = JSON.parse(tr.completed_lessons || "[]");
      } catch {
        classified.push({
          ...base,
          verdict: "HARD_BLOCKER",
          reason_code: "PARSE_ERROR",
          reason_detail: "Failed to parse completed_lessons JSON",
          completed_count: 0, total_lessons: 0, lesson_dates_count: 0, template_slot_count: 0, resolved_lpw: 0,
        });
        continue;
      }

      try {
        lessonDates = JSON.parse(tr.lesson_dates || "{}");
      } catch {
        classified.push({
          ...base,
          verdict: "HARD_BLOCKER",
          reason_code: "PARSE_ERROR",
          reason_detail: "Failed to parse lesson_dates JSON",
          completed_count: 0, total_lessons: 0, lesson_dates_count: 0, template_slot_count: 0, resolved_lpw: 0,
        });
        continue;
      }

      const completedSet = new Set(completedLessons.map(String));
      const lessonDateEntries = Object.entries(lessonDates)
        .map(([k, v]) => ({ lessonNumber: parseInt(k), date: v }))
        .sort((a, b) => a.lessonNumber - b.lessonNumber);

      // CHECK 2: Empty dates?
      if (lessonDateEntries.length === 0) {
        const code = completedLessons.length > 0 ? "EMPTY_DATES_WITH_COMPLETED" : "EMPTY_DATES";
        classified.push({
          ...base,
          verdict: "MANUAL_REVIEW",
          reason_code: code,
          reason_detail: `${completedLessons.length} completed but 0 lesson_dates`,
          completed_count: completedLessons.length, total_lessons: 0,
          lesson_dates_count: 0, template_slot_count: 0, resolved_lpw: 0,
        });
        continue;
      }

      // CHECK 3: Template slots exist?
      const templates = templateMap.get(key) || [];
      if (templates.length === 0) {
        classified.push({
          ...base,
          verdict: "MANUAL_REVIEW",
          reason_code: "NO_TEMPLATE",
          reason_detail: `${lessonDateEntries.length} lesson_dates but no template slots in restore data`,
          completed_count: completedLessons.length, total_lessons: lessonDateEntries.length,
          lesson_dates_count: lessonDateEntries.length, template_slot_count: 0, resolved_lpw: 0,
        });
        continue;
      }

      // Build template lookup by day_of_week
      const templatesByDay = new Map<number, LessonSlot[]>();
      for (const t of templates) {
        if (!templatesByDay.has(t.day_of_week)) templatesByDay.set(t.day_of_week, []);
        templatesByDay.get(t.day_of_week)!.push(t);
      }

      // CHECK 4: Every lesson_date day-of-week matches a template slot
      const dayMismatches: string[] = [];
      const lessonsByDate = new Map<string, number[]>();
      for (const entry of lessonDateEntries) {
        if (!lessonsByDate.has(entry.date)) lessonsByDate.set(entry.date, []);
        lessonsByDate.get(entry.date)!.push(entry.lessonNumber);
      }

      for (const [dateStr, lessonNums] of lessonsByDate) {
        const dow = getDayOfWeek(dateStr);
        const daySlots = templatesByDay.get(dow) || [];
        if (daySlots.length === 0) {
          dayMismatches.push(`${dateStr}(${DAY_NAMES[dow]})`);
        }
      }

      if (dayMismatches.length > 0) {
        classified.push({
          ...base,
          verdict: "MANUAL_REVIEW",
          reason_code: "DAY_MISMATCH",
          reason_detail: `Dates not matching template days: ${dayMismatches.join(", ")}`,
          completed_count: completedLessons.length, total_lessons: lessonDateEntries.length,
          lesson_dates_count: lessonDateEntries.length, template_slot_count: templates.length,
          resolved_lpw: 0,
        });
        continue;
      }

      // CHECK 5: Slot overflow — lessons on a date ≤ slots for that day
      const overflows: string[] = [];
      for (const [dateStr, lessonNums] of lessonsByDate) {
        const dow = getDayOfWeek(dateStr);
        const daySlots = templatesByDay.get(dow) || [];
        if (lessonNums.length > daySlots.length) {
          overflows.push(`${dateStr}(${DAY_NAMES[dow]}): ${lessonNums.length} lessons but ${daySlots.length} slots`);
        }
      }

      if (overflows.length > 0) {
        classified.push({
          ...base,
          verdict: "MANUAL_REVIEW",
          reason_code: "SLOT_OVERFLOW",
          reason_detail: overflows.join("; "),
          completed_count: completedLessons.length, total_lessons: lessonDateEntries.length,
          lesson_dates_count: lessonDateEntries.length, template_slot_count: templates.length,
          resolved_lpw: 0,
        });
        continue;
      }

      // CHECK 6: LPW resolution
      const slotCount = templates.length;
      const inferredLpw = Math.ceil(lessonDateEntries.length / 4);
      const trackingLpw = tr.lessons_per_week;

      let resolvedLpw: number;
      let lpwConflict = false;

      if (slotCount === inferredLpw && inferredLpw === trackingLpw) {
        resolvedLpw = slotCount; // unanimous
      } else if (slotCount === inferredLpw) {
        resolvedLpw = slotCount; // 2-of-3
      } else if (slotCount === trackingLpw) {
        resolvedLpw = slotCount; // 2-of-3
      } else if (inferredLpw === trackingLpw) {
        resolvedLpw = inferredLpw; // 2-of-3
      } else {
        // All 3 differ → hard conflict
        classified.push({
          ...base,
          verdict: "MANUAL_REVIEW",
          reason_code: "LPW_CONFLICT",
          reason_detail: `slots=${slotCount}, inferred=${inferredLpw}, tracking=${trackingLpw} — all differ`,
          completed_count: completedLessons.length, total_lessons: lessonDateEntries.length,
          lesson_dates_count: lessonDateEntries.length, template_slot_count: slotCount,
          resolved_lpw: 0,
        });
        continue;
      }

      // ---- Build instances (deterministic exact mapping only) ----
      const instancesForInsert: any[] = [];

      for (const [dateStr, lessonNums] of lessonsByDate) {
        lessonNums.sort((a, b) => a - b);
        const dow = getDayOfWeek(dateStr);
        const daySlots = [...(templatesByDay.get(dow) || [])].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        );

        for (let i = 0; i < lessonNums.length; i++) {
          const ln = lessonNums[i];
          const slot = daySlots[i]; // guaranteed by slot overflow check
          const isCompleted = completedSet.has(String(ln));

          instancesForInsert.push({
            student_id: tr.student_id,
            teacher_id: tr.teacher_id,
            lesson_number: ln,
            lesson_date: dateStr,
            start_time: slot.start_time,
            end_time: slot.end_time,
            status: isCompleted ? "completed" : "planned",
            package_cycle: 1,
            rescheduled_count: 0,
          });
        }
      }

      // Renumber chronologically
      instancesForInsert.sort((a, b) => {
        if (a.lesson_date !== b.lesson_date) return a.lesson_date.localeCompare(b.lesson_date);
        return a.start_time.localeCompare(b.start_time);
      });
      for (let i = 0; i < instancesForInsert.length; i++) {
        instancesForInsert[i].lesson_number = i + 1;
      }

      // CHECK 7: Contiguous completion
      const completedCount = instancesForInsert.filter((x: any) => x.status === "completed").length;
      const firstNCompleted = instancesForInsert
        .slice(0, completedCount)
        .every((x: any) => x.status === "completed");
      const restPlanned = instancesForInsert
        .slice(completedCount)
        .every((x: any) => x.status === "planned");

      if (!firstNCompleted || !restPlanned) {
        classified.push({
          ...base,
          verdict: "MANUAL_REVIEW",
          reason_code: "NON_CONTIGUOUS",
          reason_detail: `Completion not contiguous: ${completedCount} completed in ${instancesForInsert.length} total`,
          completed_count: completedCount, total_lessons: instancesForInsert.length,
          lesson_dates_count: lessonDateEntries.length, template_slot_count: templates.length,
          resolved_lpw: resolvedLpw,
          instances_to_insert: [],
        });
        continue;
      }

      // ---- ALL CHECKS PASSED → SAFE_APPLY ----
      classified.push({
        ...base,
        verdict: "SAFE_APPLY",
        reason_code: "OK_EXACT_MATCH",
        reason_detail: `All ${lessonDateEntries.length} dates match template days exactly`,
        completed_count: completedCount,
        total_lessons: instancesForInsert.length,
        lesson_dates_count: lessonDateEntries.length,
        template_slot_count: templates.length,
        resolved_lpw: resolvedLpw,
        instances_to_insert: instancesForInsert,
      });
    }

    // =============================================
    // PASS 2: EXECUTE (only SAFE_APPLY, only in LIVE mode)
    // =============================================
    const safeList = classified.filter(c => c.verdict === "SAFE_APPLY");
    const manualList = classified.filter(c => c.verdict === "MANUAL_REVIEW");
    const archivedList = classified.filter(c => c.verdict === "SKIP_ARCHIVED");
    const blockerList = classified.filter(c => c.verdict === "HARD_BLOCKER");

    let totalDeleted = 0;
    let totalInserted = 0;
    let lpwUpdates = 0;
    const executeLog: string[] = [];

    if (!dryRun) {
      for (const s of safeList) {
        // Get current cycle
        const { data: currentTracking } = await supabase
          .from("student_lesson_tracking")
          .select("package_cycle, lessons_per_week")
          .eq("student_id", s.student_id)
          .eq("teacher_id", s.teacher_id)
          .maybeSingle();

        const currentCycle = currentTracking?.package_cycle || 1;

        // Delete
        const { count: deleteCount } = await supabase
          .from("lesson_instances")
          .delete({ count: "exact" })
          .eq("student_id", s.student_id)
          .eq("teacher_id", s.teacher_id)
          .eq("package_cycle", currentCycle);

        totalDeleted += deleteCount || 0;

        // Insert
        for (const inst of s.instances_to_insert) {
          inst.package_cycle = currentCycle;
        }
        const { error: insertError } = await supabase
          .from("lesson_instances")
          .insert(s.instances_to_insert);

        if (insertError) {
          executeLog.push(`❌ INSERT ERROR ${s.student_name}: ${insertError.message}`);
        } else {
          totalInserted += s.instances_to_insert.length;
          executeLog.push(`✅ ${s.student_name}: DEL ${deleteCount} → INS ${s.instances_to_insert.length}`);
        }

        // LPW update
        if (currentTracking && currentTracking.lessons_per_week !== s.resolved_lpw) {
          await supabase
            .from("student_lesson_tracking")
            .update({ lessons_per_week: s.resolved_lpw, updated_at: new Date().toISOString() })
            .eq("student_id", s.student_id)
            .eq("teacher_id", s.teacher_id);
          lpwUpdates++;
        }
      }

      // Balance recovery
      for (const b of balance) {
        const { data: currentBalance } = await supabase
          .from("teacher_balance")
          .select("*")
          .eq("teacher_id", b.teacher_id)
          .maybeSingle();

        if (!currentBalance) {
          executeLog.push(`SKIP balance: teacher ${nameMap.get(b.teacher_id) || b.teacher_id} not in DB`);
          continue;
        }

        const delta = b.total_minutes - currentBalance.total_minutes;
        if (delta === 0 &&
            currentBalance.completed_regular_lessons === b.completed_regular_lessons &&
            currentBalance.trial_lessons_minutes === b.trial_lessons_minutes) {
          executeLog.push(`Balance unchanged: ${nameMap.get(b.teacher_id) || b.teacher_id}`);
          continue;
        }

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
          executeLog.push(`❌ Balance error ${nameMap.get(b.teacher_id)}: ${balError.message}`);
        } else {
          executeLog.push(`✅ Balance ${nameMap.get(b.teacher_id)}: ${currentBalance.total_minutes}→${b.total_minutes} min`);
          await supabase.from("balance_events").insert({
            teacher_id: b.teacher_id,
            event_type: "data_repair",
            amount_minutes: delta,
            notes: `Recovery: ${currentBalance.total_minutes}→${b.total_minutes} min`,
          });
        }
      }
    }

    // Build balance dry-run info
    const balanceDryRun: any[] = [];
    for (const b of balance) {
      balanceDryRun.push({
        teacher_id: b.teacher_id,
        teacher_name: nameMap.get(b.teacher_id) || b.teacher_id.substring(0, 8),
        restore_total: b.total_minutes,
        restore_regular: b.completed_regular_lessons,
        restore_trial: b.completed_trial_lessons,
      });
    }

    // Compute estimates
    const safeDeleteEstimate = safeList.reduce((sum, s) => sum + s.current_delete_count, 0);
    const safeInsertEstimate = safeList.reduce((sum, s) => sum + s.instances_to_insert.length, 0);

    // Strip instances_to_insert from response (too large)
    const safeApply = safeList.map(s => ({
      student_id: s.student_id,
      teacher_id: s.teacher_id,
      student_name: s.student_name,
      teacher_name: s.teacher_name,
      completed_count: s.completed_count,
      total_lessons: s.total_lessons,
      lesson_dates_count: s.lesson_dates_count,
      template_slot_count: s.template_slot_count,
      resolved_lpw: s.resolved_lpw,
      reason_code: s.reason_code,
      current_delete_count: s.current_delete_count,
      insert_count: s.instances_to_insert.length,
    }));

    const manualReview = manualList.map(s => ({
      student_id: s.student_id,
      teacher_id: s.teacher_id,
      student_name: s.student_name,
      teacher_name: s.teacher_name,
      completed_count: s.completed_count,
      total_lessons: s.total_lessons,
      reason_code: s.reason_code,
      reason_detail: s.reason_detail,
    }));

    const skippedArchived = archivedList.map(s => ({
      student_id: s.student_id,
      student_name: s.student_name,
      teacher_name: s.teacher_name,
    }));

    const hardBlocker = blockerList.map(s => ({
      student_id: s.student_id,
      student_name: s.student_name,
      reason_code: s.reason_code,
      reason_detail: s.reason_detail,
    }));

    return new Response(JSON.stringify({
      dryRun,
      summary: {
        safeCount: safeList.length,
        manualCount: manualList.length,
        archivedCount: archivedList.length,
        blockerCount: blockerList.length,
        safeDeleteEstimate,
        safeInsertEstimate,
        totalDeleted: dryRun ? 0 : totalDeleted,
        totalInserted: dryRun ? 0 : totalInserted,
        lpwUpdates: dryRun ? 0 : lpwUpdates,
      },
      safeApply,
      manualReview,
      skippedArchived,
      hardBlocker,
      balanceDryRun,
      executeLog: dryRun ? [] : executeLog,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
