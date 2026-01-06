import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOCARDLESS_API_URL = "https://api.gocardless.com";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
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
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

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

    // Get subscription details from GoCardless
    const subResponse = await fetch(
      `${GOCARDLESS_API_URL}/subscriptions/${subscription.gocardless_subscription_id}`,
      {
        headers: {
          "Authorization": `Bearer ${gcToken}`,
          "GoCardless-Version": "2015-07-06",
        }
      }
    );

    if (!subResponse.ok) {
      throw new Error("Failed to fetch subscription from GoCardless");
    }

    const subData = await subResponse.json();
    const gcSubscription = subData.subscriptions;

    // Get mandate details
    const mandateResponse = await fetch(
      `${GOCARDLESS_API_URL}/mandates/${gcSubscription.links.mandate}`,
      {
        headers: {
          "Authorization": `Bearer ${gcToken}`,
          "GoCardless-Version": "2015-07-06",
        }
      }
    );

    let mandateDetails = null;
    if (mandateResponse.ok) {
      const mandateData = await mandateResponse.json();
      mandateDetails = mandateData.mandates;
    }

    // Get customer details
    const customerResponse = await fetch(
      `${GOCARDLESS_API_URL}/customers/${gcSubscription.links.customer}`,
      {
        headers: {
          "Authorization": `Bearer ${gcToken}`,
          "GoCardless-Version": "2015-07-06",
        }
      }
    );

    let customerDetails = null;
    if (customerResponse.ok) {
      const customerData = await customerResponse.json();
      customerDetails = customerData.customers;
    }

    // Get recent payments
    const paymentsResponse = await fetch(
      `${GOCARDLESS_API_URL}/payments?subscription=${gcSubscription.id}&limit=5`,
      {
        headers: {
          "Authorization": `Bearer ${gcToken}`,
          "GoCardless-Version": "2015-07-06",
        }
      }
    );

    let payments = [];
    if (paymentsResponse.ok) {
      const paymentsData = await paymentsResponse.json();
      payments = paymentsData.payments || [];
    }

    logStep("Retrieved subscription details");

    // Format response with subscription management info
    const response = {
      subscription: {
        id: gcSubscription.id,
        status: gcSubscription.status,
        amount: parseInt(gcSubscription.amount) / 100,
        currency: gcSubscription.currency,
        name: gcSubscription.name,
        interval: gcSubscription.interval,
        interval_unit: gcSubscription.interval_unit,
        upcoming_payments: gcSubscription.upcoming_payments?.slice(0, 3) || [],
        created_at: gcSubscription.created_at,
      },
      mandate: mandateDetails ? {
        id: mandateDetails.id,
        status: mandateDetails.status,
        scheme: mandateDetails.scheme,
        reference: mandateDetails.reference,
      } : null,
      customer: customerDetails ? {
        email: customerDetails.email,
        given_name: customerDetails.given_name,
        family_name: customerDetails.family_name,
      } : null,
      recent_payments: payments.map((p: any) => ({
        id: p.id,
        amount: parseInt(p.amount) / 100,
        currency: p.currency,
        status: p.status,
        charge_date: p.charge_date,
      })),
      // GoCardless doesn't have a customer portal like Stripe
      // So we return the data for the app to display
      portal_type: "inline"
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in customer-portal", { message: errorMessage });
    console.error("Customer portal error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
