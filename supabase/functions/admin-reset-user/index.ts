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

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve hotels owned by the user
    const { data: userHotels, error: userHotelsError } = await adminClient
      .from("hotels")
      .select("id")
      .eq("user_id", userId);

    if (userHotelsError) {
      return new Response(JSON.stringify({ error: "Impossible de récupérer les hôtels liés" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hotelIds = userHotels?.map((h) => h.id) ?? [];
    const clearedFrom: string[] = [];

    if (hotelIds.length > 0) {
      // Operational data linked to the hotels — cleared but account & hotels kept
      const hotelDependentTables = [
        "assignments",
        "rooms",
        "hotel_rooms_registry",
        "pms_pending_rooms",
        "pms_sync_queue",
        "pms_sync_logs",
        "pms_occupancy_forecast",
        "daily_action_logs",
        "daily_reports",
        "daily_governess_assignments",
        "daily_instructions",
        "archived_daily_logs",
        "activities",
        "notifications",
        "manual_tasks",
        "incidents",
        "lost_and_found",
        "linen_inventory_entries",
        "linen_inventory_tasks",
        "linen_deliveries",
        "room_inspections",
        "room_status_updates",
        "breakfast_logs",
      ] as const;

      for (const table of hotelDependentTables) {
        const { data, error } = await adminClient
          .from(table)
          .delete()
          .in("hotel_id", hotelIds)
          .select("id");

        if (error) {
          console.error(`Reset error in ${table}:`, error);
          continue;
        }

        if (data?.length) {
          clearedFrom.push(`${table} (${data.length})`);
        }
      }
    }

    await adminClient.from("admin_audit_log").insert({
      admin_user_id: callerUserId,
      action: "reset_user_data",
      target_user_id: userId,
      details: { cleared_from: clearedFrom },
    });

    return new Response(JSON.stringify({ success: true, cleared_from: clearedFrom }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in admin-reset-user:", error);
    return new Response(JSON.stringify({ error: error?.message || "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
