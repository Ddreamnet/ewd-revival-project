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
    const targetHour = String(target.getHours()).padStart(2, "0");
    const targetMinute = String(target.getMinutes()).padStart(2, "0");
    const targetTime = `${targetHour}:${targetMinute}`;

    // Today's date in YYYY-MM-DD (Turkey time)
    const todayStr = `${trParts.year}-${String(trParts.month).padStart(2, "0")}-${String(trParts.day).padStart(2, "0")}`;

    console.log(`Cron running: TR now=${trNow.toISOString()}, target=${targetTime}, date=${todayStr}`);

    // =========================================================================
    // 2. Find lesson_instances for today at target time (planned status only)
    // =========================================================================
    const { data: instances, error: instancesError } = await supabase
      .from("lesson_instances")
      .select("id, student_id, teacher_id, start_time")
      .eq("lesson_date", todayStr)
      .eq("status", "planned")
      .eq("start_time", `${targetTime}:00`);

    if (instancesError) {
      console.error("Error fetching lesson instances:", instancesError);
      throw instancesError;
    }

    // =========================================================================
    // 3. Also check trial lessons for today at target time
    // =========================================================================
    const targetDay = target.getDay();
    const { data: trialLessons, error: trialError } = await supabase
      .from("trial_lessons")
      .select("id, teacher_id, start_time")
      .eq("lesson_date", todayStr)
      .eq("day_of_week", targetDay)
      .eq("is_completed", false)
      .eq("start_time", `${targetTime}:00`);

    if (trialError) {
      console.error("Error fetching trial lessons:", trialError);
    }

    // =========================================================================
    // 4. Build reminder list
    // =========================================================================
    interface LessonToRemind {
      lessonKey: string;
      studentId: string | null;
      teacherId: string;
    }

    const lessonsToRemind: LessonToRemind[] = [];

    for (const inst of instances || []) {
      lessonsToRemind.push({
        lessonKey: `li_${inst.id}`,
        studentId: inst.student_id,
        teacherId: inst.teacher_id,
      });
    }

    for (const trial of trialLessons || []) {
      lessonsToRemind.push({
        lessonKey: `tl_${trial.id}`,
        studentId: null,
        teacherId: trial.teacher_id,
      });
    }

    console.log(`Found ${lessonsToRemind.length} lessons to remind`);

    if (lessonsToRemind.length === 0) {
      await cleanOldLogs(supabase);
      return new Response(JSON.stringify({ reminded: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // 5. Get student names for teacher notifications
    // =========================================================================
    const studentIds = [...new Set(lessonsToRemind.map((l) => l.studentId).filter(Boolean))] as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", studentIds);

    const nameMap = new Map<string, string>();
    for (const p of profiles || []) {
      nameMap.set(p.user_id, p.full_name);
    }

    // =========================================================================
    // 6. Dedup + send push notifications
    // =========================================================================
    interface PushRecipient {
      user_id: string;
      title: string;
      body: string;
      channel_id?: string;
      data?: Record<string, string>;
    }

    const pushRecipients: PushRecipient[] = [];

    for (const lesson of lessonsToRemind) {
      const studentName = lesson.studentId ? (nameMap.get(lesson.studentId) || "Öğrenci") : "Deneme Dersi";

      // Dedup for student
      if (lesson.studentId) {
        const studentDedup = await tryInsertReminderLog(
          supabase, lesson.studentId, lesson.lessonKey, todayStr
        );
        if (studentDedup) {
          pushRecipients.push({
            user_id: lesson.studentId,
            title: "Ders Hatırlatma 📚",
            body: "Dersiniz 10 dakika sonra başlıyor!",
            channel_id: "lesson",
            data: { type: "lesson_reminder", deep_link: "/dashboard" },
          });
        }
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
          data: { type: "lesson_reminder", deep_link: "/dashboard" },
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
