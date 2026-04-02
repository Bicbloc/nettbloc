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

// ---------------------------------------------------------------------------
// WinAnsiEncoding helper – maps common French characters to their byte values
// ---------------------------------------------------------------------------
function pdfEncode(text: string): Uint8Array {
  const winAnsi: Record<number, number> = {
    8217: 146, // '
    8216: 145, // '
    8220: 147, // "
    8221: 148, // "
    8211: 150, // –
    8212: 151, // —
    8230: 133, // …
    8364: 128, // €
    338: 140,  // Œ
    339: 156,  // œ
  };
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 256) {
      bytes.push(code);
    } else if (winAnsi[code] !== undefined) {
      bytes.push(winAnsi[code]);
    } else {
      bytes.push(63); // '?'
    }
  }
  return new Uint8Array(bytes);
}

// Escape a string for use inside a PDF (...) literal
function pdfEsc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ---------------------------------------------------------------------------
// Professional invoice PDF builder
// ---------------------------------------------------------------------------
function buildInvoicePdf(invoice: any): Uint8Array {
  const PAGE_W = 595;
  const PAGE_H = 842;
  const ML = 50;  // margin left
  const MR = 50;  // margin right
  const CW = PAGE_W - ML - MR; // content width = 495

  const amountHt  = (invoice.amount_ht / 100).toFixed(2).replace('.', ',');
  const tvaAmount = (invoice.tva_amount / 100).toFixed(2).replace('.', ',');
  const amountTtc = (invoice.amount_ttc / 100).toFixed(2).replace('.', ',');
  const tvaRate   = invoice.tva_rate || 20;

  const sellerName    = invoice.seller_name || 'BicBloc';
  const sellerSiret   = invoice.seller_siret || '97864605700015';
  const sellerAddress = invoice.seller_address || '60 RUE FRANCOIS 1ER, 75008 PARIS';
  const sellerEmail   = invoice.seller_email || 'support@bicbloc.eu';

  const customerName    = invoice.customer_company_name || invoice.customer_email || 'Client';
  const customerEmail   = invoice.customer_billing_email || invoice.customer_email || '';
  const customerAddress = invoice.customer_address || '';
  const customerSiret   = invoice.customer_siret || '';

  const invoiceDate = invoice.invoice_date || new Date().toISOString().split('T')[0];
  const periodStart = invoice.period_start || '';
  const periodEnd   = invoice.period_end || '';
  const designation = invoice.plan_name || invoice.plan_type || 'Abonnement';
  const statusLabel = invoice.status === 'paid' ? 'Pay\u00e9e' : invoice.status;

  // Build content stream using PDF operators
  const ops: string[] = [];

  // Helper: draw text
  const text = (x: number, y: number, s: string, font = '/F1', size = 10) => {
    ops.push(`BT ${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEsc(s)}) Tj ET`);
  };
  // Helper: right-aligned text
  const textR = (xRight: number, y: number, s: string, font = '/F1', size = 10) => {
    // Approximate width: size * 0.5 per char (Helvetica average)
    const approxW = s.length * size * 0.5;
    text(xRight - approxW, y, s, font, size);
  };
  // Helper: rectangle (stroke)
  const rect = (x: number, y: number, w: number, h: number) => {
    ops.push(`${x} ${y} ${w} ${h} re S`);
  };
  // Helper: filled rectangle
  const rectFill = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
    ops.push(`q ${r} ${g} ${b} rg ${x} ${y} ${w} ${h} re f Q`);
  };
  // Helper: line
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  };

  let y = PAGE_H - 50;

  // --- Header: Company name + FACTURE title ---
  ops.push('0.2 0.4 0.8 rg'); // blue color
  text(ML, y, sellerName, '/F2', 22);
  ops.push('0 0 0 rg'); // back to black

  text(ML + 300, y, 'FACTURE', '/F2', 22);
  y -= 30;

  // Invoice number & date
  ops.push('0.4 0.4 0.4 rg');
  text(ML + 300, y, `N\u00b0 ${invoice.invoice_number}`, '/F1', 11);
  y -= 16;
  text(ML + 300, y, `Date : ${invoiceDate}`, '/F1', 10);
  if (periodStart && periodEnd) {
    y -= 14;
    text(ML + 300, y, `P\u00e9riode : ${periodStart} au ${periodEnd}`, '/F1', 10);
  }
  ops.push('0 0 0 rg');

  // --- Seller info block ---
  y -= 40;
  const sellerY = y;
  rectFill(ML, y - 75, 220, 80, 0.95, 0.95, 0.97);
  rect(ML, y - 75, 220, 80);
  ops.push('0.2 0.2 0.2 rg');
  text(ML + 8, y - 2, '\u00c9metteur', '/F2', 10);
  ops.push('0 0 0 rg');
  text(ML + 8, y - 16, sellerName, '/F2', 9);
  text(ML + 8, y - 28, `SIRET : ${sellerSiret}`, '/F1', 8);
  text(ML + 8, y - 40, sellerAddress, '/F1', 8);
  text(ML + 8, y - 52, `Email : ${sellerEmail}`, '/F1', 8);

  // --- Client info block ---
  rectFill(ML + 260, sellerY - 75, 235, 80, 0.95, 0.97, 0.95);
  rect(ML + 260, sellerY - 75, 235, 80);
  ops.push('0.2 0.2 0.2 rg');
  text(ML + 268, sellerY - 2, 'Client', '/F2', 10);
  ops.push('0 0 0 rg');
  text(ML + 268, sellerY - 16, customerName, '/F2', 9);
  let cy = sellerY - 28;
  if (customerSiret) { text(ML + 268, cy, `SIRET : ${customerSiret}`, '/F1', 8); cy -= 12; }
  if (customerAddress) { text(ML + 268, cy, customerAddress, '/F1', 8); cy -= 12; }
  if (customerEmail) { text(ML + 268, cy, `Email : ${customerEmail}`, '/F1', 8); }

  // --- Table header ---
  y = sellerY - 105;
  const tableX = ML;
  const colWidths = [265, 60, 80, 90]; // designation, qty, unit price HT, total HT
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const rowH = 24;

  // Table header background
  rectFill(tableX, y - rowH, tableW, rowH, 0.15, 0.3, 0.6);

  // Table header text (white)
  ops.push('1 1 1 rg');
  const headers = ['D\u00e9signation', 'Qt\u00e9', 'P.U. HT', 'Total HT'];
  let hx = tableX + 6;
  for (let i = 0; i < headers.length; i++) {
    text(hx, y - 16, headers[i], '/F2', 9);
    hx += colWidths[i];
  }
  ops.push('0 0 0 rg');

  // Table body row
  y -= rowH;
  rect(tableX, y - rowH, tableW, rowH);
  // Vertical lines for header and body
  let lx = tableX;
  for (let i = 0; i < colWidths.length; i++) {
    line(lx, y, lx, y - rowH);
    lx += colWidths[i];
  }
  line(lx, y, lx, y - rowH); // right edge

  // Row content
  text(tableX + 6, y - 16, designation, '/F1', 9);
  text(tableX + colWidths[0] + 20, y - 16, '1', '/F1', 9);
  textR(tableX + colWidths[0] + colWidths[1] + colWidths[2] - 6, y - 16, `${amountHt} \u20ac`, '/F1', 9);
  textR(tableX + tableW - 6, y - 16, `${amountHt} \u20ac`, '/F1', 9);

  // --- Totals section ---
  y -= rowH + 20;
  const totX = tableX + 280;
  const totW = tableW - 280;

  // Sub-total HT
  rectFill(totX, y - 22, totW, 22, 0.96, 0.96, 0.96);
  text(totX + 6, y - 15, 'Total HT', '/F2', 9);
  textR(totX + totW - 6, y - 15, `${amountHt} \u20ac`, '/F1', 10);
  y -= 22;

  // TVA
  rectFill(totX, y - 22, totW, 22, 0.96, 0.96, 0.96);
  text(totX + 6, y - 15, `TVA (${tvaRate}%)`, '/F1', 9);
  textR(totX + totW - 6, y - 15, `${tvaAmount} \u20ac`, '/F1', 10);
  y -= 22;

  // Total TTC
  rectFill(totX, y - 26, totW, 26, 0.15, 0.3, 0.6);
  ops.push('1 1 1 rg');
  text(totX + 6, y - 18, 'Total TTC', '/F2', 11);
  textR(totX + totW - 6, y - 18, `${amountTtc} \u20ac`, '/F2', 12);
  ops.push('0 0 0 rg');

  // --- Payment info ---
  y -= 55;
  rectFill(ML, y - 50, CW, 50, 0.97, 0.97, 1);
  rect(ML, y - 50, CW, 50);
  text(ML + 8, y - 14, 'Informations de paiement', '/F2', 10);
  text(ML + 8, y - 28, `Statut : ${statusLabel}`, '/F1', 9);
  if (invoice.payment_reference) {
    text(ML + 8, y - 40, `R\u00e9f\u00e9rence : ${invoice.payment_reference}`, '/F1', 9);
  }
  if (invoice.payment_method) {
    const methodLabel = invoice.payment_method === 'gocardless_direct_debit' ? 'Pr\u00e9l\u00e8vement SEPA (GoCardless)' :
                        invoice.payment_method === 'card' ? 'Carte bancaire' : invoice.payment_method;
    text(ML + 250, y - 28, `Mode : ${methodLabel}`, '/F1', 9);
  }

  // --- Footer ---
  ops.push('0.5 0.5 0.5 rg');
  line(ML, 60, PAGE_W - MR, 60);
  text(ML, 45, `${sellerName} - SIRET ${sellerSiret} - ${sellerAddress}`, '/F1', 7);
  text(ML, 35, 'TVA non applicable, art. 293 B du CGI (sauf indication contraire)', '/F1', 7);
  ops.push('0 0 0 rg');

  // Set line width
  ops.unshift('0.5 w');

  // Encode content stream with WinAnsi
  const contentStr = ops.join('\n') + '\n';
  const contentBytes = pdfEncode(contentStr);
  const contentLen = contentBytes.length;

  // ---- Build PDF structure ----
  // We'll build objects manually and track offsets
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const addRaw = (s: string) => {
    const b = pdfEncode(s);
    parts.push(b);
    pos += b.length;
  };
  const addBytes = (b: Uint8Array) => {
    parts.push(b);
    pos += b.length;
  };

  addRaw('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');

  // obj 1: Catalog
  offsets.push(pos);
  addRaw('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // obj 2: Pages
  offsets.push(pos);
  addRaw('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // obj 3: Page
  offsets.push(pos);
  addRaw(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}]\n   /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`);

  // obj 4: Content stream
  offsets.push(pos);
  addRaw(`4 0 obj\n<< /Length ${contentLen} >>\nstream\n`);
  addBytes(contentBytes);
  addRaw('endstream\nendobj\n');

  // obj 5: Font Helvetica
  offsets.push(pos);
  addRaw('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');

  // obj 6: Font Helvetica-Bold
  offsets.push(pos);
  addRaw('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

  // xref
  const xrefPos = pos;
  const numObjs = offsets.length + 1; // including obj 0
  addRaw(`xref\n0 ${numObjs}\n0000000000 65535 f \n`);
  for (const off of offsets) {
    addRaw(`${String(off).padStart(10, '0')} 00000 n \n`);
  }

  // trailer
  addRaw(`trailer\n<< /Size ${numObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  // Concatenate all parts
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
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
      const returnBlob = body.returnBlob === true;
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
      if (invoice.pdf_url && !returnBlob) {
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from('invoices')
          .createSignedUrl(invoice.pdf_url, 3600);
        if (signErr) throw signErr;
        return new Response(JSON.stringify({ success: true, pdf_url: signed.signedUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pdfBytes = buildInvoicePdf(invoice);
      // Always regenerate and overwrite storage
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

      if (returnBlob) {
        return new Response(pdfBytes, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
          },
        });
      }

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
