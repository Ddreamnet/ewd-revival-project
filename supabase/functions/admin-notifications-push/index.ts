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

    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true, reason: "not INSERT" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const record = payload.record;
    if (!record?.id) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Idempotency: claim the row ──
    const { data: claimed, error: claimError } = await supabase
      .from("admin_notifications")
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
      return new Response(JSON.stringify({ skipped: true, reason: "already claimed or sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Find all admin users ──
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("Failed to fetch admin roles:", rolesError);
      await supabase
        .from("admin_notifications")
        .update({ push_processing_at: null })
        .eq("id", record.id);
      return new Response(JSON.stringify({ error: "Failed to fetch admins" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.warn("No admin users found, skipping push");
      await supabase
        .from("admin_notifications")
        .update({ push_sent_at: new Date().toISOString(), push_processing_at: null })
        .eq("id", record.id);
      return new Response(JSON.stringify({ skipped: true, reason: "no admins" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Send push to each admin ──
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push`;
    const title = "Son Ders Uyarısı ⚠️";
    const body = record.message || "Bir öğrencinin son dersi kaldı!";
    let allSuccess = true;

    for (const admin of adminRoles) {
      const pushPayload = {
        user_id: admin.user_id,
        title,
        body,
        channel_id: "last_lesson",
        data: {
          admin_notification_id: String(record.id),
          deep_link: "/admin",
        },
      };

      try {
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
          console.error(`send-push failed for admin ${admin.user_id}:`, pushResponse.status, errText);
          allSuccess = false;
        } else {
          await pushResponse.text();
          console.log(`Push sent to admin ${admin.user_id} for admin_notification ${record.id}`);
        }
      } catch (err) {
        console.error(`send-push error for admin ${admin.user_id}:`, err);
        allSuccess = false;
      }
    }

    if (!allSuccess) {
      // Release claim for retry
      await supabase
        .from("admin_notifications")
        .update({ push_processing_at: null })
        .eq("id", record.id);
      return new Response(JSON.stringify({ error: "Some push deliveries failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Mark as sent ──
    await supabase
      .from("admin_notifications")
      .update({ push_sent_at: new Date().toISOString(), push_processing_at: null })
      .eq("id", record.id);

    console.log(`Admin push completed for notification ${record.id}, sent to ${adminRoles.length} admin(s)`);

    return new Response(
      JSON.stringify({ success: true, admin_notification_id: record.id, admins_notified: adminRoles.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("admin-notifications-push error:", error);

    try {
      const payload = await req.clone().json();
      if (payload?.record?.id) {
        await supabase
          .from("admin_notifications")
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
