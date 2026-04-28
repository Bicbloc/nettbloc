import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns whether AI-powered features (linen counting, image recognition, etc.)
 * are enabled for the current establishment account.
 *
 * The flag is controlled by a super_admin via `admin_set_ai_features_enabled`
 * and stored on `profiles.ai_features_enabled` (default: true).
 *
 * Pass `hotelId` to resolve the owner from the hotel (useful for staff
 * sessions where there is no authenticated establishment user).
 */
export function useAiFeatures(hotelId?: string | null) {
  const { user, isAuthenticated } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        let ownerId: string | null = null;

        // Path 1: resolve owner from hotelId (works for staff)
        if (hotelId) {
          const { data: hotel } = await supabase
            .from('hotels')
            .select('user_id')
            .eq('id', hotelId)
            .maybeSingle();
          ownerId = hotel?.user_id ?? null;
        }

        // Path 2: resolve owner from authenticated user (admin / sub-account)
        if (!ownerId && isAuthenticated && user) {
          ownerId = user.id;
          const { data: sub } = await supabase
            .from('sub_accounts')
            .select('parent_user_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();
          if (sub?.parent_user_id) ownerId = sub.parent_user_id;
        }

        if (!ownerId) {
          if (active) { setEnabled(true); setLoading(false); }
          return;
        }

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
  }, [user?.id, isAuthenticated, hotelId]);

  return { aiEnabled: enabled, loading };
}
