import { useAutoSetup } from '@/hooks/use-auto-setup';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

interface SetupStatusProps {
  onRetry?: () => void;
}

export const SetupStatus: React.FC<SetupStatusProps> = ({ onRetry }) => {
  const { hotel, accessCode, loading, isSetupComplete } = useAutoSetup();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Veuillez vous connecter pour accéder à cette fonctionnalité
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">
            Configuration de l'hôtel en cours...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hotel || !isSetupComplete) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-4" />
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Configuration de l'hôtel incomplète
            </p>
            <p className="text-sm text-muted-foreground">
              La reconnexion automatique à votre hôtel est en cours...
            </p>
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary">Reconnexion en cours</span>
            </div>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Forcer la reconnexion
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isSetupComplete) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-4" />
          <div className="space-y-2">
            <p className="font-medium">Hôtel configuré avec succès !</p>
            <p className="text-sm text-muted-foreground">
              {hotel.name} ({hotel.hotel_code})
            </p>
            {accessCode && (
              <p className="text-xs text-muted-foreground">
                Code d'accès disponible
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default SetupStatus;