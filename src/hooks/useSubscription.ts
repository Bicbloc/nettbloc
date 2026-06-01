import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addMonths, differenceInDays } from 'date-fns';

export type PlanType = 'decouverte' | 'essentiel' | 'confort' | 'business' | 'entreprise';

interface PlanConfig {
  name: string;
  displayName: string;
  price: number;
  maxRooms: number | null;
  features: {
    incidents: boolean;
    linen_inventory: boolean;
    inspection: boolean;
    api_access: boolean;
    unlimited_rooms: boolean;
  };
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  decouverte: {
    name: 'decouverte',
    displayName: 'Découverte',
    price: 0,
    maxRooms: 15,
    features: { incidents: false, linen_inventory: false, inspection: false, api_access: false, unlimited_rooms: false }
  },
  essentiel: {
    name: 'essentiel',
    displayName: 'Essentiel',
    price: 150,
    maxRooms: 70,
    features: { incidents: false, linen_inventory: false, inspection: false, api_access: false, unlimited_rooms: false }
  },
  confort: {
    name: 'confort',
    displayName: 'Confort',
    price: 200,
    maxRooms: 150,
    features: { incidents: true, linen_inventory: true, inspection: true, api_access: false, unlimited_rooms: false }
  },
  business: {
    name: 'business',
    displayName: 'Business',
    price: 250,
    maxRooms: 170,
    features: { incidents: true, linen_inventory: true, inspection: false, api_access: false, unlimited_rooms: false }
  },
  entreprise: {
    name: 'entreprise',
    displayName: 'Entreprise',
    price: 400,
    maxRooms: null,
    features: { incidents: true, linen_inventory: true, inspection: true, api_access: true, unlimited_rooms: true }
  }
};

export interface SubscriptionState {
  plan: PlanType;
  subscribed: boolean;
  loading: boolean;
  subscription_end?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  trialDaysRemaining?: number;
  isInTrial: boolean;
  isTrialExpired: boolean;
  maxRooms: number;
  featuresEnabled: Record<string, boolean>;
  planConfig: PlanConfig;
  subscriptionStatus: 'none' | 'trial' | 'active' | 'expired' | 'cancelled' | 'paused';
  isPaused: boolean;
}

const DEFAULT_FEATURES = {
  pdf_analysis: true,
  auto_distribution: true,
  basic_report: true,
  incidents: false,
  linen_inventory: false,
  inspection: false,
  access_codes: false,
  ai_learning: false,
  api_access: false,
  linen: false
};

// Map old plan names to new ones for backward compatibility
const PLAN_NAME_MAP: Record<string, PlanType> = {
  freemium: 'decouverte',
  basic: 'essentiel',
  premium: 'confort',
  basic_plus: 'business',
  platinum: 'entreprise',
  free: 'decouverte',
  decouverte: 'decouverte',
  essentiel: 'essentiel',
  confort: 'confort',
  business: 'business',
  entreprise: 'entreprise',
};

