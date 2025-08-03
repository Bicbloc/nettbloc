import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'fr' | 'en';
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
  dashboard: {
    layout: 'grid' | 'list';
    itemsPerPage: number;
    autoRefresh: boolean;
    refreshInterval: number;
  };
  accessibility: {
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
    animations: boolean;
  };
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'fr',
  notifications: {
    email: true,
    push: true,
    sound: false,
  },
  dashboard: {
    layout: 'grid',
    itemsPerPage: 20,
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
  },
  accessibility: {
    highContrast: false,
    fontSize: 'medium',
    animations: true,
  },
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load preferences from localStorage
  const loadPreferences = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const storageKey = user ? `userPreferences_${user.id}` : 'userPreferences_guest';
      
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setPreferences({ ...defaultPreferences, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback(async (newPreferences: Partial<UserPreferences>) => {
    setSaving(true);
    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      setPreferences(updatedPreferences);

      const { data: { user } } = await supabase.auth.getUser();
      const storageKey = user ? `userPreferences_${user.id}` : 'userPreferences_guest';
      
      localStorage.setItem(storageKey, JSON.stringify(updatedPreferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
      // Revert on error
      setPreferences(preferences);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  // Update specific preference section
  const updatePreference = useCallback(async <K extends keyof UserPreferences>(
    section: K,
    updates: Partial<UserPreferences[K]>
  ) => {
    const currentSection = preferences[section];
    const newSectionPrefs = typeof currentSection === 'object' && currentSection !== null
      ? { ...currentSection, ...updates }
      : updates;
    await savePreferences({ [section]: newSectionPrefs } as Partial<UserPreferences>);
  }, [preferences, savePreferences]);

  // Reset to defaults
  const resetPreferences = useCallback(async () => {
    await savePreferences(defaultPreferences);
  }, [savePreferences]);

  // Apply theme to document
  useEffect(() => {
    const applyTheme = () => {
      const { theme } = preferences;
      const root = document.documentElement;
      
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.className = systemTheme;
      } else {
        root.className = theme;
      }
    };

    applyTheme();

    if (preferences.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [preferences.theme]);

  // Apply accessibility settings
  useEffect(() => {
    const root = document.documentElement;
    const { accessibility } = preferences;

    root.style.setProperty('--font-size-scale', 
      accessibility.fontSize === 'small' ? '0.875' :
      accessibility.fontSize === 'large' ? '1.125' : '1'
    );

    if (accessibility.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (!accessibility.animations) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [preferences.accessibility]);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    loading,
    saving,
    updatePreference,
    savePreferences,
    resetPreferences,
    loadPreferences,
  };
}