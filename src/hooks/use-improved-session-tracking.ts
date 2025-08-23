import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useImprovedSessionTracking() {
  useEffect(() => {
    let sessionId: string | null = null;
    let activityInterval: NodeJS.Timeout | null = null;

    const createOrUpdateSession = async (user: any) => {
      try {
        console.log('🔄 Creating/updating session for user:', user.id);
        
        // Try to find existing active session
        const { data: existingSession, error: findError } = await supabase
          .from('user_sessions')
          .select('id, session_token')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(); // Use maybeSingle instead of single

        if (findError && findError.code !== 'PGRST116') {
          console.error('Error finding session:', findError);
          return;
        }

        if (existingSession) {
          console.log('✅ Existing session found, updating activity');
          sessionId = existingSession.id;
          
          // Update last activity
          await supabase
            .from('user_sessions')
            .update({ 
              last_activity: new Date().toISOString(),
              login_time: new Date().toISOString() // Refresh login time too
            })
            .eq('id', sessionId);
        } else {
          console.log('➕ Creating new session');
          
          // Get user profile data for better session tracking
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name')
            .eq('id', user.id)
            .maybeSingle();

          const { data: newSession, error: createError } = await supabase
            .from('user_sessions')
            .insert({
              user_id: user.id,
              user_name: profile?.company_name || user.email || 'Utilisateur',
              user_type: 'admin', // Default for authenticated users
              session_token: generateSessionToken(),
              is_active: true,
              login_time: new Date().toISOString(),
              last_activity: new Date().toISOString()
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Error creating session:', createError);
            return;
          }

          sessionId = newSession.id;
          console.log('✅ New session created:', sessionId);
        }

        startActivityTracking();
      } catch (error) {
        console.error('💥 Error in session management:', error);
      }
    };

    const endSession = async () => {
      if (sessionId) {
        try {
          console.log('🛑 Ending session:', sessionId);
          await supabase
            .from('user_sessions')
            .update({ 
              is_active: false,
              last_activity: new Date().toISOString()
            })
            .eq('id', sessionId);
        } catch (error) {
          console.error('Error ending session:', error);
        }
      }
      stopActivityTracking();
    };

    const startActivityTracking = () => {
      // Clear any existing interval
      if (activityInterval) {
        clearInterval(activityInterval);
      }

      // Update activity every 2 minutes (more frequent for better tracking)
      activityInterval = setInterval(async () => {
        if (sessionId) {
          try {
            await supabase
              .from('user_sessions')
              .update({ last_activity: new Date().toISOString() })
              .eq('id', sessionId);
          } catch (error) {
            console.error('Error updating activity:', error);
          }
        }
      }, 120000); // 2 minutes
    };

    const stopActivityTracking = () => {
      if (activityInterval) {
        clearInterval(activityInterval);
        activityInterval = null;
      }
    };

    const generateSessionToken = (): string => {
      return Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15);
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state change:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user) {
          await createOrUpdateSession(session.user);
        } else if (event === 'SIGNED_OUT') {
          await endSession();
        }
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        createOrUpdateSession(session.user);
      }
    });

    // Handle page visibility changes for better session tracking
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionId) {
        // Page became visible, update activity immediately
        supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', sessionId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle page unload with better cleanup
    const handleBeforeUnload = () => {
      // Use synchronous approach for immediate session end
      if (sessionId) {
        const currentTime = new Date().toISOString();
        // Try to send final update
        navigator.sendBeacon('/api/end-session', JSON.stringify({
          sessionId,
          endTime: currentTime
        }));
        
        // Also try direct update as fallback
        endSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      stopActivityTracking();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, []);
}