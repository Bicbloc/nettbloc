import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check for Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let hasActiveSubscription = false;
    let subscriptionData = null;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      
      // Check for active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        hasActiveSubscription = true;
        const subscription = subscriptions.data[0];
        subscriptionData = {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        };
      }
    }

    const plan = hasActiveSubscription ? "premium" : "free";

    // Update subscription data in database
    await supabaseClient.from("subscriptions").upsert({
      user_id: user.id,
      plan: plan,
      ...subscriptionData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Update profile plan
    await supabaseClient.from("profiles").update({
      plan: plan,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

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