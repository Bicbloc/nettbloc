import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_STORAGE_KEY = 'nettobloc_session_id';
const ACTIVITY_INTERVAL = 120000; // 2 minutes

export function useSessionTracking() {
  const sessionIdRef = useRef<string | null>(null);
  const isCreatingRef = useRef(false);
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get stored session ID from localStorage
  const getStoredSessionId = useCallback(() => {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }, []);

  // Store session ID in localStorage
  const storeSessionId = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(SESSION_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to store session ID:', e);
    }
  }, []);

  // Deactivate old sessions for this user
  const deactivateOldSessions = useCallback(async (userId: string, currentSessionId?: string) => {
    try {
      const query = supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (currentSessionId) {
        query.neq('id', currentSessionId);
      }

      await query;
    } catch (e) {
      console.warn('Failed to deactivate old sessions:', e);
    }
  }, []);

  // Create or update session
  const createOrUpdateSession = useCallback(async (user: { id: string; email?: string }) => {
    // Prevent concurrent creation
    if (isCreatingRef.current) {
      console.log('🔄 Session creation already in progress, skipping');
      return;
    }

    isCreatingRef.current = true;

    try {
      const storedSessionId = getStoredSessionId();

      // Check if we have a valid stored session
      if (storedSessionId) {
        const { data: existingSession, error } = await supabase
          .from('user_sessions')
          .select('id, is_active, user_id')
          .eq('id', storedSessionId)
          .eq('is_active', true)
          .maybeSingle();

        if (!error && existingSession && existingSession.user_id === user.id) {
          // Session exists and belongs to this user - just update activity
          console.log('✅ Reusing existing session:', storedSessionId);
          sessionIdRef.current = storedSessionId;
          
          await supabase
            .from('user_sessions')
            .update({ last_activity: new Date().toISOString() })
            .eq('id', storedSessionId);
          
          return;
        }
      }

      // Check for any active session for this user
      const { data: userSession, error: findError } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!findError && userSession) {
        // Found an active session - reuse it
        console.log('✅ Found active session for user:', userSession.id);
        sessionIdRef.current = userSession.id;
        storeSessionId(userSession.id);
        
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', userSession.id);
        
        return;
      }

      // No valid session found - create new one
      console.log('➕ Creating new session for user:', user.id);

      // First, deactivate ALL old sessions for this user
      await deactivateOldSessions(user.id);

      const { data: newSession, error: createError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          user_name: user.email || 'Utilisateur',
          user_type: 'admin',
          session_token: crypto.randomUUID(),
          is_active: true,
          login_time: new Date().toISOString(),
          last_activity: new Date().toISOString()
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Failed to create session:', createError);
        return;
      }

      sessionIdRef.current = newSession.id;
      storeSessionId(newSession.id);
      console.log('✅ New session created:', newSession.id);

    } catch (error) {
      console.error('Session tracking error:', error);
    } finally {
      isCreatingRef.current = false;
    }
  }, [getStoredSessionId, storeSessionId, deactivateOldSessions]);

  // End current session
  const endSession = useCallback(async () => {
    const sessionId = sessionIdRef.current || getStoredSessionId();
    
    if (!sessionId) return;

    try {
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);
      
      console.log('👋 Session ended:', sessionId);
    } catch (error) {
      console.warn('Failed to end session:', error);
    } finally {
      sessionIdRef.current = null;
      storeSessionId(null);
    }
  }, [getStoredSessionId, storeSessionId]);

  // Update activity timestamp
  const updateActivity = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (error) {
      console.warn('Failed to update activity:', error);
    }
  }, []);

  // Start activity tracking
  const startActivityTracking = useCallback(() => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
    }
    
    activityIntervalRef.current = setInterval(updateActivity, ACTIVITY_INTERVAL);
  }, [updateActivity]);

  // Stop activity tracking
  const stopActivityTracking = useCallback(() => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false;
    let lastEventTime = 0;
    const EVENT_DEBOUNCE_MS = 500; // Debounce 500ms entre les événements

    const handleAuthChange = async (event: string, session: any) => {
      if (!isMounted) return;

      const now = Date.now();
      
      // Debounce: ignorer les événements trop rapprochés
      if (now - lastEventTime < EVENT_DEBOUNCE_MS) {
        console.log('⏭️ Session tracking: événement ignoré (debounce)');
        return;
      }
      lastEventTime = now;

      // Ignorer INITIAL_SESSION si on a déjà initialisé via SIGNED_IN
      if (event === 'INITIAL_SESSION' && hasInitialized) {
        console.log('⏭️ Session tracking: INITIAL_SESSION ignoré (déjà initialisé)');
        return;
      }

      // Traiter SIGNED_IN et INITIAL_SESSION de la même manière
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && !hasInitialized) {
        hasInitialized = true;
        console.log('✅ Session tracking: initialisation via', event);
        await createOrUpdateSession(session.user);
        startActivityTracking();
      } else if (event === 'SIGNED_OUT') {
        stopActivityTracking();
        await endSession();
        hasInitialized = false;
        lastEventTime = 0; // Reset debounce après déconnexion
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Sur refresh token, juste mettre à jour l'activité, pas créer nouvelle session
        updateActivity();
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Check for existing session on mount avec délai pour éviter race condition
    const initTimeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (isMounted && session?.user && !hasInitialized) {
          hasInitialized = true;
          console.log('✅ Session tracking: initialisation via getSession');
          createOrUpdateSession(session.user);
          startActivityTracking();
        }
      });
    }, 100); // Petit délai pour laisser l'auth listener s'installer

    // Handle visibility change - mark inactive when hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateActivity(); // One final update before potentially going away
      } else if (document.visibilityState === 'visible') {
        updateActivity(); // Update when coming back
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
      stopActivityTracking();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Don't call endSession on cleanup - let visibility/beforeunload handle it
    };
  }, [createOrUpdateSession, endSession, updateActivity, startActivityTracking, stopActivityTracking]);
}
