import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubscription } from './useSubscription';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
  })),
}));

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Helper to wait for async updates
const waitForUpdates = () => new Promise(resolve => setTimeout(resolve, 50));

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when user is not authenticated', () => {
    it('should return free plan with default values', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      const { result } = renderHook(() => useSubscription());
      
      await waitForUpdates();

      expect(result.current.plan).toBe('free');
      expect(result.current.subscribed).toBe(false);
      expect(result.current.isInTrial).toBe(false);
      expect(result.current.maxRooms).toBe(15);
      expect(result.current.isPremium).toBe(false);
      expect(result.current.isFree).toBe(true);
    });

    it('should have default features for free plan', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      const { result } = renderHook(() => useSubscription());
      
      await waitForUpdates();

      expect(result.current.featuresEnabled.pdf_analysis).toBe(true);
      expect(result.current.featuresEnabled.auto_distribution).toBe(true);
      expect(result.current.featuresEnabled.incidents).toBe(false);
      expect(result.current.featuresEnabled.linen).toBe(false);
    });
  });

  describe('canAccessFeature', () => {
    it('should return false for premium features when not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      const { result } = renderHook(() => useSubscription());
      
      await waitForUpdates();

      expect(result.current.canAccessFeature('incidents')).toBe(false);
      expect(result.current.canAccessFeature('linen')).toBe(false);
      expect(result.current.canAccessFeature('access_codes')).toBe(false);
    });

    it('should return false for all features when not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      const { result } = renderHook(() => useSubscription());
      
      await waitForUpdates();

      // Free features return false when not authenticated (no access at all)
      expect(result.current.canAccessFeature('pdf_analysis')).toBe(false);
    });
  });

  describe('when user is authenticated with premium plan', () => {
    it('should return premium status', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-id' },
        isAuthenticated: true,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                plan: 'premium',
                subscription_type: 'premium',
                max_rooms: 999999,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useSubscription());
      
      await waitForUpdates();

      expect(result.current.plan).toBe('premium');
      expect(result.current.subscribed).toBe(true);
      expect(result.current.isPremium).toBe(true);
      expect(result.current.isFree).toBe(false);
    });
  });

  describe('when user is in trial period', () => {
    it('should return trial status with correct days remaining', async () => {
      const trialStartDate = new Date();
      trialStartDate.setDate(trialStartDate.getDate() - 10); // Started 10 days ago

      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-id' },
        isAuthenticated: true,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                plan: 'free',
                subscription_type: 'trial',
                trial_start_date: trialStartDate.toISOString(),
                trial_duration_months: 3,
                max_rooms: 15,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useSubscription());
      
      await waitForUpdates();

      expect(result.current.plan).toBe('trial');
      expect(result.current.isInTrial).toBe(true);
      expect(result.current.maxRooms).toBe(999999); // Unlimited during trial
      expect(result.current.trialDaysRemaining).toBeGreaterThan(70);
    });

    it('should give access to premium features during trial', async () => {
      const trialStartDate = new Date();

      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-id' },
        isAuthenticated: true,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                plan: 'free',
                subscription_type: 'trial',
                trial_start_date: trialStartDate.toISOString(),
                trial_duration_months: 3,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useSubscription());
      
      await waitForUpdates();

      expect(result.current.canAccessFeature('incidents')).toBe(true);
      expect(result.current.canAccessFeature('linen')).toBe(true);
      expect(result.current.canAccessFeature('access_codes')).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('should return true for all features during trial', async () => {
      const trialStartDate = new Date();

      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-id' },
        isAuthenticated: true,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                subscription_type: 'trial',
                trial_start_date: trialStartDate.toISOString(),
                trial_duration_months: 3,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useSubscription());
      
      await waitForUpdates();

      expect(result.current.hasFeature('incidents')).toBe(true);
      expect(result.current.hasFeature('linen')).toBe(true);
      expect(result.current.hasFeature('ai_learning')).toBe(true);
    });
  });
});
