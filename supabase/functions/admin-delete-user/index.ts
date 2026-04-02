import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Configuration serveur manquante" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Claims error:", claimsError);
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerUserId = claimsData.claims.sub;

    const { data: callerRoles, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId);

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(JSON.stringify({ error: "Impossible de vérifier les permissions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = callerRoles?.some((item) => item.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Accès réservé aux super admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userId = typeof body?.userId === "string" ? body.userId : null;
    const email = typeof body?.email === "string" ? body.email.toLowerCase() : null;

    if (!userId && !email) {
      return new Response(JSON.stringify({ error: "userId ou email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetUserId = userId;
    let targetEmail = email;

    if (!targetUserId && targetEmail) {
      const { data: listUsersData, error: listUsersError } = await adminClient.auth.admin.listUsers();
      if (listUsersError) {
        console.error("List users error:", listUsersError);
        return new Response(JSON.stringify({ error: "Impossible de résoudre l'utilisateur" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const foundUser = listUsersData.users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);
      if (foundUser) {
        targetUserId = foundUser.id;
      }
    }

    if (targetUserId && !targetEmail) {
      const { data: targetUserData, error: targetUserError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (!targetUserError) {
        targetEmail = targetUserData.user?.email?.toLowerCase() ?? null;
      }
    }

    const deletedFrom: string[] = [];

    if (targetEmail) {
      const emailTables = [
        "housekeeper_profiles",
        "governess_profiles",
        "technician_profiles",
        "sub_accounts",
      ] as const;

      for (const table of emailTables) {
        const { data, error } = await adminClient
          .from(table)
          .delete()
          .ilike("email", targetEmail)
          .select("id");

        if (error) {
          console.error(`Delete error in ${table}:`, error);
          return new Response(JSON.stringify({ error: `Erreur suppression ${table}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (data?.length) {
          deletedFrom.push(`${table} (${data.length})`);
        }
      }
    }

    if (targetUserId) {
      const { data: userHotels, error: userHotelsError } = await adminClient
        .from("hotels")
        .select("id")
        .eq("user_id", targetUserId);

      if (userHotelsError) {
        console.error("User hotels lookup error:", userHotelsError);
        return new Response(JSON.stringify({ error: "Impossible de récupérer les hôtels liés" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hotelIds = userHotels?.map((h) => h.id) ?? [];

      if (hotelIds.length > 0) {
        const hotelDependentTables = [
          "housekeeper_access_codes",
          "housekeeper_invitations",
          "hotel_access_sessions",
          "housekeeper_access_requests",
          "assignments",
          "housekeepers",
          "rooms",
          "daily_action_logs",
          "daily_instructions",
          "daily_reports",
          "daily_governess_assignments",
          "hotel_rooms_registry",
          "hotel_cleaning_rules",
          "hotel_combination_rules",
          "hotel_detection_rules",
          "hotel_report_configs",
          "hotel_pms_configs",
          "connected_room_rules",
          "floor_plan_layouts",
          "activities",
          "notifications",
          "incidents",
          "incident_categories",
          "staff_roles",
          "manual_tasks",
          "linen_inventory",
          "lost_and_found_items",
          "archived_daily_logs",
          "governess_access_requests",
          "governess_hotel_sessions",
          "technician_access_requests",
          "housekeeper_achievements",
          "housekeeper_levels",
          "sub_accounts",
          "phone_orders",
        ] as const;

        for (const table of hotelDependentTables) {
          const { data, error } = await adminClient
            .from(table)
            .delete()
            .in("hotel_id", hotelIds)
            .select("id");

          if (error) {
            console.error(`Delete error in ${table}:`, error);
            continue;
          }

          if (data?.length) {
            deletedFrom.push(`${table} (${data.length})`);
          }
        }
      }

      const userReferenceTables = [
        { table: "user_sessions", column: "user_id" },
        { table: "notifications", column: "user_id" },
        { table: "password_reset_logs", column: "user_id" },
        { table: "promo_code_uses", column: "user_id" },
        { table: "phone_orders", column: "user_id" },
        { table: "housekeepers", column: "user_id" },
        { table: "sub_accounts", column: "user_id" },
        { table: "sub_accounts", column: "parent_user_id" },
        { table: "sub_accounts", column: "created_by" },
        { table: "hotel_sessions", column: "user_id" },
        { table: "hotel_users", column: "user_id" },
        { table: "hotels", column: "user_id" },
        { table: "profiles", column: "id" },
        { table: "user_roles", column: "user_id" },
      ] as const;

      for (const { table, column } of userReferenceTables) {
        const { data, error } = await adminClient
          .from(table)
          .delete()
          .eq(column, targetUserId)
          .select("id");

        if (error) {
          console.error(`Delete error in ${table}.${column}:`, error);
          return new Response(JSON.stringify({ error: `Erreur suppression ${table}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (data?.length) {
          deletedFrom.push(`${table}.${column} (${data.length})`);
        }
      }

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (deleteAuthError) {
        console.error("Auth delete error:", deleteAuthError);

        const { error: softDeleteError } = await adminClient.auth.admin.deleteUser(targetUserId, true);
        if (softDeleteError) {
          console.error("Auth soft delete error:", softDeleteError);
          return new Response(JSON.stringify({ error: softDeleteError.message || deleteAuthError.message || "Erreur suppression auth.users" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        deletedFrom.push("auth.users (soft deleted)");
      } else {
        deletedFrom.push("auth.users");
      }
    }

    const { error: auditError } = await adminClient.from("admin_audit_log").insert({
      admin_user_id: callerUserId,
      action: "complete_user_deletion",
      target_user_id: targetUserId,
      details: { email: targetEmail, deleted_from: deletedFrom },
    });

    if (auditError) {
      console.error("Audit log error:", auditError);
    }

    return new Response(JSON.stringify({ success: true, deleted_from: deletedFrom }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in admin-delete-user:", error);
    return new Response(JSON.stringify({ error: error?.message || "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
