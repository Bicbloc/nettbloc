import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ArchiveRecapRequest {
  to: string;
  hotelName?: string;
  reportDate: string; // yyyy-MM-dd
  pdfUrl?: string | null;
  summary?: {
    roomsArchived?: number;
    assignmentsCleared?: number;
    linenTasksArchived?: number;
    totalActions?: number;
  };
}

const isEmail = (v: unknown): v is string =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, hotelName, reportDate, pdfUrl, summary }: ArchiveRecapRequest =
      await req.json();

    if (!isEmail(to)) {
      return new Response(
        JSON.stringify({ error: "Adresse e-mail invalide" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (!reportDate) {
      return new Response(
        JSON.stringify({ error: "reportDate requis" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const dateLabel = new Date(reportDate).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const s = summary || {};
    const statRow = (label: string, value: number | undefined) =>
      value === undefined
        ? ""
        : `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555;">${label}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;text-align:right;">${value}</td>
          </tr>`;

    const pdfButton = pdfUrl
      ? `<p style="margin:24px 0;text-align:center;">
           <a href="${pdfUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">📄 Télécharger le rapport PDF</a>
         </p>`
      : `<p style="color:#888;font-size:13px;">Le rapport PDF n'a pas pu être généré pour cette clôture.</p>`;

    const emailResponse = await resend.emails.send({
      from: "NettoBloc <support@bicbloc.eu>",
      to: [to.trim()],
      replyTo: "support@bicbloc.eu",
      subject: `Récapitulatif d'archivage — ${hotelName || "Hôtel"} — ${dateLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;background:#ffffff;">
          <div style="max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;padding:20px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;">✅ Journée clôturée</h2>
              <p style="margin:5px 0 0 0;opacity:0.9;">${hotelName || ""} — ${dateLabel}</p>
            </div>
            <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;">
              <p>Voici le récapitulatif de l'archivage de la journée :</p>
              <table style="width:100%;border-collapse:collapse;margin:12px 0;">
                ${statRow("Chambres archivées", s.roomsArchived)}
                ${statRow("Assignations réinitialisées", s.assignmentsCleared)}
                ${statRow("Inventaires linge archivés", s.linenTasksArchived)}
                ${statRow("Actions enregistrées", s.totalActions)}
              </table>
              ${pdfButton}
            </div>
            <div style="background:#1f2937;color:#9ca3af;padding:15px;text-align:center;font-size:12px;border-radius:0 0 8px 8px;">
              <p>Envoyé via <a href="https://nettobloc.bicbloc.eu" style="color:#60a5fa;">NettoBloc</a> — Gestion hôtelière simplifiée</p>
              <p>© ${new Date().getFullYear()} BicBloc</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Archive recap email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-archive-recap:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
