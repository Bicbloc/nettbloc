import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AdminBanner {
  id: string;
  title: string;
  message: string;
  message_en: string | null;
  banner_type: 'info' | 'maintenance' | 'promotion' | 'urgent';
  action_label: string | null;
  action_label_en: string | null;
  action_url: string | null;
  is_dismissible: boolean;
  starts_at: string;
  ends_at: string | null;
}

export const useAdminBanners = () => {
  const { user, isAuthenticated } = useAuth();
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setBanners([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_active_banners_for_user');
      if (error) throw error;
      setBanners((data || []) as AdminBanner[]);
    } catch (e) {
      if (import.meta.env.DEV) console.error('useAdminBanners: failed to load banners', e);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    refresh();
    // Rafraîchissement toutes les 5 min
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const dismiss = useCallback(async (bannerId: string) => {
    if (!user) return;
    setBanners((prev) => prev.filter((b) => b.id !== bannerId));
    try {
      await supabase.from('admin_banner_dismissals').insert({
        banner_id: bannerId,
        user_id: user.id,
      });
    } catch (e) {
      // ignore
    }
  }, [user]);

  return { banners, loading, refresh, dismiss };
};
