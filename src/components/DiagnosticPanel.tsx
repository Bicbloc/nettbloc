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
  const { user } = useAuth();
  const { isPremium, plan, subscribed } = useSubscription();

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Démarrage des diagnostics...');
      
      const results: any = {
        user: null,
        subscription: null,
        hotels: null,
        housekeepers: null,
        accessCodes: null,
        timestamp: new Date().toISOString()
      };

      // 1. Vérifier l'utilisateur
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        results.user = {
          id: user.id,
          email: user.email,
          profile: profile
        };
      }

      // 2. Vérifier les hôtels
      const { data: hotels } = await supabase
        .from('hotels')
        .select('*')
        .eq('user_id', user?.id);
      
      results.hotels = hotels;

      // 3. Vérifier les femmes de chambre
      if (hotels && hotels.length > 0) {
        const hotelId = hotels[0].id;
        
        const { data: housekeepers } = await supabase
          .from('housekeepers')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('is_active', true);
        
        results.housekeepers = housekeepers;

        // 4. Vérifier les codes d'accès
        const { data: accessCodes } = await supabase
          .from('housekeeper_access_codes')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('is_active', true);
        
        results.accessCodes = accessCodes;
      }

      // 5. Informations sur l'abonnement
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
        <div className="flex gap-2">
          <Button onClick={runDiagnostics} disabled={isLoading}>
            {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            Lancer diagnostics
          </Button>
          <Button onClick={fixHotelCodes} variant="outline">
            <CheckCircle className="mr-2 h-4 w-4" />
            Corriger codes hôtel
          </Button>
          <Button onClick={generateMissingCodes} variant="outline">
            <Key className="mr-2 h-4 w-4" />
            Générer codes manquants
          </Button>
        </div>

        {diagnostics && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Diagnostics effectués le {new Date(diagnostics.timestamp).toLocaleString()}
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
                <div className="text-red-600">Aucun utilisateur connecté</div>
              )}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};