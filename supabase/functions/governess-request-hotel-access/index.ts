import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelCode, governessProfileId } = await req.json();

    if (!hotelCode || !governessProfileId) {
      return new Response(
        JSON.stringify({ error: 'hotelCode et governessProfileId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Client avec service role pour bypasser RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const cleanCode = hotelCode.toUpperCase().trim();
    console.log(`🔍 Recherche hôtel avec code: ${cleanCode}`);

    // Rechercher l'hôtel (bypass RLS)
    const { data: hotel, error: hotelError } = await supabaseAdmin
      .from('hotels')
      .select('id, name, hotel_code')
      .eq('hotel_code', cleanCode)
      .maybeSingle();

    if (hotelError) {
      console.error('Erreur recherche hôtel:', hotelError);
      return new Response(
        JSON.stringify({ error: 'Erreur recherche hôtel', details: hotelError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!hotel) {
      console.log(`❌ Hôtel non trouvé: ${cleanCode}`);
      return new Response(
        JSON.stringify({ error: 'hotel_not_found', code: cleanCode }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Hôtel trouvé: ${hotel.name} (${hotel.id})`);

    // Vérifier si session existe déjà
    const { data: existingSession } = await supabaseAdmin
      .from('governess_hotel_sessions')
      .select('id')
      .eq('governess_profile_id', governessProfileId)
      .eq('hotel_id', hotel.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existingSession) {
      console.log(`ℹ️ Session déjà active pour gouvernante ${governessProfileId}`);
      return new Response(
        JSON.stringify({ 
          status: 'already_has_access', 
          hotel: { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Créer la session
    const { error: insertError } = await supabaseAdmin
      .from('governess_hotel_sessions')
      .insert({
        governess_profile_id: governessProfileId,
        hotel_id: hotel.id,
        hotel_name: hotel.name,
        is_active: true,
        started_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Erreur création session:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur création session', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Session créée pour gouvernante ${governessProfileId} → hôtel ${hotel.name}`);

    return new Response(
      JSON.stringify({ 
        status: 'added', 
        hotel: { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erreur inattendue:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
