import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingState {
  needsOnboarding: boolean;
  isLoading: boolean;
  trialWarningLevel: number;
  isTrialExpired: boolean;
  onboardingCompletedAt: string | null;
  isSuperAdmin: boolean;
}

export function useOnboarding() {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    needsOnboarding: false,
    isLoading: true,
    trialWarningLevel: 0,
    isTrialExpired: false,
    onboardingCompletedAt: null,
    isSuperAdmin: false
  });

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isAuthenticated || !user) {
        setState({
          needsOnboarding: false,
          isLoading: false,
          trialWarningLevel: 0,
          isTrialExpired: false,
          onboardingCompletedAt: null,
          isSuperAdmin: false
        });
        return;
      }

      try {
        // Vérifier si super admin d'abord
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .maybeSingle();

        const isSuperAdmin = !!roleData;
        // Récupérer le profil
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed_at, trial_end_date, subscription_status, subscription_type')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        // Vérifier si l'onboarding est nécessaire
        const needsOnboarding = !profile?.onboarding_completed_at;

        // Calculer le niveau d'avertissement trial
        let trialWarningLevel = 0;
        let isTrialExpired = false;

        if (profile?.trial_end_date) {
          const trialEnd = new Date(profile.trial_end_date);
          const now = new Date();
          const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysRemaining <= 0) {
            trialWarningLevel = 4;
            isTrialExpired = true;
          } else if (daysRemaining <= 3) {
            trialWarningLevel = 3;
          } else if (daysRemaining <= 7) {
            trialWarningLevel = 2;
          } else if (daysRemaining <= 14) {
            trialWarningLevel = 1;
          }
        }

        // Si abonné ou super admin, pas d'expiration
        if (profile?.subscription_status === 'active' || profile?.subscription_type === 'premium' || isSuperAdmin) {
          isTrialExpired = false;
          trialWarningLevel = 0;
        }

        setState({
          needsOnboarding: isSuperAdmin ? false : needsOnboarding, // Super admin skip onboarding
          isLoading: false,
          trialWarningLevel,
          isTrialExpired,
          onboardingCompletedAt: profile?.onboarding_completed_at,
          isSuperAdmin
        });
      } catch (error) {
        console.error('Erreur vérification onboarding:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    checkOnboardingStatus();
  }, [isAuthenticated, user]);

  const markOnboardingComplete = async () => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        needsOnboarding: false,
        onboardingCompletedAt: new Date().toISOString()
      }));

      return true;
    } catch (error) {
      console.error('Erreur marquage onboarding:', error);
      return false;
    }
  };

  return {
    ...state,
    markOnboardingComplete
  };
}
