import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSessionTracking() {
  useEffect(() => {
    let sessionId: string | null = null;

    const createSession = async (user: any) => {
      try {
        // First check if user already has an active session
        const { data: existingSession } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (existingSession) {
          sessionId = existingSession.id;
          // Update last activity
          await supabase
            .from('user_sessions')
            .update({ last_activity: new Date().toISOString() })
            .eq('id', sessionId);
          return;
        }

        // Create new session
        const { data, error } = await supabase
          .from('user_sessions')
          .insert({
            user_id: user.id,
            hotel_id: localStorage.getItem('hotelId'),
            user_type: user.email ? 'admin' : 'housekeeper',
            user_name: user.user_metadata?.name || user.email || 'Utilisateur',
            session_token: crypto.randomUUID()
          })
          .select()
          .single();

        if (error) throw error;
        sessionId = data.id;
      } catch (error) {
        console.error('Error creating session:', error);
      }
    };

    const endSession = async () => {
      if (sessionId) {
        try {
          await supabase
            .from('user_sessions')
            .update({ is_active: false })
            .eq('id', sessionId);
        } catch (error) {
          console.error('Error ending session:', error);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await createSession(session.user);
        } else if (event === 'SIGNED_OUT') {
          await endSession();
        }
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        createSession(session.user);
      }
    });

    // Update activity every 2 minutes
    const activityInterval = setInterval(async () => {
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

    // Handle page unload - Remove sendBeacon as it causes issues
    const handleBeforeUnload = () => {
      // Just end session normally, no beacon needed
      endSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      clearInterval(activityInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, []);
}