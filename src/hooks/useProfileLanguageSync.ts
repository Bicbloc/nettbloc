import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Synchronise la langue de l'utilisateur avec son profil.
 * Si le profil a une `preferred_language`, on l'applique à la session courante,
 * SAUF si l'utilisateur a explicitement choisi une autre langue dans ce navigateur.
 */
export const useProfileLanguageSync = () => {
  const { user, isAuthenticated } = useAuth();
  const { setLanguage, language } = useLanguage();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const userOverride = localStorage.getItem('preferred_language_user_set');
    if (userOverride === 'true') return; // l'utilisateur a forcé manuellement

    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', user.id)
          .maybeSingle();

        const lang = (data as any)?.preferred_language;
        if ((lang === 'fr' || lang === 'en') && lang !== language) {
          setLanguage(lang);
        }
      } catch {
        // ignore
      }
    })();
  }, [isAuthenticated, user, language, setLanguage]);
};
