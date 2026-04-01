import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActivateRequest {
  invitationCode: string;
  email?: string;
  password?: string;
  userId?: string; // legacy field from old client
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const body: Partial<ActivateRequest> = await req.json();
    const invitationCode = String(body.invitationCode ?? "").trim().toUpperCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "").trim();
    const legacyUserId = String(body.userId ?? "").trim();

    // Support both new flow (email+password) and legacy flow (userId)
    const isNewFlow = !!(email && password);
    const isLegacyFlow = !!legacyUserId;

    if (!invitationCode || (!isNewFlow && !isLegacyFlow)) {
      return jsonResponse({ error: "Champs requis manquants: code + (email & mot de passe) ou userId" }, 400);
    }

    if (isNewFlow && password.length < 6) {
      return jsonResponse({ error: "Le mot de passe doit contenir au moins 6 caractères" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("sub_account_invitations")
      .select(
        "id, status, accepted_at, expires_at, sub_account_id, sub_accounts(id, user_id, email, first_name, last_name, hotel_id, hotels(id, name, hotel_code))",
      )
      .eq("invitation_code", invitationCode)
      .single();

    if (invitationError || !invitation) {
      return jsonResponse({ error: "Code d'invitation invalide ou expiré" }, 404);
    }

    const subAccount = (invitation as any).sub_accounts;
    if (!subAccount?.email || !subAccount?.hotel_id) {
      return jsonResponse({ error: "Données de sous-compte incomplètes" }, 400);
    }

    // Verify email matches
    if (email !== String(subAccount.email).toLowerCase()) {
      return jsonResponse({ error: "L'email ne correspond pas à l'invitation" }, 400);
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return jsonResponse({ error: "Cette invitation a expiré" }, 410);
    }

    const hotel = subAccount.hotels;

    // Already accepted?
    if (invitation.status === "accepted" || invitation.accepted_at) {
      return jsonResponse({
        success: true,
        alreadyActivated: true,
        hotel: hotel ? { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } : null,
      });
    }

    // 2. Create or find auth user via admin API
    let userId: string;

    // Try to find existing user by email
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1 });
    // listUsers doesn't filter by email, so we use a different approach
    
    // Try creating the user first
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since they have the invitation code
      user_metadata: {
        is_sub_account: true,
        first_name: subAccount.first_name ?? null,
        last_name: subAccount.last_name ?? null,
        company_name: hotel?.name ?? null,
      },
    });

    if (createError) {
      const msg = createError.message.toLowerCase();
      // User already exists - try to update their password and get their ID
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered") || msg.includes("duplicate")) {
        console.log("User already exists, looking up by email...");
        
        // Use signInWithPassword won't work without knowing old password
        // Use admin listUsers to find by email
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
          perPage: 50,
          page: 1,
        });

        if (listError) {
          console.error("Failed to list users:", listError);
          return jsonResponse({ error: "Impossible de trouver l'utilisateur existant" }, 500);
        }

        const existingUser = listData?.users?.find(
          (u: any) => u.email?.toLowerCase() === email
        );

        if (!existingUser) {
          return jsonResponse({ error: "Utilisateur introuvable. Contactez l'administrateur." }, 404);
        }

        userId = existingUser.id;

        // Update password and metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: {
            ...(existingUser.user_metadata ?? {}),
            is_sub_account: true,
            first_name: subAccount.first_name ?? null,
            last_name: subAccount.last_name ?? null,
            company_name: hotel?.name ?? null,
          },
        });

        if (updateError) {
          console.error("Failed to update existing user:", updateError);
          return jsonResponse({ error: "Impossible de mettre à jour le compte" }, 500);
        }
      } else {
        console.error("Failed to create user:", createError);
        return jsonResponse({ error: `Erreur création compte: ${createError.message}` }, 500);
      }
    } else {
      userId = createData.user.id;
    }

    console.log("User ready, userId:", userId);

    // 3. Link sub-account
    const now = new Date().toISOString();

    const { error: subUpdateError } = await supabase
      .from("sub_accounts")
      .update({
        user_id: userId,
        invitation_status: "active",
        is_active: true,
        updated_at: now,
      })
      .eq("id", subAccount.id);

    if (subUpdateError) {
      console.error("Failed to link sub-account:", subUpdateError);
      return jsonResponse({ error: "Erreur lors de la liaison du sous-compte" }, 500);
    }

    // 4. Create profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      email: subAccount.email,
      current_hotel_id: subAccount.hotel_id,
      onboarding_completed_at: now,
      company_name: hotel?.name ?? null,
    });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
      // Non-blocking - continue
    }

    // 5. Mark invitation as accepted
    const { error: invitationUpdateError } = await supabase
      .from("sub_account_invitations")
      .update({
        status: "accepted",
        accepted_at: now,
        updated_at: now,
      })
      .eq("id", invitation.id);

    if (invitationUpdateError) {
      console.error("Failed to update invitation:", invitationUpdateError);
    }

    return jsonResponse({
      success: true,
      userId,
      hotel: hotel ? { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur inattendue";
    console.error("activate-subaccount failed:", message);
    return jsonResponse({ error: message }, 500);
  }
};

serve(handler);
