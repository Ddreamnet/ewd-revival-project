import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // =========================================================================
  // 0. Security: X-CRON-SECRET header check
  // =========================================================================
  const cronSecret = Deno.env.get("CRON_SECRET");
  const requestSecret = req.headers.get("x-cron-secret");

  if (!cronSecret || !requestSecret || requestSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 1. Calculate Turkey local time + 10 minutes
    // =========================================================================
    const now = new Date();

    // Get Turkey time components using Intl
    const trParts = getDateParts(now, "Europe/Istanbul");
    
    // Build a Date object representing "now" in Turkey
    const trNow = new Date(
      trParts.year, trParts.month - 1, trParts.day,
      trParts.hour, trParts.minute, 0, 0
    );

    // Target = 10 minutes from now (Turkey time)
    const target = new Date(trNow.getTime() + 10 * 60 * 1000);
    const targetDay = target.getDay(); // 0=Sunday, matches DB
    const targetHour = String(target.getHours()).padStart(2, "0");
    const targetMinute = String(target.getMinutes()).padStart(2, "0");
    const targetTime = `${targetHour}:${targetMinute}`;

    // Today's date in YYYY-MM-DD (Turkey time)
    const todayStr = `${trParts.year}-${String(trParts.month).padStart(2, "0")}-${String(trParts.day).padStart(2, "0")}`;

    console.log(`Cron running: TR now=${trNow.toISOString()}, target=${targetTime}, day=${targetDay}, date=${todayStr}`);

    // =========================================================================
    // 2. Find regular lessons matching target day + time
    // =========================================================================
    const { data: regularLessons, error: lessonsError } = await supabase
      .from("student_lessons")
      .select("id, student_id, teacher_id, start_time, day_of_week")
      .eq("day_of_week", targetDay)
      .eq("start_time", `${targetTime}:00`); // DB stores as HH:MM:SS

    if (lessonsError) {
      console.error("Error fetching lessons:", lessonsError);
      throw lessonsError;
    }

    // =========================================================================
    // 3. Check overrides for today — cancellations and time changes
    // =========================================================================
    const { data: overrides, error: overridesError } = await supabase
      .from("lesson_overrides")
      .select("id, student_id, teacher_id, original_start_time, is_cancelled, new_date, new_start_time, original_date")
      .eq("original_date", todayStr);

    if (overridesError) {
      console.error("Error fetching overrides:", overridesError);
      throw overridesError;
    }

    // Build override lookup: key = `${student_id}_${original_start_time}`
    const overrideMap = new Map<string, any>();
    for (const ov of overrides || []) {
      const key = `${ov.student_id}_${ov.original_start_time}`;
      overrideMap.set(key, ov);
    }

    // =========================================================================
    // 4. Filter regular lessons (exclude cancelled/rescheduled)
    // =========================================================================
    interface LessonToRemind {
      lessonKey: string;
      studentId: string;
      teacherId: string;
    }

    const lessonsToRemind: LessonToRemind[] = [];

    for (const lesson of regularLessons || []) {
      const overrideKey = `${lesson.student_id}_${lesson.start_time}`;
      const override = overrideMap.get(overrideKey);

      if (override) {
        // Cancelled → skip
        if (override.is_cancelled) continue;
        // Rescheduled to different time → skip (will be handled by override check below)
        if (override.new_start_time && override.new_start_time !== lesson.start_time) continue;
      }

      lessonsToRemind.push({
        lessonKey: `sl_${lesson.id}`,
        studentId: lesson.student_id,
        teacherId: lesson.teacher_id,
      });
    }

    // =========================================================================
    // 5. Find lessons overridden TO today at target time
    // =========================================================================
    const { data: movedToToday, error: movedError } = await supabase
      .from("lesson_overrides")
      .select("id, student_id, teacher_id, new_start_time, new_date")
      .eq("new_date", todayStr)
      .eq("is_cancelled", false);

    if (movedError) {
      console.error("Error fetching moved overrides:", movedError);
    }

    for (const ov of movedToToday || []) {
      // Check if new_start_time matches target
      const ovTime = ov.new_start_time?.substring(0, 5); // HH:MM
      if (ovTime === targetTime) {
        lessonsToRemind.push({
          lessonKey: `ov_${ov.id}`,
          studentId: ov.student_id,
          teacherId: ov.teacher_id,
        });
      }
    }

    console.log(`Found ${lessonsToRemind.length} lessons to remind`);

    if (lessonsToRemind.length === 0) {
      // Clean old logs while we're here
      await cleanOldLogs(supabase);
      return new Response(JSON.stringify({ reminded: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // 6. Dedup + send push notifications
    // =========================================================================
    // Get student names for teacher notifications
    const studentIds = [...new Set(lessonsToRemind.map((l) => l.studentId))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", studentIds);

    const nameMap = new Map<string, string>();
    for (const p of profiles || []) {
      nameMap.set(p.user_id, p.full_name);
    }

    // Prepare push recipients
    interface PushRecipient {
      user_id: string;
      title: string;
      body: string;
      channel_id?: string;
    }

    const pushRecipients: PushRecipient[] = [];

    for (const lesson of lessonsToRemind) {
      const studentName = nameMap.get(lesson.studentId) || "Öğrenci";

      // Dedup for student
      const studentDedup = await tryInsertReminderLog(
        supabase, lesson.studentId, lesson.lessonKey, todayStr
      );
      if (studentDedup) {
        pushRecipients.push({
          user_id: lesson.studentId,
          title: "Ders Hatırlatma 📚",
          body: "Dersiniz 10 dakika sonra başlıyor!",
          channel_id: "lesson",
        });
      }

      // Dedup for teacher
      const teacherDedup = await tryInsertReminderLog(
        supabase, lesson.teacherId, lesson.lessonKey, todayStr
      );
      if (teacherDedup) {
        pushRecipients.push({
          user_id: lesson.teacherId,
          title: "Ders Hatırlatma 📚",
          body: `${studentName} ile dersiniz 10 dakika sonra!`,
          channel_id: "lesson",
        });
      }
    }

    console.log(`Sending push to ${pushRecipients.length} recipients after dedup`);

    // Call send-push function internally
    if (pushRecipients.length > 0) {
      const sendPushUrl = `${supabaseUrl}/functions/v1/send-push`;
      const pushResponse = await fetch(sendPushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ recipients: pushRecipients }),
      });

      const pushResult = await pushResponse.json();
      console.log("Push result:", pushResult);
    }

    // Clean old logs
    await cleanOldLogs(supabase);

    return new Response(
      JSON.stringify({ reminded: pushRecipients.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("lesson-reminder-cron error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Helpers
// ============================================================================

function getDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find((p) => p.type === "year")!.value),
    month: parseInt(parts.find((p) => p.type === "month")!.value),
    day: parseInt(parts.find((p) => p.type === "day")!.value),
    hour: parseInt(parts.find((p) => p.type === "hour")!.value),
    minute: parseInt(parts.find((p) => p.type === "minute")!.value),
  };
}

async function tryInsertReminderLog(
  supabase: any,
  recipientUserId: string,
  lessonKey: string,
  lessonDate: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("lesson_reminder_log")
    .insert({
      recipient_user_id: recipientUserId,
      lesson_key: lessonKey,
      lesson_date: lessonDate,
      reminder_type: "before_10min",
    })
    .select("id")
    .single();

  if (error) {
    // Unique constraint violation = already sent
    if (error.code === "23505") {
      return false;
    }
    console.error("Dedup insert error:", error);
    return false;
  }

  return !!data;
}

async function cleanOldLogs(supabase: any): Promise<void> {
  const { error } = await supabase
    .from("lesson_reminder_log")
    .delete()
    .lt("lesson_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

  if (error) {
    console.error("Failed to clean old reminder logs:", error);
  }
}