export function useSubscription() {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>({
    plan: 'decouverte',
    subscribed: false,
    loading: true,
    isInTrial: false,
    isTrialExpired: false,
    maxRooms: 15,
    featuresEnabled: DEFAULT_FEATURES,
    planConfig: PLAN_CONFIGS.decouverte,
    subscriptionStatus: 'none',
    isPaused: false

  });

  const checkSubscription = async () => {
    if (!isAuthenticated || !user) {
      setSubscription({ 
        plan: 'decouverte', 
        subscribed: false, 
        loading: false,
        isInTrial: false,
        isTrialExpired: false,
        maxRooms: 15,
        featuresEnabled: DEFAULT_FEATURES,
        planConfig: PLAN_CONFIGS.decouverte,
        subscriptionStatus: 'none',
        isPaused: false

      });
      return;
    }

    try {
      // Check if user is a sub-account
      const { data: subAccountData } = await supabase
        .from('sub_accounts')
        .select('id, parent_user_id, hotel_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      // If sub-account, fetch parent's profile for subscription
      const profileUserId = subAccountData?.parent_user_id || user.id;

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, subscription_type, subscription_status, trial_start_date, trial_duration_months, trial_end_date, max_rooms, features_enabled, created_at, onboarding_completed_at')
        .eq('id', profileUserId)
        .single();

      // Check trial status
      let isInTrial = false;
      let isTrialExpired = false;
      let trialEndDate: Date | undefined;
      let trialDaysRemaining = 0;
      let subscriptionStatus: SubscriptionState['subscriptionStatus'] = 'none';

      // If user has active subscription
      if (profile?.subscription_status === 'paused') {
        subscriptionStatus = 'paused';
      } else if (profile?.subscription_status === 'active' || profile?.subscription_type === 'confort') {
        subscriptionStatus = 'active';
      } else if (profile?.trial_end_date) {
        trialEndDate = new Date(profile.trial_end_date);
        if (new Date() < trialEndDate) {
          isInTrial = true;
          subscriptionStatus = 'trial';
          trialDaysRemaining = differenceInDays(trialEndDate, new Date());
        } else {
          isTrialExpired = true;
          subscriptionStatus = 'expired';
        }
      } else if (profile?.trial_start_date) {
        const trialStart = new Date(profile.trial_start_date);
        const trialMonths = profile.trial_duration_months || 3;
        trialEndDate = addMonths(trialStart, trialMonths);
        
        if (new Date() < trialEndDate) {
          isInTrial = true;
          subscriptionStatus = 'trial';
          trialDaysRemaining = differenceInDays(trialEndDate, new Date());
        } else {
          isTrialExpired = true;
          subscriptionStatus = 'expired';
        }
      }

      // Determine plan - resolve through name map for backward compat
      let planType: PlanType = 'decouverte';
      const profilePlan = profile?.plan as string;
      
      if (profilePlan && PLAN_NAME_MAP[profilePlan]) {
        planType = PLAN_NAME_MAP[profilePlan];
      } else if (profilePlan && profilePlan in PLAN_CONFIGS) {
        planType = profilePlan as PlanType;
      }

      // During trial, use entreprise plan (full access)
      const effectivePlan = isInTrial ? 'entreprise' : planType;
      const planConfig = PLAN_CONFIGS[effectivePlan];
      const isPaid = planType !== 'decouverte';
      const isSubscribed = isPaid || isInTrial;

      // Features based on plan
      const featuresEnabled = {
        ...DEFAULT_FEATURES,
        ...planConfig.features
      };

      // During trial, grant all entreprise features (unlimited)
      if (isInTrial) {
        featuresEnabled.incidents = true;
        featuresEnabled.linen_inventory = true;
        featuresEnabled.inspection = true;
        featuresEnabled.api_access = true;
      }

      setSubscription({
        plan: isInTrial ? 'entreprise' : planType,
        subscribed: isSubscribed,
        loading: false,
        isInTrial,
        isTrialExpired,
        trialStartDate: profile?.trial_start_date,
        trialEndDate: trialEndDate?.toISOString(),
        trialDaysRemaining,
        maxRooms: isInTrial ? 999999 : (planConfig.maxRooms || 999999),
        featuresEnabled,
        planConfig,
        subscriptionStatus
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({
        plan: 'decouverte',
        subscribed: false,
        loading: false,
        isInTrial: false,
        isTrialExpired: false,
        maxRooms: 15,
        featuresEnabled: DEFAULT_FEATURES,
        planConfig: PLAN_CONFIGS.decouverte,
        subscriptionStatus: 'none'
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
    
    // During trial: all features
    if (subscription.isInTrial) {
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

    return subscription.featuresEnabled[feature] === true;
  };

  const hasFeature = (feature: keyof typeof DEFAULT_FEATURES) => {
    if (subscription.isInTrial) {
      // During trial, grant premium features
      if (['incidents', 'linen_inventory', 'inspection'].includes(feature)) {
        return true;
      }
    }
    return subscription.featuresEnabled[feature] === true;
  };

  const isPaidPlan = ['essentiel', 'confort', 'business', 'entreprise'].includes(subscription.plan);

  return {
    ...subscription,
    checkSubscription,
    refreshSubscription,
    canAccessFeature,
    hasFeature,
    isPremium: ['confort', 'entreprise'].includes(subscription.plan) && subscription.subscribed,
    isFree: subscription.plan === 'decouverte' && !subscription.isInTrial,
    isInTrial: subscription.isInTrial,
    isTrialExpired: subscription.isTrialExpired,
    isPlatinum: subscription.plan === 'entreprise',
    isBasic: subscription.plan === 'essentiel',
    isBasicPlus: subscription.plan === 'business',
    isPaidPlan,
    subscriptionStatus: subscription.subscriptionStatus,
  };
}