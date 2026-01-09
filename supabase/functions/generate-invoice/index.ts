import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_NAMES: Record<string, string> = {
  basic: "Plan Basic Nettobloc",
  basic_plus: "Plan Basic+ Nettobloc",
  premium: "Plan Premium Nettobloc",
  platinum: "Plan Platinum Nettobloc",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-INVOICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { user_id, plan_type, amount_cents, payment_reference } = body;

    if (!user_id || !plan_type || !amount_cents) {
      throw new Error("Missing required fields: user_id, plan_type, amount_cents");
    }

    logStep("Generating invoice", { user_id, plan_type, amount_cents });

    // Get user profile with billing info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, company_name, billing_siret, billing_address, billing_email')
      .eq('id', user_id)
      .single();

    if (profileError) {
      logStep("Profile error", profileError);
      throw new Error("User profile not found");
    }

    // Calculate amounts
    const amountHt = amount_cents; // Amount is already in cents
    const tvaRate = 20.00;
    const tvaAmount = Math.round(amountHt * (tvaRate / 100));
    const amountTtc = amountHt + tvaAmount;

    // Generate invoice number: Netto-YYYYMM-XXXX
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Get the next sequence number
    const { data: seqData, error: seqError } = await supabaseAdmin
      .rpc('nextval', { seq_name: 'invoice_number_seq' });
    
    let sequenceNumber: number;
    if (seqError) {
      // Fallback: count existing invoices for this month + 1
      const { count } = await supabaseAdmin
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .gte('invoice_date', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
      sequenceNumber = (count || 0) + 1;
    } else {
      sequenceNumber = seqData as number;
    }

    const invoiceNumber = `Netto-${yearMonth}-${String(sequenceNumber).padStart(4, '0')}`;
    logStep("Invoice number generated", { invoiceNumber });

    // Calculate period (current month)
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id,
        invoice_number: invoiceNumber,
        invoice_date: now.toISOString().split('T')[0],
        amount_ht: amountHt,
        tva_rate: tvaRate,
        tva_amount: tvaAmount,
        amount_ttc: amountTtc,
        plan_type,
        plan_name: PLAN_NAMES[plan_type] || plan_type,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        customer_email: profile.email,
        customer_company_name: profile.company_name,
        customer_siret: profile.billing_siret,
        customer_address: profile.billing_address,
        customer_billing_email: profile.billing_email,
        payment_reference,
        status: 'paid',
      })
      .select()
      .single();

    if (invoiceError) {
      logStep("Invoice creation error", invoiceError);
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    logStep("Invoice created successfully", { invoiceId: invoice.id, invoiceNumber });

    return new Response(JSON.stringify({ 
      success: true, 
      invoice_id: invoice.id,
      invoice_number: invoiceNumber 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    console.error("Invoice generation error:", error);

    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
