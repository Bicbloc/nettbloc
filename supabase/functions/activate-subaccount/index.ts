import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActivateSubAccountRequest {
  invitationCode: string;
  userId: string;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getAuthUserWithRetry(supabase: ReturnType<typeof createClient>, userId: string, attempts = 5) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (!error && data?.user) {
      return data.user;
    }

    lastError = error ?? new Error("Unable to load auth user");

    if (attempt < attempts) {
      await wait(250 * attempt);
    }
  }

  throw lastError ?? new Error("Unable to load auth user");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing env vars:", { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey });
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const body: Partial<ActivateSubAccountRequest> = await req.json();
    const invitationCode = String(body.invitationCode ?? "").trim().toUpperCase();
    const userId = String(body.userId ?? "").trim();

    if (!invitationCode || !userId) {
      return jsonResponse({ error: "Missing required fields: invitationCode, userId" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: invitation, error: invitationError } = await supabase
      .from("sub_account_invitations")
      .select(
        "id, status, accepted_at, expires_at, sub_account_id, sub_accounts(id, user_id, email, first_name, last_name, hotel_id, hotels(id, name, hotel_code))",
      )
      .eq("invitation_code", invitationCode)
      .single();

    if (invitationError || !invitation) {
      return jsonResponse({ error: "Invalid or expired invitation code" }, 404);
    }

    const subAccount = (invitation as any).sub_accounts;
    if (!subAccount?.email || !subAccount?.hotel_id) {
      return jsonResponse({ error: "Invitation is missing sub-account or hotel information" }, 400);
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return jsonResponse({ error: "This invitation has expired" }, 410);
    }

    const hotel = subAccount.hotels;
    const authUser = await getAuthUserWithRetry(supabase, userId);

    const authEmail = authUser.email?.toLowerCase();
    const invitedEmail = String(subAccount.email).toLowerCase();
    if (!authEmail || authEmail !== invitedEmail) {
      return jsonResponse({ error: "Auth user email does not match invitation email" }, 400);
    }

    if (invitation.status === "accepted" || invitation.accepted_at) {
      if (subAccount.user_id === userId) {
        return jsonResponse({
          success: true,
          alreadyActivated: true,
          hotel: hotel ? { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } : null,
        });
      }

      return jsonResponse({ error: "This invitation has already been accepted" }, 409);
    }

    const { error: metadataError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(authUser.user_metadata ?? {}),
        is_sub_account: true,
        first_name: subAccount.first_name ?? null,
        last_name: subAccount.last_name ?? null,
        company_name: hotel?.name ?? null,
      },
    });

    if (metadataError) {
      throw new Error(`Failed to update user metadata: ${metadataError.message}`);
    }

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
      throw new Error(`Failed to link sub-account: ${subUpdateError.message}`);
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      email: subAccount.email,
      current_hotel_id: subAccount.hotel_id,
      onboarding_completed_at: now,
      company_name: hotel?.name ?? null,
    });

    if (profileError) {
      throw new Error(`Failed to create profile: ${profileError.message}`);
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
      throw new Error(`Failed to update invitation: ${invitationUpdateError.message}`);
    }

    return jsonResponse({
      success: true,
      hotel: hotel ? { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    console.error("activate-subaccount failed:", message, error instanceof Error ? error.stack : undefined);
    return jsonResponse({ error: message }, 500);
  }
};

serve(handler);
