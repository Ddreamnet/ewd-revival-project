import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ewd-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Security: validate webhook secret header ──
  const expectedSecret = Deno.env.get("NOTIFICATIONS_WEBHOOK_SECRET");
  const receivedSecret = req.headers.get("x-ewd-webhook-secret");

  if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
    console.error("Unauthorized: webhook secret mismatch");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = await req.json();

    // Supabase Database Webhook sends { type, table, record, ... }
    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true, reason: "not INSERT" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const record = payload.record;
    if (!record?.id || !record?.recipient_id) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Idempotency: claim the row ──
    const { data: claimed, error: claimError } = await supabase
      .from("notifications")
      .update({ push_processing_at: new Date().toISOString() })
      .eq("id", record.id)
      .is("push_sent_at", null)
      .is("push_processing_at", null)
      .select("id");

    if (claimError) {
      console.error("Claim error:", claimError);
      return new Response(JSON.stringify({ error: "Claim failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!claimed || claimed.length === 0) {
      // Already processing or sent — exit gracefully
      return new Response(JSON.stringify({ skipped: true, reason: "already claimed or sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch profile names for personalized message ──
    const userIds = [
      ...new Set([record.teacher_id, record.student_id].filter(Boolean)),
    ];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const nameMap: Record<string, string> = {};
    if (profiles) {
      for (const p of profiles) {
        nameMap[p.user_id] = p.full_name;
      }
    }

    const teacherName = nameMap[record.teacher_id] || "Öğretmen";
    const studentName = nameMap[record.student_id] || "Öğrenci";

    // ── Build push message ──
    let title: string;
    let body: string;

    if (record.recipient_id === record.teacher_id) {
      title = "Yeni Ödev Teslimi 📝";
      body = `${studentName} yeni ödev yükledi.`;
    } else if (record.recipient_id === record.student_id) {
      title = "Yeni Ödev 📝";
      body = `Öğretmeniniz ${teacherName} yeni ödev paylaştı.`;
    } else {
      title = "Yeni Bildirim";
      body = "Bildirimlerinizi kontrol edin.";
    }

    // ── Call send-push (all data values must be strings) ──
    const pushPayload = {
      user_id: record.recipient_id,
      title,
      body,
      channel_id: "homework",
      data: {
        notification_id: String(record.id),
        homework_id: String(record.homework_id),
        deep_link: "/notifications",
      },
    };

    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push`;
    const pushResponse = await fetch(sendPushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify(pushPayload),
    });

    if (!pushResponse.ok) {
      const errText = await pushResponse.text();
      console.error("send-push failed:", pushResponse.status, errText);

      // Release claim so webhook can retry
      await supabase
        .from("notifications")
        .update({ push_processing_at: null })
        .eq("id", record.id);

      return new Response(JSON.stringify({ error: "Push delivery failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consume response body
    await pushResponse.text();

    // ── Mark as sent ──
    await supabase
      .from("notifications")
      .update({ push_sent_at: new Date().toISOString(), push_processing_at: null })
      .eq("id", record.id);

    console.log(`Push sent for notification ${record.id} to ${record.recipient_id}`);

    return new Response(
      JSON.stringify({ success: true, notification_id: record.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("notifications-push error:", error);

    // Try to release claim on unexpected error
    try {
      const payload = await req.clone().json();
      if (payload?.record?.id) {
        await supabase
          .from("notifications")
          .update({ push_processing_at: null })
          .eq("id", payload.record.id);
      }
    } catch { /* ignore cleanup errors */ }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
