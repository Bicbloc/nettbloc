import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GOCARDLESS-WEBHOOK] ${step}${detailsStr}`);
};

// Compute HMAC-SHA256 hex of the raw body using the webhook secret
async function computeSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("GOCARDLESS_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("GOCARDLESS_WEBHOOK_SECRET is not set");

    // Read raw body BEFORE parsing (signature is computed over raw bytes)
    const rawBody = await req.text();
    const providedSignature = req.headers.get("Webhook-Signature") || "";

    const expectedSignature = await computeSignature(webhookSecret, rawBody);
    if (!providedSignature || !timingSafeEqual(providedSignature, expectedSignature)) {
      logStep("Invalid signature", { providedSignature });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 498,
      });
    }

    const payload = JSON.parse(rawBody);
    const events = Array.isArray(payload?.events) ? payload.events : [];
    logStep("Webhook received", { eventCount: events.length });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Map a GoCardless subscription status to our local subscription/profile status
    const mapStatus = (action: string): { sub: string; profile: string; plan?: string } | null => {
      switch (action) {
        case "cancelled":
        case "finished":
          return { sub: "cancelled", profile: "cancelled", plan: "free" };
        case "paused":
          return { sub: "paused", profile: "paused" };
        case "resumed":
        case "created":
          return { sub: "active", profile: "active" };
        default:
          return null;
      }
    };

    for (const event of events) {
      const resourceType = event?.resource_type;
      const action = event?.action;

      if (resourceType !== "subscriptions") {
        logStep("Skipping non-subscription event", { resourceType, action });
        continue;
      }

      const subscriptionId = event?.links?.subscription;
      if (!subscriptionId) {
        logStep("No subscription id on event", { action });
        continue;
      }

      const mapped = mapStatus(action);
      if (!mapped) {
        logStep("Unhandled subscription action", { action });
        continue;
      }

      // Find the local subscription row by GoCardless subscription id
      const { data: localSub } = await supabaseClient
        .from("subscriptions")
        .select("user_id")
        .eq("gocardless_subscription_id", subscriptionId)
        .single();

      if (!localSub?.user_id) {
        logStep("No local subscription found for id", { subscriptionId, action });
        continue;
      }

      await supabaseClient
        .from("subscriptions")
        .update({ status: mapped.sub, updated_at: new Date().toISOString() })
        .eq("gocardless_subscription_id", subscriptionId);

      const profileUpdate: Record<string, unknown> = {
        subscription_status: mapped.profile,
        updated_at: new Date().toISOString(),
      };
      if (mapped.plan) profileUpdate.plan = mapped.plan;

      await supabaseClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", localSub.user_id);

      logStep("Subscription synced", { subscriptionId, action, status: mapped.sub });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
