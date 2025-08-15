import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSetup } from '@/hooks/use-auto-setup';

interface SetupStatusSimpleProps {
  onRetry?: () => void;
}

export const SetupStatusSimple = ({ onRetry }: SetupStatusSimpleProps) => {
  const { isAuthenticated } = useAuth();
  const { hotel, loading, isSetupComplete } = useAutoSetup();

  // Si l'utilisateur n'est pas authentifié
  if (!isAuthenticated) {
    return (
      <Card className="mb-6">
        <CardContent className="text-center py-6">
          <AlertTriangle className="h-8 w-8 mx-auto text-orange-500 mb-2" />
          <p className="text-muted-foreground">
            Veuillez vous connecter pour accéder à votre établissement
          </p>
        </CardContent>
      </Card>
    );
  }

  // Si en cours de chargement
  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="text-center py-6">
          <RefreshCw className="h-6 w-6 mx-auto animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">
            Connexion à votre établissement...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Si impossible de charger les données de l'hôtel
  if (!hotel && !loading) {
    return (
      <Card className="mb-6">
        <CardContent className="text-center py-6">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-2" />
          <p className="text-muted-foreground mb-4">
            Impossible de charger les données de votre établissement
          </p>
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              Réessayer
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Si setup terminé avec succès
  if (isSetupComplete && hotel) {
    return (
      <Card className="mb-6 border-green-200 bg-green-50">
        <CardContent className="text-center py-4">
          <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-2" />
          <p className="text-sm text-green-800 font-medium">
            ✅ {hotel.name} - Prêt à l'emploi
          </p>
          <p className="text-xs text-green-600 mt-1">
            Code établissement: {hotel.hotel_code}
          </p>
        </CardContent>
      </Card>
    );
  }

  // État par défaut (ne devrait pas arriver)
  return null;
};