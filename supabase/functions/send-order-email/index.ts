import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OrderEmailRequest {
  supplierEmail: string;
  subject: string;
  body: string;
  hotelName: string;
  hotelEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplierEmail, subject, body, hotelName, hotelEmail }: OrderEmailRequest = await req.json();

    // Validate required fields
    if (!supplierEmail || !subject || !body) {
      throw new Error("Missing required fields: supplierEmail, subject, or body");
    }

    // Convert plain text body to HTML
    const htmlBody = body
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');

    // Send email via Resend with NettoBloc as sender
    const emailResponse = await resend.emails.send({
      from: "NettoBloc <support@bicbloc.eu>",
      to: [supplierEmail],
      cc: hotelEmail ? [hotelEmail, "support@bicbloc.eu"] : ["support@bicbloc.eu"],
      replyTo: hotelEmail || "support@bicbloc.eu",
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .footer { background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
            .footer a { color: #60a5fa; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">📋 Commande de Personnel</h2>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">${hotelName}</p>
            </div>
            <div class="content">
              ${htmlBody}
            </div>
            <div class="footer">
              <p>Envoyé via <a href="https://nettobloc.bicbloc.eu">NettoBloc</a> - Gestion hôtelière simplifiée</p>
              <p>© ${new Date().getFullYear()} BicBloc</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Order email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-order-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
