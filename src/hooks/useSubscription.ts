import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addMonths, differenceInDays } from 'date-fns';

export type PlanType = 'freemium' | 'basic' | 'basic_plus' | 'premium' | 'platinum';

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
  freemium: {
    name: 'freemium',
    displayName: 'Freemium',
    price: 0,
    maxRooms: 30,
    features: { incidents: false, linen_inventory: false, inspection: false, api_access: false, unlimited_rooms: false }
  },
  basic: {
    name: 'basic',
    displayName: 'Basic',
    price: 150,
    maxRooms: 70,
    features: { incidents: false, linen_inventory: false, inspection: false, api_access: false, unlimited_rooms: false }
  },
  basic_plus: {
    name: 'basic_plus',
    displayName: 'Basic+',
    price: 250,
    maxRooms: 170,
    features: { incidents: false, linen_inventory: false, inspection: false, api_access: false, unlimited_rooms: false }
  },
  premium: {
    name: 'premium',
    displayName: 'Premium',
    price: 200,
    maxRooms: 150,
    features: { incidents: true, linen_inventory: true, inspection: true, api_access: false, unlimited_rooms: false }
  },
  platinum: {
    name: 'platinum',
    displayName: 'Platinum',
    price: 400,
    maxRooms: null,
    features: { incidents: true, linen_inventory: true, inspection: true, api_access: true, unlimited_rooms: true }
  }
};

interface SubscriptionState {
  plan: PlanType;
  subscribed: boolean;
  loading: boolean;
  subscription_end?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  trialDaysRemaining?: number;
  isInTrial: boolean;
  maxRooms: number;
  featuresEnabled: Record<string, boolean>;
  planConfig: PlanConfig;
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

export function useSubscription() {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>({
    plan: 'freemium',
    subscribed: false,
    loading: true,
    isInTrial: false,
    maxRooms: 30,
    featuresEnabled: DEFAULT_FEATURES,
    planConfig: PLAN_CONFIGS.freemium
  });

  const checkSubscription = async () => {
    if (!isAuthenticated || !user) {
      setSubscription({ 
        plan: 'freemium', 
        subscribed: false, 
        loading: false,
        isInTrial: false,
        maxRooms: 30,
        featuresEnabled: DEFAULT_FEATURES,
        planConfig: PLAN_CONFIGS.freemium
      });
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, subscription_type, trial_start_date, trial_duration_months, trial_end_date, max_rooms, features_enabled, created_at')
        .eq('id', user.id)
        .single();

      // Check trial status
      let isInTrial = false;
      let trialEndDate: Date | undefined;
      let trialDaysRemaining = 0;

      if (profile?.trial_end_date) {
        trialEndDate = new Date(profile.trial_end_date);
        if (new Date() < trialEndDate) {
          isInTrial = true;
          trialDaysRemaining = differenceInDays(trialEndDate, new Date());
        }
      } else if (profile?.trial_start_date) {
        const trialStart = new Date(profile.trial_start_date);
        const trialMonths = profile.trial_duration_months || 3;
        trialEndDate = addMonths(trialStart, trialMonths);
        
        if (new Date() < trialEndDate) {
          isInTrial = true;
          trialDaysRemaining = differenceInDays(trialEndDate, new Date());
        }
      }

      // Determine plan
      let planType: PlanType = 'freemium';
      const profilePlan = profile?.plan as string;
      
      if (profilePlan && profilePlan in PLAN_CONFIGS) {
        planType = profilePlan as PlanType;
      } else if (profile?.subscription_type === 'premium') {
        planType = 'premium';
      } else if (profilePlan === 'free') {
        planType = 'freemium';
      }

      const planConfig = PLAN_CONFIGS[planType];
      const isPaid = planType !== 'freemium';
      const isSubscribed = isPaid || isInTrial;

      // Features based on plan
      const featuresEnabled = {
        ...DEFAULT_FEATURES,
        ...planConfig.features
      };

      // During trial, grant premium features
      if (isInTrial) {
        featuresEnabled.incidents = true;
        featuresEnabled.linen_inventory = true;
        featuresEnabled.inspection = true;
      }

      setSubscription({
        plan: planType,
        subscribed: isSubscribed,
        loading: false,
        isInTrial,
        trialStartDate: profile?.trial_start_date,
        trialEndDate: trialEndDate?.toISOString(),
        trialDaysRemaining,
        maxRooms: planConfig.maxRooms || 999999,
        featuresEnabled,
        planConfig
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({
        plan: 'freemium',
        subscribed: false,
        loading: false,
        isInTrial: false,
        maxRooms: 30,
        featuresEnabled: DEFAULT_FEATURES,
        planConfig: PLAN_CONFIGS.freemium
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
    
    // During trial: premium features
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

  const isPaidPlan = ['basic', 'basic_plus', 'premium', 'platinum'].includes(subscription.plan);

  return {
    ...subscription,
    checkSubscription,
    refreshSubscription,
    canAccessFeature,
    hasFeature,
    isPremium: ['premium', 'platinum'].includes(subscription.plan) && subscription.subscribed,
    isFree: subscription.plan === 'freemium' && !subscription.isInTrial,
    isInTrial: subscription.isInTrial,
    isPlatinum: subscription.plan === 'platinum',
    isBasic: subscription.plan === 'basic',
    isBasicPlus: subscription.plan === 'basic_plus',
    isPaidPlan,
  };
}
