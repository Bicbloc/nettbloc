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
  userId?: string;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildUserMetadata = (subAccount: any, hotel: any) => ({
  is_sub_account: true,
  first_name: subAccount?.first_name ?? null,
  last_name: subAccount?.last_name ?? null,
  company_name: hotel?.name ?? null,
});

const isExistingUserError = (message?: string | null) => {
  const value = String(message ?? "").toLowerCase();
  return ["already", "exists", "registered", "duplicate", "taken"].some((token) => value.includes(token));
};

async function getAuthUserByIdWithRetry(supabase: any, userId: string, attempts = 8) {
  let lastError: any = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (!error && data?.user) {
      return data.user;
    }

    lastError = error;

    if (attempt < attempts) {
      await wait(250 * attempt);
    }
  }

  console.warn("getUserById retries exhausted", {
    userIdPrefix: userId.slice(0, 8),
    error: lastError?.message ?? null,
  });

  return null;
}

async function findAuthUserByEmail(supabase: any, email: string, retries = 3, pages = 20, perPage = 100) {
  const normalizedEmail = email.trim().toLowerCase();

  for (let retry = 1; retry <= retries; retry += 1) {
    for (let page = 1; page <= pages; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

      if (error) {
        throw error;
      }

      const users = data?.users ?? [];
      const foundUser = users.find((candidate: any) => candidate.email?.toLowerCase() === normalizedEmail);

      if (foundUser) {
        return foundUser;
      }

      if (users.length < perPage) {
        break;
      }
    }

    if (retry < retries) {
      await wait(300 * retry);
    }
  }

  return null;
}

async function updateAuthUser(supabase: any, userId: string, subAccount: any, hotel: any, password?: string) {
  const payload: Record<string, unknown> = {
    email_confirm: true,
    user_metadata: buildUserMetadata(subAccount, hotel),
  };

  if (password) {
    payload.password = password;
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, payload);

  if (error) {
    throw new Error(`Impossible de mettre à jour le compte: ${error.message}`);
  }

  return data?.user ?? { id: userId };
}

async function createOrReuseAuthUser(supabase: any, email: string, password: string, subAccount: any, hotel: any) {
  const metadata = buildUserMetadata(subAccount, hotel);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error && data?.user) {
    return data.user;
  }

  if (!isExistingUserError(error?.message)) {
    throw new Error(`Erreur création compte: ${error?.message ?? "inconnue"}`);
  }

  console.info("createUser indicates existing user, falling back to email lookup", { email });

  const existingUser = await findAuthUserByEmail(supabase, email);

  if (!existingUser) {
    throw new Error("Utilisateur introuvable. Veuillez réessayer.");
  }

  return updateAuthUser(supabase, existingUser.id, subAccount, hotel, password);
}

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

    const body: Partial<ActivateRequest> = await req.json().catch(() => ({}));
    const invitationCode = String(body.invitationCode ?? "").trim().toUpperCase();
    const providedEmail = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "").trim();
    const legacyUserId = String(body.userId ?? "").trim();

    console.info("activate-subaccount request", {
      hasInvitationCode: Boolean(invitationCode),
      hasEmail: Boolean(providedEmail),
      hasPassword: Boolean(password),
      hasUserId: Boolean(legacyUserId),
    });

    if (!invitationCode) {
      return jsonResponse({ error: "Code d'invitation requis" }, 400);
    }

    if (!legacyUserId && (!providedEmail || !password)) {
      return jsonResponse({ error: "Champs requis manquants: code, email, mot de passe" }, 400);
    }

    if (password && password.length < 6) {
      return jsonResponse({ error: "Le mot de passe doit contenir au moins 6 caractères" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: invitation, error: invitationError } = await supabase
      .from("sub_account_invitations")
      .select(
        "id, status, accepted_at, expires_at, sub_account_id, sub_accounts(id, user_id, email, first_name, last_name, hotel_id, hotels(id, name, hotel_code))",
      )
      .eq("invitation_code", invitationCode)
      .maybeSingle();

    if (invitationError || !invitation) {
      return jsonResponse({ error: "Code d'invitation invalide ou expiré" }, 404);
    }

    const subAccount = (invitation as any).sub_accounts;
    if (!subAccount?.email || !subAccount?.hotel_id) {
      return jsonResponse({ error: "Données de sous-compte incomplètes" }, 400);
    }

    const subEmail = String(subAccount.email).toLowerCase();
    if (providedEmail && providedEmail !== subEmail) {
      return jsonResponse({ error: "L'email ne correspond pas à l'invitation" }, 400);
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return jsonResponse({ error: "Cette invitation a expiré" }, 410);
    }

    const hotel = subAccount.hotels;

    if (invitation.status === "accepted" || invitation.accepted_at) {
      return jsonResponse({
        success: true,
        alreadyActivated: true,
        userId: subAccount.user_id ?? null,
        hotel: hotel ? { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } : null,
      });
    }

    let authUser: any = null;

    if (legacyUserId) {
      console.info("legacy activation flow detected", {
        userIdPrefix: legacyUserId.slice(0, 8),
        email: subEmail,
      });

      authUser = await getAuthUserByIdWithRetry(supabase, legacyUserId);

      if (!authUser) {
        console.warn("Legacy userId not found, trying email lookup instead", { email: subEmail });
        authUser = await findAuthUserByEmail(supabase, subEmail);
      }

      if (authUser) {
        authUser = await updateAuthUser(supabase, authUser.id, subAccount, hotel, password || undefined);
      } else if (password) {
        authUser = await createOrReuseAuthUser(supabase, subEmail, password, subAccount, hotel);
      } else {
        return jsonResponse({ error: "Utilisateur introuvable. Veuillez réessayer." }, 404);
      }
    } else {
      authUser = await createOrReuseAuthUser(supabase, subEmail, password, subAccount, hotel);
    }

    const resolvedUserId = String(authUser.id);
    const now = new Date().toISOString();

    const { error: subUpdateError } = await supabase
      .from("sub_accounts")
      .update({
        user_id: resolvedUserId,
        invitation_status: "active",
        is_active: true,
        updated_at: now,
      })
      .eq("id", subAccount.id);

    if (subUpdateError) {
      console.error("Failed to link sub-account:", subUpdateError);
      return jsonResponse({ error: "Erreur lors de la liaison du sous-compte" }, 500);
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: resolvedUserId,
      email: subAccount.email,
      current_hotel_id: subAccount.hotel_id,
      onboarding_completed_at: now,
      company_name: hotel?.name ?? null,
    });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
    }

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
      userId: resolvedUserId,
      hotel: hotel ? { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur inattendue";
    console.error("activate-subaccount failed:", message, error instanceof Error ? error.stack : undefined);
    return jsonResponse({ error: message }, 500);
  }
};

serve(handler);
