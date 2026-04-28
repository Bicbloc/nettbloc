import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Lock } from 'lucide-react';
import { useAiFeatures } from '@/hooks/use-ai-features';

interface AiFeatureGuardProps {
  children: ReactNode;
  /** Optional fallback UI; if omitted a small disabled card is shown. */
  fallback?: ReactNode;
  /** When true, render nothing if disabled (no fallback card). */
  silent?: boolean;
}

/**
 * Hides or replaces children when AI features are disabled by the
 * super-admin for the current establishment account.
 */
export function AiFeatureGuard({ children, fallback, silent }: AiFeatureGuardProps) {
  const { aiEnabled, loading } = useAiFeatures();

  if (loading) return null;
  if (aiEnabled) return <>{children}</>;
  if (silent) return null;
  if (fallback) return <>{fallback}</>;

  return (
    <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
      <CardContent className="py-6 flex items-center gap-3 text-muted-foreground">
        <div className="p-2 rounded-full bg-muted">
          <Lock className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            AI features disabled
          </p>
          <p className="text-xs">
            Image recognition and AI linen counting have been disabled for your account.
            Please contact support to re-enable them.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
