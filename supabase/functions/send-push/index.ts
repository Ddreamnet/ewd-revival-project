import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Recipient {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channel_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Security: require either X-CRON-SECRET or valid service-role Authorization
  const cronSecret = Deno.env.get("CRON_SECRET");
  const requestSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const hasCronSecret = cronSecret && requestSecret && requestSecret === cronSecret;
  const hasServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;

  if (!hasCronSecret && !hasServiceRole) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT");

    if (!fcmServiceAccountJson) {
      return new Response(
        JSON.stringify({ error: "FCM_SERVICE_ACCOUNT not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    // Support single or batch
    let recipients: Recipient[];
    if (body.recipients) {
      recipients = body.recipients;
    } else {
      recipients = [{ user_id: body.user_id, title: body.title, body: body.body, data: body.data }];
    }

    const serviceAccount = JSON.parse(fcmServiceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const recipient of recipients) {
      // Get enabled tokens for this user
      const { data: tokens, error: tokenError } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", recipient.user_id)
        .eq("enabled", true);

      if (tokenError || !tokens || tokens.length === 0) {
        continue;
      }

      for (const tokenRow of tokens) {
        const fcmPayload = {
          message: {
            token: tokenRow.token,
            notification: {
              title: recipient.title,
              body: recipient.body,
            },
            android: {
              priority: "HIGH" as const,
              notification: {
                ...(recipient.channel_id
                  ? { channel_id: recipient.channel_id }
                  : { default_sound: true }),
                default_vibrate_timings: true,
              },
            },
            data: recipient.data || {},
          },
        };

        const fcmResponse = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fcmPayload),
          }
        );

        if (fcmResponse.ok) {
          sent++;
        } else {
          const errorBody = await fcmResponse.text();
          console.error(`FCM error for token ${tokenRow.token.substring(0, 10)}...:`, errorBody);
          failed++;

          // Clean up invalid tokens
          if (
            errorBody.includes("UNREGISTERED") ||
            errorBody.includes("INVALID_ARGUMENT") ||
            fcmResponse.status === 404
          ) {
            invalidTokens.push(tokenRow.token);
          }
        }
      }
    }

    // Delete invalid tokens
    if (invalidTokens.length > 0) {
      const { error: deleteError } = await supabase
        .from("push_tokens")
        .delete()
        .in("token", invalidTokens);

      if (deleteError) {
        console.error("Failed to delete invalid tokens:", deleteError);
      } else {
        console.log(`Deleted ${invalidTokens.length} invalid tokens`);
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, invalidTokensCleaned: invalidTokens.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-push error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Google OAuth2 JWT for FCM HTTP v1
// ============================================================================

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = base64url(
    String.fromCharCode(...new Uint8Array(signature))
  );

  const jwt = `${unsignedToken}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
