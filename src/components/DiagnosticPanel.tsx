import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { CodeGenerationService } from '@/services/codeGenerationService';
import { AlertCircle, CheckCircle, RefreshCw, Database, Key, User } from 'lucide-react';

export const DiagnosticPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const { toast } = useToast();
  const { user, isAuthenticated, loading } = useAuth();
  const { isPremium, plan, subscribed } = useSubscription();

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Démarrage des diagnostics...');
      
      const results: any = {
        authStatus: null,
        user: null,
        subscription: null,
        hotels: null,
        housekeepers: null,
        accessCodes: null,
        localStorageData: null,
        sessions: null,
        timestamp: new Date().toISOString()
      };

      // 1. Vérifier le statut d'authentification
      results.authStatus = {
        isAuthenticated,
        loading,
        hasUser: !!user
      };

      // 2. Vérifier l'utilisateur
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        results.user = {
          id: user.id,
          email: user.email,
          profile: profile
        };
      }

      // 3. Vérifier les hôtels (seulement si authentifié)
      if (user) {
        const { data: hotels } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', user.id);
        
        results.hotels = hotels;

        // 4. Vérifier les femmes de chambre
        if (hotels && hotels.length > 0) {
          const hotelId = hotels[0].id;
          
          const { data: housekeepers } = await supabase
            .from('housekeepers')
            .select('*')
            .eq('hotel_id', hotelId)
            .eq('is_active', true);
          
          results.housekeepers = housekeepers;

          // 5. Vérifier les codes d'accès
          const { data: accessCodes } = await supabase
            .from('housekeeper_access_codes')
            .select('*')
            .eq('hotel_id', hotelId)
            .eq('is_active', true);
          
          results.accessCodes = accessCodes;
        }
      }

      // 6. Vérifier les données localStorage
      results.localStorageData = {
        selectedHotelId: localStorage.getItem('selectedHotelId'),
        selectedHotelCode: localStorage.getItem('selectedHotelCode'),
        selectedHotelName: localStorage.getItem('selectedHotelName'),
        userEmail: localStorage.getItem('userEmail')
      };

      // 7. Vérifier les sessions (sans filtre pour voir les sessions orphelines)
      if (user) {
        const { data: sessions } = await supabase
          .from('user_sessions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        
        results.sessions = sessions;
      }

      // 8. Informations sur l'abonnement
      results.subscription = {
        isPremium,
        plan,
        subscribed
      };

      setDiagnostics(results);
      
      toast({
        title: "Diagnostics terminés",
        description: "Les informations ont été collectées avec succès."
      });

    } catch (error: any) {
      console.error('❌ Erreur diagnostics:', error);
      toast({
        variant: "destructive",
        title: "Erreur diagnostics",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fixAuthentication = async () => {
    try {
      console.log('🔧 Réinitialisation de l\'authentification...');
      
      // Nettoyer localStorage
      localStorage.removeItem('selectedHotelId');
      localStorage.removeItem('selectedHotelCode'); 
      localStorage.removeItem('selectedHotelName');
      localStorage.removeItem('userEmail');
      
      // Forcer une déconnexion puis rediriger vers auth
      await supabase.auth.signOut();
      
      toast({
        title: "Authentification réinitialisée",
        description: "Veuillez vous reconnecter pour continuer."
      });
      
      // Rediriger vers la page d'authentification après un court délai
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1000);
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    }
  };

  const cleanupOrphanSessions = async () => {
    try {
      console.log('🧹 Nettoyage des sessions orphelines...');
      
      const { data, error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .is('hotel_id', null)
        .select();
      
      if (error) throw error;
      
      toast({
        title: "Sessions nettoyées",
        description: `${data?.length || 0} session(s) orpheline(s) désactivée(s).`
      });
      
      await runDiagnostics(); // Refresh
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    }
  };

  const fixHotelCodes = async () => {
    try {
      const fixed = await CodeGenerationService.ensureHotelCodesExist();
      toast({
        title: "Codes hôtel corrigés",
        description: `${fixed} code(s) d'hôtel assigné(s).`
      });
      await runDiagnostics(); // Refresh
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    }
  };

  const generateMissingCodes = async () => {
    try {
      const results = await CodeGenerationService.forceGenerateAllMissingCodes();
      toast({
        title: "Génération terminée",
        description: `${results.generated} code(s) généré(s), ${results.errors.length} erreur(s).`
      });
      await runDiagnostics(); // Refresh
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Panneau de diagnostic
        </CardTitle>
        <CardDescription>
          Diagnostiquer et résoudre les problèmes de génération de codes d'accès et de persistance des données.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={runDiagnostics} disabled={isLoading}>
            {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            Lancer diagnostics
          </Button>
          
          {!isAuthenticated && (
            <Button onClick={fixAuthentication} variant="destructive">
              <User className="mr-2 h-4 w-4" />
              Corriger authentification
            </Button>
          )}
          
          {isAuthenticated && (
            <>
              <Button onClick={fixHotelCodes} variant="outline">
                <CheckCircle className="mr-2 h-4 w-4" />
                Corriger codes hôtel
              </Button>
              <Button onClick={generateMissingCodes} variant="outline">
                <Key className="mr-2 h-4 w-4" />
                Générer codes manquants
              </Button>
              <Button onClick={cleanupOrphanSessions} variant="outline">
                <AlertCircle className="mr-2 h-4 w-4" />
                Nettoyer sessions
              </Button>
            </>
          )}
        </div>

        {diagnostics && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Diagnostics effectués le {new Date(diagnostics.timestamp).toLocaleString()}
            </div>

            {/* Statut d'authentification */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <User className="h-4 w-4" />
                Statut d'authentification
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  Connecté: 
                  <Badge variant={diagnostics.authStatus.isAuthenticated ? "default" : "destructive"}>
                    {diagnostics.authStatus.isAuthenticated ? "Oui" : "Non"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  Chargement: 
                  <Badge variant={diagnostics.authStatus.loading ? "secondary" : "default"}>
                    {diagnostics.authStatus.loading ? "Oui" : "Non"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  Utilisateur présent: 
                  <Badge variant={diagnostics.authStatus.hasUser ? "default" : "destructive"}>
                    {diagnostics.authStatus.hasUser ? "Oui" : "Non"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Utilisateur */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <User className="h-4 w-4" />
                Utilisateur
              </h3>
              {diagnostics.user ? (
                <div className="space-y-2">
                  <div>Email: {diagnostics.user.email}</div>
                  <div>ID: {diagnostics.user.id}</div>
                  <div className="flex items-center gap-2">
                    Abonnement: 
                    <Badge variant={diagnostics.subscription.isPremium ? "default" : "secondary"}>
                      {diagnostics.subscription.plan}
                    </Badge>
                  </div>
                  {diagnostics.user.profile && (
                    <div className="text-sm text-muted-foreground">
                      Entreprise: {diagnostics.user.profile.company_name}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-600">Aucun utilisateur connecté - Authentification requise</div>
              )}
            </div>

            {/* LocalStorage */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Données localStorage</h3>
              <div className="space-y-1 text-sm">
                <div>Hotel ID: {diagnostics.localStorageData.selectedHotelId || <span className="text-gray-500">Non défini</span>}</div>
                <div>Hotel Code: {diagnostics.localStorageData.selectedHotelCode || <span className="text-gray-500">Non défini</span>}</div>
                <div>Hotel Name: {diagnostics.localStorageData.selectedHotelName || <span className="text-gray-500">Non défini</span>}</div>
                <div>User Email: {diagnostics.localStorageData.userEmail || <span className="text-gray-500">Non défini</span>}</div>
              </div>
            </div>

            {/* Hôtels */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Hôtels</h3>
              {diagnostics.hotels && diagnostics.hotels.length > 0 ? (
                <div className="space-y-2">
                  {diagnostics.hotels.map((hotel: any) => (
                    <div key={hotel.id} className="border-l-2 pl-3">
                      <div className="font-medium">{hotel.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Code: {hotel.hotel_code || <span className="text-red-600">MANQUANT!</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">ID: {hotel.id}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-red-600">Aucun hôtel trouvé</div>
              )}
            </div>

            {/* Femmes de chambre */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Femmes de chambre</h3>
              {diagnostics.housekeepers && diagnostics.housekeepers.length > 0 ? (
                <div className="space-y-2">
                  {diagnostics.housekeepers.map((hk: any) => (
                    <div key={hk.id} className="border-l-2 pl-3">
                      <div className="font-medium">{hk.name}</div>
                      <div className="text-sm">
                        Code: {hk.access_code || <span className="text-red-600">MANQUANT!</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Statut: {hk.is_active ? 'Actif' : 'Inactif'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-amber-600">Aucune femme de chambre trouvée</div>
              )}
            </div>

            {/* Codes d'accès */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Codes d'accès dans la table dédiée</h3>
              {diagnostics.accessCodes && diagnostics.accessCodes.length > 0 ? (
                <div className="space-y-2">
                  {diagnostics.accessCodes.map((code: any) => (
                    <div key={code.id} className="border-l-2 pl-3">
                      <div className="font-medium">{code.access_code}</div>
                      <div className="text-sm text-muted-foreground">
                        Housekeeper ID: {code.housekeeper_id || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-amber-600">Aucun code d'accès dans la table dédiée</div>
              )}
            </div>

            {/* Sessions */}
            {diagnostics.sessions && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Sessions récentes (max 20)</h3>
                {diagnostics.sessions.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {diagnostics.sessions.map((session: any) => (
                      <div key={session.id} className={`border-l-2 pl-3 ${!session.hotel_id ? 'border-red-500' : 'border-green-500'}`}>
                        <div className="text-sm">
                          <span className="font-medium">{session.user_name}</span> 
                          <Badge variant={session.is_active ? "default" : "secondary"} className="ml-2 text-xs">
                            {session.is_active ? "Actif" : "Inactif"}
                          </Badge>
                          {!session.hotel_id && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Orpheline
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Hotel ID: {session.hotel_id || <span className="text-red-600">NULL</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Dernière activité: {new Date(session.last_activity).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">Aucune session trouvée</div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};