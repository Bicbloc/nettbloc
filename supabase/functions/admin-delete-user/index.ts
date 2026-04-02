import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Accès réservé aux super admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, email } = await req.json();
    if (!userId && !email) {
      return new Response(JSON.stringify({ error: "userId ou email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve email to userId if needed
    let targetUserId = userId;
    let targetEmail = email;

    if (!targetUserId && targetEmail) {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const found = users?.find((u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase());
      if (found) {
        targetUserId = found.id;
      }
    }

    if (targetUserId && !targetEmail) {
      const { data: { user: targetUser } } = await supabase.auth.admin.getUserById(targetUserId);
      targetEmail = targetUser?.email;
    }

    const deletedFrom: string[] = [];
    const normalizedEmail = targetEmail?.toLowerCase();

    // 1. Delete from all profile/data tables using email
    if (normalizedEmail) {
      const emailTables = [
        { table: "housekeeper_profiles", column: "email" },
        { table: "governess_profiles", column: "email" },
        { table: "technician_profiles", column: "email" },
        { table: "sub_accounts", column: "email" },
      ];

      for (const { table, column } of emailTables) {
        const { data, error } = await supabase
          .from(table)
          .delete()
          .ilike(column, normalizedEmail)
          .select("id");

        if (!error && data && data.length > 0) {
          deletedFrom.push(`${table} (${data.length})`);
        }
      }
    }

    // 2. Delete from tables using user_id
    if (targetUserId) {
      const userIdTables = [
        { table: "hotels", column: "user_id" },
        { table: "profiles", column: "id" },
        { table: "hotel_users", column: "user_id" },
        { table: "hotel_sessions", column: "user_id" },
      ];

      for (const { table, column } of userIdTables) {
        const { data, error } = await supabase
          .from(table)
          .delete()
          .eq(column, targetUserId)
          .select("id");

        if (!error && data && data.length > 0) {
          deletedFrom.push(`${table} (${data.length})`);
        }
      }

      // 3. Delete auth user
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(targetUserId);
      if (!deleteAuthError) {
        deletedFrom.push("auth.users");
      } else {
        console.error("Error deleting auth user:", deleteAuthError);
      }
    }

    // Log the action
    await supabase.from("admin_audit_log").insert({
      admin_user_id: callerUser.id,
      action: "complete_user_deletion",
      target_user_id: targetUserId || null,
      details: {
        email: normalizedEmail,
        deleted_from: deletedFrom,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Utilisateur supprimé complètement`,
        deleted_from: deletedFrom,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in admin-delete-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
