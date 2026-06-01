import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOCARDLESS_API_URL = "https://api.gocardless.com";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAUSE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const gcToken = Deno.env.get("GOCARDLESS_ACCESS_TOKEN");
    if (!gcToken) throw new Error("GOCARDLESS_ACCESS_TOKEN is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Optional number of cycles to pause for
    let pauseCycles: number | undefined;
    try {
      const body = await req.json();
      if (body?.pauseCycles && Number.isInteger(body.pauseCycles) && body.pauseCycles > 0) {
        pauseCycles = body.pauseCycles;
      }
    } catch (_) { /* no body */ }

    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.gocardless_subscription_id) {
      throw new Error("No active subscription found");
    }

    logStep("Found subscription", { subscriptionId: subscription.gocardless_subscription_id });

    const pausePayload: Record<string, unknown> = {};
    if (pauseCycles) pausePayload.pause_cycles = pauseCycles;

    const pauseResponse = await fetch(
      `${GOCARDLESS_API_URL}/subscriptions/${subscription.gocardless_subscription_id}/actions/pause`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gcToken}`,
          "GoCardless-Version": "2015-07-06",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: pausePayload }),
      }
    );

    if (!pauseResponse.ok) {
      const errorData = await pauseResponse.json();
      logStep("Pause error", errorData);
      throw new Error(`Failed to pause subscription: ${JSON.stringify(errorData)}`);
    }

    const pauseData = await pauseResponse.json();
    logStep("Subscription paused", { status: pauseData.subscriptions?.status });

    await supabaseClient
      .from("subscriptions")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    await supabaseClient
      .from("profiles")
      .update({ subscription_status: "paused", updated_at: new Date().toISOString() })
      .eq("id", user.id);

    return new Response(JSON.stringify({
      success: true,
      message: "Subscription paused successfully",
    }), {
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
