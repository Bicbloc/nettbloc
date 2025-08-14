import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useHotelState } from '@/hooks/use-hotel-state';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface HotelSetupFixProps {
  onForceSetup?: () => void;
}

export const HotelSetupFix: React.FC<HotelSetupFixProps> = ({ onForceSetup }) => {
  const { hotel, accessCode, isSetupComplete, loading, generateAccessCode } = useHotelState();
  
  const forceHotelAssociation = async () => {
    try {
      // Réactualiser localStorage avec les bonnes données de l'hôtel
      if (hotel) {
        localStorage.setItem('selectedHotelId', hotel.id);
        localStorage.setItem('selectedHotelCode', hotel.hotel_code || '');
        localStorage.setItem('selectedHotelName', hotel.name);
        
        console.log('✅ Hôtel forcé dans localStorage:', {
          id: hotel.id,
          code: hotel.hotel_code,
          name: hotel.name
        });
        
        // Recharger la page pour réinitialiser le contexte
        if (onForceSetup) {
          onForceSetup();
        } else {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('❌ Erreur forçage association hôtel:', error);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 animate-spin" />
            <CardTitle>Configuration en cours...</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vérification de votre hôtel associé...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hotel) {
    return (
      <Card className="w-full max-w-md mx-auto border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Aucun hôtel trouvé</CardTitle>
          </div>
          <CardDescription>
            Votre compte n'est pas associé à un hôtel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Pour utiliser le système de gestion des femmes de chambre, 
            vous devez d'abord créer un hôtel.
          </p>
          <Button onClick={() => window.location.href = '/settings'} className="w-full">
            Configurer un hôtel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          {isSetupComplete ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-orange-500" />
          )}
          <CardTitle>État de votre hôtel</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium">{hotel.name}</p>
          <p className="text-sm text-muted-foreground">Code: {hotel.hotel_code}</p>
        </div>
        
        {accessCode ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Code d'accès disponible</Badge>
            </div>
            <p className="text-sm">Code: <code className="bg-muted px-2 py-1 rounded">{accessCode}</code></p>
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="outline">Aucun code d'accès</Badge>
            <Button onClick={generateAccessCode} size="sm" variant="outline">
              Générer un code d'accès
            </Button>
          </div>
        )}
        
        {!isSetupComplete && (
          <div className="space-y-2">
            <p className="text-sm text-orange-600">
              Configuration incomplète détectée
            </p>
            <Button onClick={forceHotelAssociation} className="w-full" variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Forcer l'association
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};