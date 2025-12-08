import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addMonths, differenceInDays } from 'date-fns';

interface SubscriptionState {
  plan: 'free' | 'premium' | 'trial';
  subscribed: boolean;
  loading: boolean;
  subscription_end?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  trialDaysRemaining?: number;
  isInTrial: boolean;
  maxRooms: number;
  featuresEnabled: Record<string, boolean>;
}

const DEFAULT_FEATURES = {
  pdf_analysis: true,
  auto_distribution: true,
  basic_report: true,
  incidents: false,
  linen: false,
  access_codes: false,
  ai_learning: false,
  api_access: false
};

export function useSubscription() {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>({
    plan: 'free',
    subscribed: false,
    loading: true,
    isInTrial: false,
    maxRooms: 15,
    featuresEnabled: DEFAULT_FEATURES
  });

  const checkSubscription = async () => {
    if (!isAuthenticated || !user) {
      setSubscription({ 
        plan: 'free', 
        subscribed: false, 
        loading: false,
        isInTrial: false,
        maxRooms: 15,
        featuresEnabled: DEFAULT_FEATURES
      });
      return;
    }

    try {
      // Fetch profile with new trial fields
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, subscription_type, trial_start_date, trial_duration_months, max_rooms, features_enabled, created_at')
        .eq('id', user.id)
        .single();

      // Check if user is in trial period
      let isInTrial = false;
      let trialEndDate: Date | undefined;
      let trialDaysRemaining = 0;

      if (profile?.trial_start_date) {
        const trialStart = new Date(profile.trial_start_date);
        const trialMonths = profile.trial_duration_months || 3;
        trialEndDate = addMonths(trialStart, trialMonths);
        
        if (new Date() < trialEndDate) {
          isInTrial = true;
          trialDaysRemaining = differenceInDays(trialEndDate, new Date());
        }
      } else if (profile?.created_at && !profile?.subscription_type) {
        // New user without trial_start_date - start trial now
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            trial_start_date: new Date().toISOString(),
            trial_duration_months: 3,
            subscription_type: 'trial'
          })
          .eq('id', user.id);

        if (!updateError) {
          isInTrial = true;
          trialEndDate = addMonths(new Date(), 3);
          trialDaysRemaining = 90;
        }
      }

      // Check premium status
      const isPremiumInProfile = profile?.plan === 'premium' || profile?.subscription_type === 'premium';
      const isTrialInProfile = profile?.subscription_type === 'trial';

      // Determine features based on plan
      const featuresEnabled = profile?.features_enabled && typeof profile.features_enabled === 'object'
        ? profile.features_enabled as Record<string, boolean>
        : DEFAULT_FEATURES;

      if (isPremiumInProfile) {
        setSubscription({
          plan: 'premium',
          subscribed: true,
          loading: false,
          isInTrial: false,
          maxRooms: profile?.max_rooms || 999999,
          featuresEnabled: { ...DEFAULT_FEATURES, incidents: true, linen: true, access_codes: true, ai_learning: true }
        });
      } else if (isInTrial) {
        // During trial: full premium access
        setSubscription({
          plan: 'trial',
          subscribed: true,
          loading: false,
          isInTrial: true,
          trialStartDate: profile?.trial_start_date,
          trialEndDate: trialEndDate?.toISOString(),
          trialDaysRemaining,
          maxRooms: 999999, // Unlimited during trial
          featuresEnabled: { ...DEFAULT_FEATURES, incidents: true, linen: true, access_codes: true, ai_learning: true }
        });
      } else {
        // Free plan
        setSubscription({
          plan: 'free',
          subscribed: false,
          loading: false,
          isInTrial: false,
          maxRooms: profile?.max_rooms || 15,
          featuresEnabled: DEFAULT_FEATURES
        });
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({
        plan: 'free',
        subscribed: false,
        loading: false,
        isInTrial: false,
        maxRooms: 15,
        featuresEnabled: DEFAULT_FEATURES
      });
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [isAuthenticated, user]);

  const refreshSubscription = () => {
    setSubscription(prev => ({ ...prev, loading: true }));
    checkSubscription();
  };

  const canAccessFeature = (feature: string) => {
    if (!isAuthenticated) return false;
    
    // During trial or premium: all features accessible
    if (subscription.isInTrial || subscription.plan === 'premium') {
      return true;
    }
    
    // Free features (always accessible)
    const freeFeatures = [
      'pdf_analysis',
      'auto_distribution', 
      'report_download',
      'basic_management',
      'basic_report'
    ];

    if (freeFeatures.includes(feature)) {
      return true;
    }

    // Check specific feature in featuresEnabled
    return subscription.featuresEnabled[feature] === true;
  };

  const hasFeature = (feature: keyof typeof DEFAULT_FEATURES) => {
    if (subscription.isInTrial || subscription.plan === 'premium') {
      return true;
    }
    return subscription.featuresEnabled[feature] === true;
  };

  return {
    ...subscription,
    checkSubscription,
    refreshSubscription,
    canAccessFeature,
    hasFeature,
    isPremium: subscription.plan === 'premium' && subscription.subscribed,
    isFree: subscription.plan === 'free' && !subscription.isInTrial,
    isInTrial: subscription.isInTrial
  };
}