import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserPreferences } from '@/hooks/use-user-preferences';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Bouton de bascule entre le mode clair et le mode sombre.
 * Le thème est persisté via useUserPreferences.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { preferences, savePreferences } = useUserPreferences();

  const isDark =
    preferences.theme === 'dark' ||
    (preferences.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
      onClick={() => savePreferences({ theme: isDark ? 'light' : 'dark' })}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
