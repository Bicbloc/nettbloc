import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useAutoSetup } from '@/hooks/use-auto-setup';
import { useAuth } from '@/contexts/AuthContext';

interface SetupStatusReloadProps {
  onManualReload?: () => void;
}

export const SetupStatusReload: React.FC<SetupStatusReloadProps> = ({ onManualReload }) => {
  const { isAuthenticated } = useAuth();
  const { hotel, loading, isSetupComplete } = useAutoSetup();

  // Si tout va bien, ne rien afficher
  if (isAuthenticated && isSetupComplete && hotel) {
    return null;
  }

  // Si pas authentifié
  if (!isAuthenticated) {
    return (
      <Alert className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Veuillez vous connecter pour accéder à votre établissement.
        </AlertDescription>
      </Alert>
    );
  }

  // Si en cours de chargement
  if (loading) {
    return (
      <Alert className="mb-4">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <AlertDescription>
          Chargement des données de votre établissement...
        </AlertDescription>
      </Alert>
    );
  }

  // Si échec de chargement
  if (!hotel && !loading) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Impossible de charger les données de votre établissement</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              // Forcer un reload complet
              localStorage.removeItem('autoSetupComplete');
              localStorage.removeItem('lastHotelCheck');
              if (onManualReload) {
                onManualReload();
              } else {
                window.location.reload();
              }
            }}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recharger
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};