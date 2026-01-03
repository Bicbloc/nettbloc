import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan prices in cents (HT)
const PLAN_PRICES: Record<string, { amount: number; name: string; description: string; trialDays?: number }> = {
  basic: { 
    amount: 15000, // 150€ HT
    name: "Plan Basic Nettobloc",
    description: "70 chambres max, PDF, distribution, rapports",
    trialDays: 90
  },
  basic_plus: { 
    amount: 25000, // 250€ HT
    name: "Plan Basic+ Nettobloc",
    description: "170 chambres max, PDF, distribution, rapports"
  },
  premium: { 
    amount: 20000, // 200€ HT
    name: "Plan Premium Nettobloc",
    description: "150 chambres, incidents, inventaire linge, inspection",
    trialDays: 90
  },
  platinum: { 
    amount: 40000, // 400€ HT
    name: "Plan Platinum Nettobloc",
    description: "Chambres illimitées, toutes fonctionnalités, API"
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const planType = body.planType || 'premium';
    const promoCode = body.promoCode;

    // Get plan configuration
    const planConfig = PLAN_PRICES[planType];
    if (!planConfig) {
      throw new Error(`Invalid plan type: ${planType}`);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { 
              name: planConfig.name,
              description: planConfig.description
            },
            unit_amount: planConfig.amount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/success?session_id={CHECKOUT_SESSION_ID}&plan=${planType}`,
      cancel_url: `${req.headers.get("origin")}/plans?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_type: planType,
      },
    };

    // Add trial period if applicable
    if (planConfig.trialDays) {
      sessionConfig.subscription_data = {
        trial_period_days: planConfig.trialDays,
        metadata: {
          user_id: user.id,
          plan_type: planType,
        }
      };
    }

    // Apply promo code if provided
    if (promoCode) {
      try {
        // Try to find the coupon in Stripe
        const coupons = await stripe.coupons.list({ limit: 100 });
        const matchingCoupon = coupons.data.find(c => c.name?.toUpperCase() === promoCode.toUpperCase());
        if (matchingCoupon) {
          sessionConfig.discounts = [{ coupon: matchingCoupon.id }];
        }
      } catch (e) {
        console.log("Promo code not found in Stripe:", promoCode);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
