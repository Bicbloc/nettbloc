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

function buildInvoicePdf(invoice: any): Uint8Array {
  const amountHt = (invoice.amount_ht / 100).toFixed(2);
  const tvaAmount = (invoice.tva_amount / 100).toFixed(2);
  const amountTtc = (invoice.amount_ttc / 100).toFixed(2);

  const sellerName = invoice.seller_name || 'BicBloc';
  const sellerSiret = invoice.seller_siret || '97864605700015';
  const sellerAddress = invoice.seller_address || '60 RUE FRANCOIS IER, 75008 PARIS';
  const sellerEmail = invoice.seller_email || 'support@bicbloc.eu';

  const customerName = invoice.customer_company_name || invoice.customer_email || 'Client';
  const customerEmail = invoice.customer_billing_email || invoice.customer_email || '';
  const customerAddress = invoice.customer_address || '';
  const customerSiret = invoice.customer_siret || '';

  const invoiceDate = invoice.invoice_date || new Date().toISOString().split('T')[0];
  const periodStart = invoice.period_start || '';
  const periodEnd = invoice.period_end || '';

  const lines: string[] = [];
  lines.push(`FACTURE N° ${invoice.invoice_number}`);
  lines.push('');
  lines.push(`Date : ${invoiceDate}`);
  if (periodStart && periodEnd) {
    lines.push(`Période : ${periodStart} - ${periodEnd}`);
  }
  lines.push('');
  lines.push('--- VENDEUR ---');
  lines.push(sellerName);
  lines.push(`SIRET : ${sellerSiret}`);
  lines.push(sellerAddress);
  lines.push(`Email : ${sellerEmail}`);
  lines.push('');
  lines.push('--- CLIENT ---');
  lines.push(customerName);
  if (customerSiret) lines.push(`SIRET : ${customerSiret}`);
  if (customerAddress) lines.push(customerAddress);
  if (customerEmail) lines.push(`Email : ${customerEmail}`);
  lines.push('');
  lines.push('--- DÉTAILS ---');
  lines.push(`Désignation : ${invoice.plan_name || invoice.plan_type}`);
  lines.push(`Montant HT  : ${amountHt} EUR`);
  lines.push(`TVA (${invoice.tva_rate || 20}%) : ${tvaAmount} EUR`);
  lines.push(`Montant TTC : ${amountTtc} EUR`);
  lines.push('');
  lines.push(`Statut : ${invoice.status === 'paid' ? 'Payée' : invoice.status}`);
  if (invoice.payment_reference) {
    lines.push(`Référence paiement : ${invoice.payment_reference}`);
  }

  const textContent = lines.join('\n');

  // Build a minimal valid PDF with the text content
  const encoder = new TextEncoder();
  const streamLines = textContent.split('\n');

  // Build page content stream
  let contentStream = 'BT\n/F1 11 Tf\n';
  let y = 780;
  for (const line of streamLines) {
    // Escape PDF special chars
    const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    contentStream += `1 0 0 1 50 ${y} Tm\n(${safe}) Tj\n`;
    y -= 16;
    if (y < 40) break;
  }
  contentStream += 'ET\n';

  const streamBytes = encoder.encode(contentStream);

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length ${streamBytes.length} >>
stream
${contentStream}endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
${String(300 + streamBytes.length).padStart(10, '0')} 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
${360 + streamBytes.length}
%%EOF`;

  return encoder.encode(pdf);
}

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

    // ---- MODE 1: Download / generate PDF for an existing invoice ----
    if (body.invoiceId) {
      const { invoiceId } = body;
      logStep("PDF download requested", { invoiceId });

      const { data: invoice, error: fetchErr } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (fetchErr || !invoice) {
        throw new Error("Invoice not found");
      }

      // If PDF already exists in storage, return a signed URL
      if (invoice.pdf_url) {
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from('invoices')
          .createSignedUrl(invoice.pdf_url, 3600);
        if (signErr) throw signErr;
        return new Response(JSON.stringify({ success: true, pdf_url: signed.signedUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate PDF bytes
      const pdfBytes = buildInvoicePdf(invoice);
      const storagePath = `${invoice.user_id}/${invoice.invoice_number}.pdf`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('invoices')
        .upload(storagePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadErr) {
        logStep("Upload error", uploadErr);
        throw new Error(`Upload failed: ${uploadErr.message}`);
      }

      // Save path in DB
      await supabaseAdmin
        .from('invoices')
        .update({ pdf_url: storagePath })
        .eq('id', invoiceId);

      // Return signed URL
      const { data: signed2, error: signErr2 } = await supabaseAdmin.storage
        .from('invoices')
        .createSignedUrl(storagePath, 3600);

      if (signErr2) throw signErr2;

      logStep("PDF generated and uploaded", { storagePath });

      return new Response(JSON.stringify({ success: true, pdf_url: signed2.signedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- MODE 2: Create a new invoice record ----
    const { user_id, plan_type, amount_cents, payment_reference } = body;

    if (!user_id || !plan_type || !amount_cents) {
      throw new Error("Missing required fields: user_id, plan_type, amount_cents");
    }

    logStep("Creating invoice", { user_id, plan_type, amount_cents });

    // Get user hotel
    const { data: hotel } = await supabaseAdmin
      .from('hotels')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle();

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

    const amountHt = amount_cents;
    const tvaRate = 20.00;
    const tvaAmount = Math.round(amountHt * (tvaRate / 100));
    const amountTtc = amountHt + tvaAmount;

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { data: seqData, error: seqError } = await supabaseAdmin
      .rpc('nextval', { seq_name: 'invoice_number_seq' });

    let sequenceNumber: number;
    if (seqError) {
      const { count } = await supabaseAdmin
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .gte('invoice_date', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
      sequenceNumber = (count || 0) + 1;
    } else {
      sequenceNumber = seqData as number;
    }

    const invoiceNumber = `Netto-${yearMonth}-${String(sequenceNumber).padStart(4, '0')}`;

    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id,
        hotel_id: hotel?.id || null,
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

    logStep("Invoice created", { invoiceId: invoice.id, invoiceNumber });

    return new Response(JSON.stringify({
      success: true,
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
