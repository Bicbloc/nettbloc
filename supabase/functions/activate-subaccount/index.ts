import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ActivateSubAccountRequest {
  invitationCode: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invitationCode, userId }: ActivateSubAccountRequest = await req.json();
    if (!invitationCode || !userId) {
      throw new Error("Missing required fields: invitationCode, userId");
    }

    // Load invitation + sub-account + hotel
    const { data: invitation, error: invitationError } = await supabase
      .from("sub_account_invitations")
      .select(
        "id, status, accepted_at, expires_at, sub_account_id, sub_accounts(id, email, first_name, last_name, hotel_id, hotels(id, name, hotel_code))",
      )
      .eq("invitation_code", invitationCode)
      .single();

    if (invitationError || !invitation) {
      throw new Error("Invalid or expired invitation code");
    }

    if (invitation.status === "accepted" || invitation.accepted_at) {
      throw new Error("This invitation has already been accepted");
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      throw new Error("This invitation has expired");
    }

    const subAccount = (invitation as any).sub_accounts;
    if (!subAccount?.email || !subAccount?.hotel_id) {
      throw new Error("Invitation is missing sub-account or hotel information");
    }

    const hotel = subAccount.hotels;

    // Security check: ensure userId corresponds to the invited email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      throw new Error("Unable to load auth user");
    }

    const authEmail = userData.user.email?.toLowerCase();
    const invitedEmail = String(subAccount.email).toLowerCase();
    if (!authEmail || authEmail !== invitedEmail) {
      throw new Error("Auth user email does not match invitation email");
    }

    // Ensure metadata is set to mark this user as a sub-account.
    // NOTE: never log any sensitive fields.
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(userData.user.user_metadata ?? {}),
        is_sub_account: true,
        first_name: subAccount.first_name ?? null,
        last_name: subAccount.last_name ?? null,
        company_name: hotel?.name ?? null,
      },
    });

    // Link the sub-account row to this auth user
    const { error: subUpdateError } = await supabase
      .from("sub_accounts")
      .update({
        user_id: userId,
        invitation_status: "active",
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subAccount.id);

    if (subUpdateError) {
      throw new Error(`Failed to link sub-account: ${subUpdateError.message}`);
    }

    // Create/update profile linked to parent hotel
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email: subAccount.email,
        current_hotel_id: subAccount.hotel_id,
        onboarding_completed_at: new Date().toISOString(),
        company_name: hotel?.name ?? null,
      });

    if (profileError) {
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    // Mark invitation as accepted
    const { error: invitationUpdateError } = await supabase
      .from("sub_account_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (invitationUpdateError) {
      throw new Error(`Failed to update invitation: ${invitationUpdateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        hotel: hotel
          ? { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code }
          : null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
