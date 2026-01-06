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

    // Vérifier si session existe déjà (accès déjà accordé)
    const { data: existingSession } = await supabaseAdmin
      .from('governess_hotel_sessions')
      .select('id')
      .eq('governess_profile_id', governessProfileId)
      .eq('hotel_id', hotel.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existingSession) {
      console.log(`ℹ️ Accès déjà accordé pour gouvernante ${governessProfileId}`);
      return new Response(
        JSON.stringify({ 
          status: 'already_has_access', 
          hotel: { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier si une demande existe déjà
    const { data: existingRequest } = await supabaseAdmin
      .from('governess_access_requests')
      .select('id, status')
      .eq('governess_profile_id', governessProfileId)
      .eq('hotel_id', hotel.id)
      .maybeSingle();

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        console.log(`ℹ️ Demande déjà en attente pour gouvernante ${governessProfileId}`);
        return new Response(
          JSON.stringify({ 
            status: 'request_pending', 
            hotel: { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (existingRequest.status === 'rejected') {
        // Permettre de refaire une demande si rejetée précédemment
        const { error: updateError } = await supabaseAdmin
          .from('governess_access_requests')
          .update({
            status: 'pending',
            requested_at: new Date().toISOString(),
            reviewed_at: null,
            reviewed_by: null,
            rejection_reason: null
          })
          .eq('id', existingRequest.id);

        if (updateError) {
          console.error('Erreur mise à jour demande:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erreur mise à jour demande', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`✅ Demande renouvelée pour gouvernante ${governessProfileId} → hôtel ${hotel.name}`);
        return new Response(
          JSON.stringify({ 
            status: 'request_submitted', 
            hotel: { id: hotel.id, name: hotel.name, hotel_code: hotel.hotel_code } 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Créer une nouvelle demande d'accès (pas d'accès direct)
    const { error: insertError } = await supabaseAdmin
      .from('governess_access_requests')
      .insert({
        governess_profile_id: governessProfileId,
        hotel_id: hotel.id,
        hotel_code: cleanCode,
        status: 'pending',
        requested_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Erreur création demande:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur création demande', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Demande d'accès créée pour gouvernante ${governessProfileId} → hôtel ${hotel.name}`);

    return new Response(
      JSON.stringify({ 
        status: 'request_submitted', 
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
