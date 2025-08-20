import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionState {
  plan: 'free' | 'premium';
  subscribed: boolean;
  loading: boolean;
  subscription_end?: string;
}

export function useSubscription() {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>({
    plan: 'free',
    subscribed: false,
    loading: true
  });

  const checkSubscription = async () => {
    if (!isAuthenticated || !user) {
      setSubscription({ plan: 'free', subscribed: false, loading: false });
      return;
    }

    try {
      // First check local profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, subscription_type')
        .eq('id', user.id)
        .single();

      // Check both plan and subscription_type fields for premium status
      const isPremiumInProfile = profile?.plan === 'premium' || profile?.subscription_type === 'premium';

      if (isPremiumInProfile) {
        // If premium in profile, check with Stripe to make sure it's still active
        const { data, error } = await supabase.functions.invoke('check-subscription');
        
        if (error) {
          console.warn('Stripe check failed, using profile data:', error);
          // Fallback to profile data if Stripe check fails
          setSubscription({
            plan: 'premium',
            subscribed: true,
            loading: false
          });
          return;
        }

        setSubscription({
          plan: data.plan || 'premium',
          subscribed: data.subscribed !== false, // Default to true if not explicitly false
          subscription_end: data.subscription_end,
          loading: false
        });
      } else {
        setSubscription({
          plan: 'free',
          subscribed: false,
          loading: false
        });
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({
        plan: 'free',
        subscribed: false,
        loading: false
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
    
    // Free features (always accessible)
    const freeFeatures = [
      'pdf_analysis',
      'auto_distribution', 
      'report_download',
      'basic_management'
    ];

    // Premium features
    const premiumFeatures = [
      'data_archiving',
      'advanced_team_management',
      'priority_support',
      'custom_reports',
      'bulk_operations'
    ];

    if (freeFeatures.includes(feature)) {
      return true;
    }

    if (premiumFeatures.includes(feature)) {
      return subscription.subscribed && subscription.plan === 'premium';
    }

    return false;
  };

  return {
    ...subscription,
    checkSubscription,
    refreshSubscription,
    canAccessFeature,
    isPremium: subscription.plan === 'premium' && subscription.subscribed,
    isFree: subscription.plan === 'free' || !subscription.subscribed
  };
}