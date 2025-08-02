import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ActivationEmailRequest {
  email: string;
  companyName: string;
  hotelName?: string;
  activationLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, companyName, hotelName, activationLink }: ActivationEmailRequest = await req.json();

    console.log("Sending activation email to:", email);

    const emailResponse = await resend.emails.send({
      from: "NettoBloc <onboarding@resend.dev>",
      to: [email],
      subject: "Activez votre compte NettoBloc",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏨 Bienvenue sur NettoBloc</h1>
              <p>Votre plateforme de gestion hôtelière</p>
            </div>
            <div class="content">
              <h2>Bonjour !</h2>
              <p>Un compte NettoBloc a été créé pour vous :</p>
              <ul>
                <li><strong>Email :</strong> ${email}</li>
                <li><strong>Entreprise :</strong> ${companyName}</li>
                ${hotelName ? `<li><strong>Établissement :</strong> ${hotelName}</li>` : ''}
              </ul>
              
              <p>Pour activer votre compte et accéder à votre portail NettoBloc, cliquez sur le bouton ci-dessous :</p>
              
              <div style="text-align: center;">
                <a href="${activationLink}" class="button">🔐 Activer mon compte</a>
              </div>
              
              <p><strong>Ou copiez ce lien dans votre navigateur :</strong></p>
              <p style="background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace;">${activationLink}</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              
              <h3>🚀 Prochaines étapes :</h3>
              <ol>
                <li>Activez votre compte en cliquant sur le lien</li>
                <li>Configurez votre établissement</li>
                <li>Ajoutez vos équipes de ménage</li>
                <li>Commencez à gérer vos chambres efficacement</li>
              </ol>
              
              <p style="color: #666; font-style: italic;">
                💡 <strong>Conseil :</strong> NettoBloc vous permet de gérer les affectations de chambres, 
                suivre le travail de vos équipes en temps réel et générer des rapports détaillés.
              </p>
            </div>
            <div class="footer">
              <p>Cet email a été envoyé par NettoBloc</p>
              <p>Si vous n'avez pas demandé ce compte, vous pouvez ignorer cet email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-activation-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);