import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  name: string;
  role: 'housekeeper' | 'technician' | 'governess';
  hotelId: string;
  hotelName: string;
  invitedBy: string;
}

const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'housekeeper': return 'Femme de chambre';
    case 'technician': return 'Technicien';
    case 'governess': return 'Gouvernante';
    default: return role;
  }
};

const getSignupUrl = (role: string, code: string): string => {
  const baseUrl = Deno.env.get("APP_URL") || "https://nettobloc.bicbloc.eu";
  switch (role) {
    case 'housekeeper': return `${baseUrl}/housekeeper/signup?invitation=${code}`;
    case 'technician': return `${baseUrl}/technician/signup?invitation=${code}`;
    case 'governess': return `${baseUrl}/governess/signup?invitation=${code}`;
    default: return `${baseUrl}/auth?invitation=${code}`;
  }
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, role, hotelId, hotelName, invitedBy }: InvitationRequest = await req.json();

    if (!email || !name || !role || !hotelId) {
      return new Response(
        JSON.stringify({ error: "Données manquantes" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Generate unique invitation code
    const invitationCode = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Save invitation to database
    const { data: invitation, error: dbError } = await supabase
      .from('staff_invitations')
      .insert({
        hotel_id: hotelId,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role,
        invitation_code: invitationCode,
        invited_by: invitedBy,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la création de l'invitation" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const signupUrl = getSignupUrl(role, invitationCode);
    const roleLabel = getRoleLabel(role);

    // Send invitation email
    // NOTE: Until you verify your domain at resend.com/domains, 
    // you can only send to your own email address (testing mode)
    const { error: emailError } = await resend.emails.send({
      from: "NettooBloc <onboarding@resend.dev>",  // Change to your-domain after verification
      to: [email],
      subject: `Invitation à rejoindre ${hotelName} - NettooBloc`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #18181b; margin: 0; font-size: 28px;">🏨 NettooBloc</h1>
              </div>
              
              <h2 style="color: #18181b; margin-bottom: 20px; font-size: 22px;">Bonjour ${name} !</h2>
              
              <p style="color: #52525b; line-height: 1.6; font-size: 16px;">
                Vous avez été invité(e) à rejoindre <strong>${hotelName}</strong> en tant que <strong>${roleLabel}</strong>.
              </p>
              
              <p style="color: #52525b; line-height: 1.6; font-size: 16px;">
                Cliquez sur le bouton ci-dessous pour créer votre compte et commencer à travailler avec votre équipe.
              </p>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Créer mon compte
                </a>
              </div>
              
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-top: 30px;">
                <p style="color: #71717a; font-size: 14px; margin: 0;">
                  <strong>Code d'invitation :</strong> ${invitationCode}
                </p>
                <p style="color: #a1a1aa; font-size: 12px; margin-top: 10px;">
                  Cette invitation expire dans 7 jours.
                </p>
              </div>
              
              <p style="color: #a1a1aa; font-size: 12px; margin-top: 30px; text-align: center;">
                Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Email error:", emailError);
      // Update status to indicate email failed
      await supabase
        .from('staff_invitations')
        .update({ status: 'pending' })
        .eq('id', invitation.id);

      return new Response(
        JSON.stringify({ error: "Erreur lors de l'envoi de l'email", details: emailError }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update invitation status to sent
    await supabase
      .from('staff_invitations')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invitation.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation envoyée avec succès",
        invitationCode 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
