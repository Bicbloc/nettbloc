import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow unauthenticated access for this one-time cleanup
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // IDs des doublons à supprimer (versions anciennes)
    const duplicateIds = [
      '662391a9-85d7-48f8-a5b8-767b1bdf91b6',
      'f428da37-4cfa-4a54-86b7-3d3bf38a28b3',
      '9f1bbd66-b93a-4061-808b-555d2c3f76e7',
      '1735d480-892f-4567-8c54-b7279fd2c463',
      '0214c85b-e0c4-4dc5-af25-89e293927902',
      '7b1c640c-ca68-4065-b928-b5d2479b7aaa',
      'e028d1e4-f614-44a0-8ff5-5bb0b6c8ffaf'
    ];

    const { data, error } = await supabase
      .from("report_training_patterns")
      .delete()
      .in("id", duplicateIds)
      .select("id, pms_type");

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: data?.length || 0,
        deletedPatterns: data
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
