import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOCARDLESS_API_URL = "https://api.gocardless.com";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }
    logStep("User authenticated", { userId: user.id });

    // Get subscription from database
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.gocardless_subscription_id) {
      throw new Error("No active subscription found");
    }

    logStep("Found subscription", { subscriptionId: subscription.gocardless_subscription_id });

    // Cancel subscription in GoCardless
    const cancelResponse = await fetch(
      `${GOCARDLESS_API_URL}/subscriptions/${subscription.gocardless_subscription_id}/actions/cancel`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gcToken}`,
          "GoCardless-Version": "2015-07-06",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({})
      }
    );

    if (!cancelResponse.ok) {
      const errorData = await cancelResponse.json();
      logStep("Cancel error", errorData);
      throw new Error(`Failed to cancel subscription: ${JSON.stringify(errorData)}`);
    }

    const cancelData = await cancelResponse.json();
    logStep("Subscription cancelled", { status: cancelData.subscriptions.status });

    // Update local database
    await supabaseClient
      .from("subscriptions")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    await supabaseClient
      .from("profiles")
      .update({
        plan: "free",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Subscription cancelled successfully" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    console.error("Cancel subscription error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
