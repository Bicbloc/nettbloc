import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Smartphone, Key, Hotel, CheckCircle, AlertCircle } from 'lucide-react';

interface HousekeeperSession {
  hotel_id: string;
  hotel_name: string;
  housekeeper_id: string;
  housekeeper_name: string;
  access_code: string;
}

export default function Mobile() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState(searchParams.get('code') || '');
  const [session, setSession] = useState<HousekeeperSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // Si on a un code dans l'URL, essayer de s'authentifier automatiquement
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl && !session) {
      setAccessCode(codeFromUrl);
      handleAuthenticate(codeFromUrl);
    }
  }, [searchParams]);

  const handleAuthenticate = async (code?: string) => {
    const codeToUse = code || accessCode;
    if (!codeToUse.trim()) {
      toast({
        title: "Code requis",
        description: "Veuillez saisir votre code d'accès",
        variant: "destructive"
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      console.log('🔐 Authentification avec code:', codeToUse);
      
      // Utiliser la fonction sécurisée d'authentification
      const { data: authResult, error } = await supabase.rpc(
        'authenticate_housekeeper_by_code',
        { p_access_code: codeToUse.trim().toUpperCase() }
      );

      if (error || !authResult || authResult.length === 0) {
        console.error('Erreur authentification:', error);
        toast({
          title: "Code invalide",
          description: "Le code d'accès n'est pas valide ou a expiré",
          variant: "destructive"
        });
        return;
      }

      const auth = authResult[0];
      if (!auth.success) {
        toast({
          title: "Accès refusé",
          description: auth.hotel_name ? 
            `L'hôtel "${auth.hotel_name}" existe mais le code est invalide` :
            "Code d'accès invalide",
          variant: "destructive"
        });
        return;
      }

      // Créer la session housekeeper
      const sessionData: HousekeeperSession = {
        hotel_id: auth.hotel_id,
        hotel_name: auth.hotel_name,
        housekeeper_id: auth.housekeeper_id,
        housekeeper_name: auth.housekeeper_name,
        access_code: auth.resolved_access_code
      };

      setSession(sessionData);
      
      // Sauvegarder en localStorage pour persister la session
      localStorage.setItem('housekeeper_session', JSON.stringify(sessionData));
      
      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${auth.housekeeper_name} à l'hôtel ${auth.hotel_name}`
      });

      // Rediriger vers le dashboard housekeeper
      navigate('/housekeeper-dashboard');
      
    } catch (error) {
      console.error('Erreur authentification:', error);
      toast({
        title: "Erreur",
        description: "Impossible de se connecter. Vérifiez votre connexion.",
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('housekeeper_session');
    setAccessCode('');
    toast({
      title: "Déconnexion",
      description: "Vous avez été déconnecté avec succès"
    });
  };

  // Vérifier s'il y a une session existante
  useEffect(() => {
    const savedSession = localStorage.getItem('housekeeper_session');
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        setSession(sessionData);
      } catch (error) {
        console.error('Erreur parsing session:', error);
        localStorage.removeItem('housekeeper_session');
      }
    }
  }, []);

  if (session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-green-100 p-3 rounded-full">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-green-700">Connecté avec succès</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Hotel className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{session.hotel_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Femme de chambre:</span>
                  <Badge variant="secondary">{session.housekeeper_name}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <code className="text-xs bg-background px-2 py-1 rounded">
                    {session.access_code}
                  </code>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate('/housekeeper-dashboard')}
                className="w-full"
                size="lg"
              >
                Accéder au tableau de bord
              </Button>
              
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                Se déconnecter
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle>Interface Mobile Femme de Chambre</CardTitle>
            <p className="text-muted-foreground">
              Saisissez votre code d'accès pour vous connecter
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-code">Code d'accès</Label>
              <Input
                id="access-code"
                placeholder="HTL001-ANA-1234"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleAuthenticate()}
                className="font-mono text-center"
                disabled={isAuthenticating}
              />
              <p className="text-xs text-muted-foreground">
                Format: CODE-HÔTEL-INITIALES-NUMÉRO
              </p>
            </div>

            <Button 
              onClick={() => handleAuthenticate()}
              disabled={!accessCode.trim() || isAuthenticating}
              className="w-full"
              size="lg"
            >
              {isAuthenticating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Connexion...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Se connecter
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-800">
                  Première connexion ?
                </p>
                <p className="text-xs text-yellow-700">
                  Demandez votre code d'accès personnel à l'administrateur de l'hôtel.
                  Chaque femme de chambre a un code unique.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
