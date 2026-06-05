import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest, unauthorizedResponse } from "../_shared/cronAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Privileged scheduled function: only callable by the scheduler/service role.
  if (!isAuthorizedCronRequest(req)) {
    return unauthorizedResponse(corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🗂️ Starting daily archiving process...');

    // 1. Archive old notifications (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: oldNotifications, error: notifError } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString());

    if (notifError) {
      console.error('❌ Error archiving notifications:', notifError);
    } else {
      console.log('✅ Archived old notifications');
    }

    // 2. Archive old daily reports (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: oldReports, error: reportsError } = await supabase
      .from('daily_reports')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (reportsError) {
      console.error('❌ Error archiving reports:', reportsError);
    } else {
      console.log('✅ Archived old daily reports');
    }

    // 3. Clean up inactive hotel sessions (older than 24 hours)
    const { error: cleanupError } = await supabase.rpc('cleanup_expired_hotel_sessions');
    
    if (cleanupError) {
      console.error('❌ Error cleaning up sessions:', cleanupError);
    } else {
      console.log('✅ Cleaned up expired hotel sessions');
    }

    // 4. Clean up inactive user sessions
    const { error: userSessionError } = await supabase.rpc('cleanup_inactive_sessions');
    
    if (userSessionError) {
      console.error('❌ Error cleaning up user sessions:', userSessionError);
    } else {
      console.log('✅ Cleaned up inactive user sessions');
    }

    // 5. Clean up old room status updates (older than 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { error: roomStatusError } = await supabase
      .from('room_status_updates')
      .delete()
      .lt('created_at', fourteenDaysAgo.toISOString());

    if (roomStatusError) {
      console.error('❌ Error cleaning room status updates:', roomStatusError);
    } else {
      console.log('✅ Cleaned up old room status updates');
    }

    const result = {
      success: true,
      archived_at: new Date().toISOString(),
      operations: [
        'notifications_cleanup',
        'reports_cleanup', 
        'hotel_sessions_cleanup',
        'user_sessions_cleanup',
        'room_status_cleanup'
      ]
    };

    console.log('🎉 Daily archiving completed successfully');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Critical error in archive-daily-data:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});