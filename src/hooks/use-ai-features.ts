import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns whether AI-powered features (linen counting, image recognition, etc.)
 * are enabled for the current establishment account.
 *
 * The flag is controlled by a super_admin via `admin_set_ai_features_enabled`
 * and stored on `profiles.ai_features_enabled` (default: true).
 */
export function useAiFeatures() {
  const { user, isAuthenticated } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!isAuthenticated || !user) {
        if (active) {
          setEnabled(true);
          setLoading(false);
        }
        return;
      }

      try {
        // Resolve the parent owner id when the current user is a sub-account
        let ownerId = user.id;
        const { data: sub } = await supabase
          .from('sub_accounts')
          .select('parent_user_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (sub?.parent_user_id) ownerId = sub.parent_user_id;

        const { data, error } = await supabase
          .from('profiles')
          .select('ai_features_enabled')
          .eq('id', ownerId)
          .maybeSingle();

        if (active) {
          if (error) {
            console.warn('[useAiFeatures] fetch error, defaulting to enabled', error);
            setEnabled(true);
          } else {
            setEnabled(data?.ai_features_enabled !== false);
          }
        }
      } catch (e) {
        if (active) setEnabled(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [user?.id, isAuthenticated]);

  return { aiEnabled: enabled, loading };
}
