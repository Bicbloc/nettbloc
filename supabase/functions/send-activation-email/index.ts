import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function logEmail(entry: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("email_logs").insert(entry);
  } catch (e) {
    console.error("Failed to log email:", e);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      companyName, 
      hotelName, 
      activationLink, 
      type = 'activation',
      extensionDays,
      newStatus,
      reason 
    } = await req.json();

    console.log('📧 Sending email:', { email, type, companyName });

    let emailContent = '';
    let subject = '';

    switch (type) {
      case 'activation':
        subject = `🎉 Bienvenue chez Nettobloc - Activez votre compte`;
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Bienvenue chez Nettobloc !</h1>
            <p>Bonjour,</p>
            <p>Votre compte a été créé avec succès${hotelName ? ` pour l'établissement <strong>${hotelName}</strong>` : ` pour <strong>${companyName || 'votre établissement'}</strong>`}.</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">📋 Prochaines étapes :</h3>
              <ol style="color: #4b5563;">
                <li><strong>Cliquez sur le lien ci-dessous</strong> pour finaliser l'activation de votre compte</li>
                <li><strong>Définissez votre mot de passe</strong> lors de la première connexion</li>
                <li><strong>Configurez votre établissement</strong> selon vos besoins</li>
                <li><strong>Commencez à utiliser</strong> toutes nos fonctionnalités</li>
              </ol>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationLink}" 
                 style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                🚀 Activer mon compte
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
              <a href="${activationLink}" style="color: #2563eb;">${activationLink}</a>
            </p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">
              Ce lien d'activation expirera dans 24 heures pour des raisons de sécurité.<br>
              Si vous n'avez pas demandé cette activation, vous pouvez ignorer cet email.
            </p>
            
            <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 6px;">
              <p style="margin: 0; color: #475569; font-size: 14px;">
                <strong>Équipe Nettobloc</strong><br>
                Votre solution de gestion hôtelière intelligente
              </p>
            </div>
          </div>
        `;
        break;

      case 'trial_extension':
        subject = `🎁 Votre période d'essai a été étendue de ${extensionDays} jours`;
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #059669;">🎉 Bonne nouvelle !</h1>
            <p>Bonjour,</p>
            <p>Nous avons le plaisir de vous informer que votre période d'essai Nettobloc a été étendue de <strong>${extensionDays} jours</strong> !</p>
            
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
              <h3 style="margin-top: 0; color: #065f46;">🎁 Extension accordée</h3>
              <p style="margin: 0; color: #047857;">
                <strong>+${extensionDays} jours</strong> ajoutés à votre période d'essai
                ${reason ? `<br><em>Raison : ${reason}</em>` : ''}
              </p>
            </div>

            <p>Profitez de cette période supplémentaire pour :</p>
            <ul style="color: #374151;">
              <li>Explorer toutes nos fonctionnalités avancées</li>
              <li>Tester notre système avec vos équipes</li>
              <li>Voir l'impact sur l'efficacité de votre établissement</li>
              <li>Nous faire part de vos retours</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://nettobloc.bicbloc.eu" 
                 style="background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                🚀 Continuer l'essai
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              Merci de nous faire confiance !<br>
              L'équipe Nettobloc
            </p>
          </div>
        `;
        break;

      case 'status_change':
        const statusLabels: Record<string, string> = {
          'free': 'Gratuit',
          'trial': 'Période d\'essai',
          'premium': 'Premium'
        };
        
        subject = `📊 Votre statut d'abonnement a été modifié`;
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Modification de votre abonnement</h1>
            <p>Bonjour,</p>
            <p>Votre statut d'abonnement Nettobloc a été modifié.</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">📊 Nouveau statut</h3>
              <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: bold;">
                ${statusLabels[newStatus] || newStatus}
                ${reason ? `<br><small style="font-weight: normal; color: #6b7280;"><em>Raison : ${reason}</em></small>` : ''}
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://nettobloc.bicbloc.eu" 
                 style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                🔗 Accéder à mon compte
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              Pour toute question, n'hésitez pas à nous contacter.<br>
              L'équipe Nettobloc
            </p>
          </div>
        `;
        break;

      default:
        throw new Error(`Type d'email non reconnu : ${type}`);
    }

    const emailResponse = await resend.emails.send({
      from: "Nettobloc <support@bicbloc.eu>",
      to: [email],
      subject,
      html: emailContent,
    });

    console.log('✅ Email sent successfully:', emailResponse);

    await logEmail({
      email_type: type,
      recipient_email: email,
      subject,
      status: emailResponse?.error ? 'failed' : 'sent',
      provider_message_id: emailResponse?.data?.id ?? null,
      error_message: emailResponse?.error ? JSON.stringify(emailResponse.error) : null,
      metadata: { companyName, hotelName },
    });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('❌ Error in send-activation-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});