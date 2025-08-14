import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { LocalStorageManager } from '@/utils/localStorageManager';

interface AutoSetupDiagnosticProps {
  hotel: any;
  accessCode: string | null;
  isSetupComplete: boolean;
  loading: boolean;
  hasConfigurationIssues: boolean;
  onForceReload?: () => void;
}

export const AutoSetupDiagnostic: React.FC<AutoSetupDiagnosticProps> = ({
  hotel,
  accessCode,
  isSetupComplete,
  loading,
  hasConfigurationIssues,
  onForceReload
}) => {
  const { user, isAuthenticated } = useAuth();

  const getDiagnosticStatus = () => {
    if (!isAuthenticated) return { status: 'error', message: 'Non authentifié' };
    if (loading) return { status: 'loading', message: 'Chargement en cours...' };
    if (hasConfigurationIssues) return { status: 'warning', message: 'Configuration requise' };
    if (!hotel) return { status: 'error', message: 'Aucun hôtel trouvé' };
    if (!isSetupComplete) return { status: 'warning', message: 'Setup incomplet' };
    return { status: 'success', message: 'Configuration réussie' };
  };

  const { status, message } = getDiagnosticStatus();

  const getStatusIcon = () => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'loading': return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const handleClearCache = () => {
    // Utiliser le gestionnaire centralisé
    LocalStorageManager.resetHotelData();
    
    if (onForceReload) {
      onForceReload();
    } else {
      window.location.reload();
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Diagnostic Auto-Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Statut:</span>
            <Badge variant={status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
              {message}
            </Badge>
          </div>
          
          <div>
            <span className="font-medium">Utilisateur:</span>
            <span className="ml-2">{user?.email || 'Non connecté'}</span>
          </div>
          
          <div>
            <span className="font-medium">ID Utilisateur:</span>
            <span className="ml-2 font-mono text-xs">{user?.id || 'N/A'}</span>
          </div>
          
          <div>
            <span className="font-medium">Authentifié:</span>
            <Badge variant={isAuthenticated ? 'default' : 'destructive'}>
              {isAuthenticated ? 'Oui' : 'Non'}
            </Badge>
          </div>
          
          <div>
            <span className="font-medium">Hôtel ID:</span>
            <span className="ml-2 font-mono text-xs">{hotel?.id || 'N/A'}</span>
          </div>
          
          <div>
            <span className="font-medium">Nom Hôtel:</span>
            <span className="ml-2">{hotel?.name || 'N/A'}</span>
          </div>
          
          <div>
            <span className="font-medium">Code Hôtel:</span>
            <span className="ml-2">{hotel?.hotel_code || 'N/A'}</span>
          </div>
          
          <div>
            <span className="font-medium">Code d'accès:</span>
            <span className="ml-2">{accessCode || 'Aucun'}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">État localStorage:</h4>
          <div className="text-sm text-muted-foreground">
            {(() => {
              const diagnostic = LocalStorageManager.getDiagnosticReport();
              return (
                <div className="space-y-1">
                  <div>✅ Valides: {Object.keys(diagnostic.valid).length}</div>
                  <div>❌ Corrompues: {diagnostic.corrupted.length}</div>
                  <div>⚠️ Manquantes: {diagnostic.missing.length}</div>
                  {diagnostic.corrupted.length > 0 && (
                    <div className="text-red-600 text-xs">
                      Corrompues: {diagnostic.corrupted.join(', ')}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearCache}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Nettoyer Cache & Recharger
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => console.log('Diagnostic:', { user, hotel, accessCode, isSetupComplete, loading })}
          >
            Debug Console
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};