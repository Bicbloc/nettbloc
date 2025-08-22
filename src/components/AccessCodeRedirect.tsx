import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';
import { HousekeeperGuestMode } from './HousekeeperGuestMode';
import { Loader2, Key, AlertTriangle } from 'lucide-react';

export const AccessCodeRedirect: React.FC = () => {
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authResult, setAuthResult] = useState<any>(null);
  const [showGuestMode, setShowGuestMode] = useState(false);
  const { toast } = useToast();

  // Auto-test du code d'accès depuis l'URL si présent
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code') || urlParams.get('access_code');
    
    if (codeFromUrl) {
      setAccessCode(codeFromUrl);
      testAndRedirect(codeFromUrl);
    }
  }, []);

  const testAndRedirect = async (testCode: string = accessCode) => {
    if (!testCode.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir un code d'accès"
      });
      return;
    }

    setIsLoading(true);
    setAuthResult(null);

    try {
      console.log('🔍 Test du code d\'accès:', testCode);
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const authPromise = HousekeeperAuthService.authenticateWithFullCode(testCode);
      const result = await Promise.race([authPromise, timeoutPromise]) as any;
      
      console.log('📊 Résultat authentification:', result);
      setAuthResult(result);

      if (result.success && result.hotel && result.user && !result.user.is_temporary) {
        toast({
          title: "✅ Code valide",
          description: `Accès autorisé pour ${result.user.name} à ${result.hotel.name}`
        });

        // Small delay to show success message before redirect
        setTimeout(() => {
          const params = new URLSearchParams({
            hotel: result.hotel.id,
            access_code: testCode,
            name: result.user.name || 'Femme de chambre'
          });

          const workUrl = `/housekeeper/work-simple?${params.toString()}`;
          console.log('🔗 Redirection vers:', workUrl);
          window.location.href = workUrl;
        }, 1000);
        
      } else if (result.success && result.hotel && (!result.user || result.user.is_temporary)) {
        toast({
          title: "✅ Code général valide",
          description: `Accès en mode gestion à ${result.hotel.name}`
        });
        
        // Show guest mode directly instead of redirecting
        setShowGuestMode(true);
        
      } else {
        toast({
          variant: "destructive",
          title: "❌ Code invalide",
          description: result.error || "Code d'accès non reconnu"
        });
      }

    } catch (error) {
      console.error('❌ Erreur lors du test:', error);
      if (error.message === 'Timeout') {
        toast({
          variant: "destructive",
          title: "Délai d'attente dépassé",
          description: "La vérification du code prend trop de temps"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Erreur lors de la vérification du code"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Si on affiche le mode invité, utiliser le composant approprié
  if (showGuestMode && authResult?.success && authResult?.hotel) {
    return <HousekeeperGuestMode accessCode={accessCode} />;
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Accès avec code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Code d'accès femme de chambre</label>
          <Input
            placeholder="HTL015-2880"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && testAndRedirect()}
            className="font-mono"
          />
        </div>

        <Button 
          onClick={() => testAndRedirect()}
          disabled={isLoading || !accessCode.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Vérification...
            </>
          ) : (
            <>
              <Key className="mr-2 h-4 w-4" />
              Accéder
            </>
          )}
        </Button>

        {/* Résultat du test */}
        {authResult && (
          <div className="space-y-3">
            {authResult.success ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div><strong>✅ Accès autorisé</strong></div>
                    {authResult.hotel && (
                      <div>Hôtel: {authResult.hotel.name} ({authResult.hotel.hotel_code})</div>
                    )}
                    {authResult.user && (
                      <div>Femme de chambre: {authResult.user.name}</div>
                    )}
                    {!authResult.user && (
                      <div>Mode: Accès invité général</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div>
                    <strong>❌ Accès refusé</strong>
                    <div>{authResult.error}</div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Format attendu:</strong> HTL123-XXXX ou HTL123-NOM-XXXX</p>
          <p>Saisissez votre code d'accès pour accéder à l'interface de travail.</p>
        </div>
      </CardContent>
    </Card>
  );
};