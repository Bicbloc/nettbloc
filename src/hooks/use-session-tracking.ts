import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSessionTracking() {
  useEffect(() => {
    let sessionId: string | null = null;

    const createSession = async (user: any) => {
      try {
        console.log('🔄 Creating session for user:', user.id);
        
        // First check if user already has an active session - use maybeSingle
        const { data: existingSession, error: findError } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (findError && findError.code !== 'PGRST116') {
          console.error('Error finding session:', findError);
          return;
        }

        if (existingSession) {
          console.log('✅ Existing session found, updating');
          sessionId = existingSession.id;
          // Update last activity
          await supabase
            .from('user_sessions')
            .update({ last_activity: new Date().toISOString() })
            .eq('id', sessionId);
          return;
        }

        // Create new session if none exists
        console.log('➕ Creating new session');
        const { data: newSession, error: createError } = await supabase
          .from('user_sessions')
          .insert({
            user_id: user.id,
            user_name: user.email || 'Utilisateur',
            user_type: 'admin',
            session_token: Math.random().toString(36),
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
        console.log('✅ Session created:', sessionId);
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

    // Update activity every 5 minutes (reduced frequency)
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
    }, 300000); // 5 minutes

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