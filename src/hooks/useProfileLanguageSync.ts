import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Synchronise la langue de l'utilisateur avec son profil au montage uniquement.
 * Si le profil a une `preferred_language`, on l'applique,
 * SAUF si l'utilisateur a explicitement choisi une autre langue dans ce navigateur.
 */
export const useProfileLanguageSync = () => {
  const { user, isAuthenticated } = useAuth();
  const { setLanguage } = useLanguage();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (syncedRef.current) return;

    const userOverride = localStorage.getItem('preferred_language_user_set');
    if (userOverride === 'true') {
      syncedRef.current = true;
      return;
    }

    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', user.id)
          .maybeSingle();

        const lang = (data as any)?.preferred_language;
        const current = localStorage.getItem('preferred_language');
        if ((lang === 'fr' || lang === 'en') && lang !== current) {
          // Init depuis le profil — on évite de marquer comme "user_set"
          localStorage.setItem('preferred_language', lang);
          setLanguage(lang);
          localStorage.setItem('preferred_language_user_set', 'false');
        }
      } catch {
        // ignore
      } finally {
        syncedRef.current = true;
      }
    })();
  }, [isAuthenticated, user, setLanguage]);
};
