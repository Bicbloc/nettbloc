import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOCARDLESS_API_URL = "https://api.gocardless.com";

// Plan display names (amounts come from pricing_config table)
const PLAN_NAMES: Record<string, { name: string; description: string }> = {
  basic: { 
    name: "Plan Basic Nettobloc",
    description: "70 chambres max, PDF, distribution, rapports"
  },
  basic_plus: { 
    name: "Plan Basic+ Nettobloc",
    description: "170 chambres max, PDF, distribution, rapports"
  },
  premium: { 
    name: "Plan Premium Nettobloc",
    description: "150 chambres, incidents, inventaire linge, inspection"
  },
  platinum: { 
    name: "Plan Platinum Nettobloc",
    description: "Chambres illimitées, toutes fonctionnalités, API"
  }
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const planType = body.planType || 'premium';

    // Get plan configuration from pricing_config table
    const planNames = PLAN_NAMES[planType];
    if (!planNames) {
      throw new Error(`Invalid plan type: ${planType}`);
    }

    // Fetch price and availability from database
    const { data: pricingRow, error: pricingError } = await supabaseClient
      .from("pricing_config")
      .select("price_monthly, is_active")
      .eq("plan_name", planType)
      .maybeSingle();

    if (pricingError) {
      logStep("Error fetching pricing config", pricingError);
      throw new Error("Unable to fetch plan pricing");
    }

    if (!pricingRow) {
      throw new Error(`Plan ${planType} not found in pricing configuration`);
    }

    if (pricingRow.is_active === false) {
      return new Response(
        JSON.stringify({ error: "PLAN_DISABLED", code: "plan_disabled" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Convert price from euros to cents
    const amountInCents = Math.round(Number(pricingRow.price_monthly) * 100);
    logStep("Plan config from DB", { planType, amountInCents, priceMonthly: pricingRow.price_monthly });

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Create a GoCardless Billing Request Flow
    // This creates a hosted checkout page for mandate setup
    const billingRequestResponse = await fetch(`${GOCARDLESS_API_URL}/billing_requests`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gcToken}`,
        "GoCardless-Version": "2015-07-06",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billing_requests: {
          mandate_request: {
            scheme: "sepa_core",
            currency: "EUR",
            verify: "when_available"
          },
          metadata: {
            user_id: user.id,
            user_email: user.email,
            plan_type: planType,
          }
        }
      })
    });

    if (!billingRequestResponse.ok) {
      const errorData = await billingRequestResponse.json();
      logStep("Billing request error", errorData);
      throw new Error(`GoCardless error: ${JSON.stringify(errorData)}`);
    }

    const billingRequestData = await billingRequestResponse.json();
    const billingRequestId = billingRequestData.billing_requests.id;
    logStep("Billing request created", { billingRequestId });

    // Create a Billing Request Flow (hosted checkout page)
    const flowResponse = await fetch(`${GOCARDLESS_API_URL}/billing_request_flows`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gcToken}`,
        "GoCardless-Version": "2015-07-06",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billing_request_flows: {
          redirect_uri: `${origin}/success?billing_request_id=${billingRequestId}&plan=${planType}`,
          exit_uri: `${origin}/plans?canceled=true`,
          links: {
            billing_request: billingRequestId
          },
          prefilled_customer: {
            email: user.email,
          },
          lock_customer_details: false,
          lock_bank_account: false,
          show_redirect_buttons: true,
          show_success_redirect_button: true,
        }
      })
    });

    if (!flowResponse.ok) {
      const errorData = await flowResponse.json();
      logStep("Flow creation error", errorData);
      throw new Error(`GoCardless flow error: ${JSON.stringify(errorData)}`);
    }

    const flowData = await flowResponse.json();
    const authorisationUrl = flowData.billing_request_flows.authorisation_url;
    logStep("Billing request flow created", { url: authorisationUrl });

    // Store pending subscription in database
    await supabaseClient.from("pending_subscriptions").upsert({
      user_id: user.id,
      billing_request_id: billingRequestId,
      plan_type: planType,
      amount: amountInCents,
      status: "pending",
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ url: authorisationUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    console.error("Checkout error:", error);

    return new Response(
      JSON.stringify({ error: message, code: "checkout_error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
