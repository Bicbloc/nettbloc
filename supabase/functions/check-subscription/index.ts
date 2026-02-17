import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOCARDLESS_API_URL = "https://api.gocardless.com";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const gcToken = Deno.env.get("GOCARDLESS_ACCESS_TOKEN");
    if (!gcToken) throw new Error("GOCARDLESS_ACCESS_TOKEN is not set");
    logStep("GoCardless token verified");

    // Use service role key for database writes
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // First check local database for subscription
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let hasActiveSubscription = false;
    let subscriptionData = null;
    let plan = "free";

    if (subscription?.gocardless_subscription_id) {
      logStep("Found local subscription", { subscriptionId: subscription.gocardless_subscription_id });

      // Verify subscription status with GoCardless
      const gcResponse = await fetch(
        `${GOCARDLESS_API_URL}/subscriptions/${subscription.gocardless_subscription_id}`,
        {
          headers: {
            "Authorization": `Bearer ${gcToken}`,
            "GoCardless-Version": "2015-07-06",
          }
        }
      );

      if (gcResponse.ok) {
        const gcData = await gcResponse.json();
        const gcSubscription = gcData.subscriptions;
        logStep("GoCardless subscription status", { status: gcSubscription.status });

        if (gcSubscription.status === "active") {
          hasActiveSubscription = true;
          plan = subscription.plan || "confort";
          
          // Calculate next payment date
          const upcomingPayments = gcSubscription.upcoming_payments || [];
          const nextPayment = upcomingPayments[0];
          
          subscriptionData = {
            gocardless_customer_id: gcSubscription.links?.customer,
            gocardless_subscription_id: gcSubscription.id,
            gocardless_mandate_id: gcSubscription.links?.mandate,
            status: gcSubscription.status,
            current_period_end: nextPayment?.charge_date || null,
          };
        }
      }
    }

    // Check for pending billing requests that might have been fulfilled
    if (!hasActiveSubscription) {
      const { data: pending } = await supabaseClient
        .from("pending_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .single();

      if (pending?.billing_request_id) {
        logStep("Checking pending billing request", { billingRequestId: pending.billing_request_id });

        const brResponse = await fetch(
          `${GOCARDLESS_API_URL}/billing_requests/${pending.billing_request_id}`,
          {
            headers: {
              "Authorization": `Bearer ${gcToken}`,
              "GoCardless-Version": "2015-07-06",
            }
          }
        );

        if (brResponse.ok) {
          const brData = await brResponse.json();
          const billingRequest = brData.billing_requests;
          logStep("Billing request status", { status: billingRequest.status });

          if (billingRequest.status === "fulfilled" && billingRequest.links?.mandate) {
            // Mandate was created, now create subscription
            logStep("Mandate created, creating subscription", { mandateId: billingRequest.links.mandate });

            const planConfig = PLAN_PRICES[pending.plan_type] || PLAN_PRICES.confort;
            
            // Calculate start_date: 1st of next month for end-of-month billing
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const startDateStr = startDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
            logStep("Subscription will start on", { startDate: startDateStr });
            
            const subResponse = await fetch(`${GOCARDLESS_API_URL}/subscriptions`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${gcToken}`,
                "GoCardless-Version": "2015-07-06",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                subscriptions: {
                  amount: pending.amount.toString(),
                  currency: "EUR",
                  name: planConfig?.name || "Abonnement Nettobloc",
                  interval_unit: "monthly",
                  interval: 1,
                  day_of_month: 1, // Prélèvement le 1er de chaque mois
                  start_date: startDateStr, // Premier prélèvement le 1er du mois prochain
                  metadata: {
                    user_id: user.id,
                    plan_type: pending.plan_type,
                  },
                  links: {
                    mandate: billingRequest.links.mandate
                  }
                }
              })
            });

            if (subResponse.ok) {
              const subData = await subResponse.json();
              const newSubscription = subData.subscriptions;
              logStep("Subscription created", { subscriptionId: newSubscription.id });

              hasActiveSubscription = true;
              plan = pending.plan_type;

              subscriptionData = {
                gocardless_customer_id: billingRequest.links?.customer,
                gocardless_subscription_id: newSubscription.id,
                gocardless_mandate_id: billingRequest.links.mandate,
                status: newSubscription.status,
              };

              // Update pending subscription status
              await supabaseClient
                .from("pending_subscriptions")
                .update({ status: "completed" })
                .eq("id", pending.id);
            }
          }
        }
      }
    }

    // Update subscription data in database
    if (subscriptionData) {
      await supabaseClient.from("subscriptions").upsert({
        user_id: user.id,
        plan: plan,
        ...subscriptionData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    // Update profile plan
    await supabaseClient.from("profiles").update({
      plan: plan,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    logStep("Subscription check complete", { hasActiveSubscription, plan });

    return new Response(JSON.stringify({
      subscribed: hasActiveSubscription,
      plan: plan,
      subscription_end: subscriptionData?.current_period_end
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Check subscription error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Plan prices reference
const PLAN_PRICES: Record<string, { name: string }> = {
  essentiel: { name: "Plan Essentiel Nettobloc" },
  confort: { name: "Plan Confort Nettobloc" },
  business: { name: "Plan Business Nettobloc" },
  entreprise: { name: "Plan Entreprise Nettobloc" }
};
