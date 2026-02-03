import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  subAccountId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
  hotelName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { subAccountId, email, firstName, lastName, roleName, hotelName }: InvitationRequest = await req.json();

    if (!subAccountId || !email || !firstName) {
      throw new Error("Missing required fields: subAccountId, email, firstName");
    }

    // Generate unique invitation code
    const invitationCode = crypto.randomUUID().slice(0, 8).toUpperCase();

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('sub_account_invitations')
      .insert({
        sub_account_id: subAccountId,
        invitation_code: invitationCode,
        status: 'pending',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      throw new Error(`Failed to create invitation: ${inviteError.message}`);
    }

    // Update sub_account with invitation status
    await supabase
      .from('sub_accounts')
      .update({ 
        invitation_status: 'pending',
        invitation_code: invitationCode 
      })
      .eq('id', subAccountId);

    // Build activation URL - ALWAYS use production domain for emails
    const PRODUCTION_DOMAIN = "https://nettobloc.bicbloc.eu";
    const activationUrl = `${PRODUCTION_DOMAIN}/activate-account?code=${encodeURIComponent(invitationCode)}`;

    // Send invitation email
    const emailResponse = await resend.emails.send({
      from: "NettBloc <support@bicbloc.eu>",
      to: [email],
      subject: `Invitation à rejoindre ${hotelName || 'NettBloc'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏨 Bienvenue sur NettBloc</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px;">Bonjour <strong>${firstName}</strong>,</p>
            
            <p>Vous avez été invité(e) à rejoindre l'équipe de <strong>${hotelName || 'votre établissement'}</strong> en tant que <strong>${roleName || 'membre de l\'équipe'}</strong>.</p>
            
            <div style="background: white; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #666;">Votre code d'activation :</p>
              <p style="font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 4px; margin: 0;">${invitationCode}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Activer mon compte
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">Ou copiez ce lien dans votre navigateur :</p>
            <p style="font-size: 12px; color: #999; word-break: break-all;">${activationUrl}</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              Cette invitation expire dans 7 jours.<br>
              Si vous n'avez pas demandé cette invitation, ignorez cet email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Invitation email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitationCode,
        invitationId: invitation.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-subaccount-invitation:", error);
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
