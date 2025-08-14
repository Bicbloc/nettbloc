import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { LocalStorageManager } from '@/utils/localStorageManager';

export const QuickHotelFix: React.FC = () => {
  const { user } = useAuth();
  const [isFixing, setIsFixing] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  const handleQuickFix = async () => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Erreur d'authentification",
        description: "Utilisateur non connecté. Veuillez vous reconnecter.",
        duration: 5000
      });
      return;
    }

    setIsFixing(true);
    try {
      console.log('🔧 Quick fix pour utilisateur:', user.email);

      // Phase 0: Vérification de la connectivité Supabase
      try {
        const { data: healthCheck } = await supabase.from('profiles').select('count').limit(1);
        console.log('✅ Connexion Supabase OK');
      } catch (connectError) {
        throw new Error(`Problème de connexion Supabase: ${connectError.message}`);
      }

      // Phase 1: Diagnostic et nettoyage localStorage
      const diagnostic = LocalStorageManager.getDiagnosticReport();
      console.log('📊 Diagnostic localStorage:', diagnostic);
      
      if (diagnostic.corrupted.length > 0) {
        console.log('🧹 Nettoyage localStorage corrompu...');
        LocalStorageManager.cleanCorruptedValues();
      }

      // Phase 2: Vérifier/créer le profil avec gestion d'erreurs détaillée
      console.log('🔍 Vérification du profil utilisateur...');
      let { data: profile, error: profileSelectError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileSelectError) {
        console.error('❌ Erreur lecture profil:', profileSelectError);
        throw new Error(`Impossible de lire le profil: ${profileSelectError.message}`);
      }

      if (!profile) {
        console.log('📝 Création du profil...');
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            company_name: 'Mon Établissement',
            subscription_type: 'trial'
          })
          .select()
          .maybeSingle();

        if (profileError) {
          console.error('❌ Erreur création profil:', profileError);
          throw new Error(`Impossible de créer le profil: ${profileError.message}`);
        }
        profile = newProfile;
        console.log('✅ Profil créé:', profile);
      } else {
        console.log('✅ Profil existant trouvé:', profile);
      }

      // Phase 3: Chercher/créer l'hôtel avec gestion d'erreurs améliorée
      console.log('🏨 Vérification de l\'hôtel...');
      let { data: hotel, error: hotelSelectError } = await supabase
        .from('hotels')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (hotelSelectError) {
        console.error('❌ Erreur lecture hôtel:', hotelSelectError);
        throw new Error(`Impossible de lire l'hôtel: ${hotelSelectError.message}`);
      }

      if (!hotel) {
        console.log('🔍 Recherche hôtel par email...');
        // Chercher par email
        const { data: hotelByEmail, error: emailSearchError } = await supabase
          .from('hotels')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (emailSearchError) {
          console.error('❌ Erreur recherche par email:', emailSearchError);
        }

        if (hotelByEmail && !emailSearchError) {
          console.log('🔗 Récupération de l\'hôtel existant...');
          // Récupérer l'hôtel
          const { data: updatedHotel, error: updateError } = await supabase
            .from('hotels')
            .update({ user_id: user.id })
            .eq('id', hotelByEmail.id)
            .select()
            .maybeSingle();

          if (updateError) {
            console.error('❌ Erreur mise à jour hôtel:', updateError);
            throw new Error(`Impossible de récupérer l'hôtel: ${updateError.message}`);
          }
          hotel = updatedHotel;
          console.log('✅ Hôtel récupéré:', hotel);
        } else {
          console.log('🏗️ Création d\'un nouvel hôtel...');
          // Créer un nouvel hôtel
          const { data: newHotel, error: createError } = await supabase
            .from('hotels')
            .insert({
              name: profile?.company_name || `Établissement de ${user.email}`,
              email: user.email || '',
              user_id: user.id
            })
            .select()
            .maybeSingle();

          if (createError) {
            console.error('❌ Erreur création hôtel:', createError);
            throw new Error(`Impossible de créer l'hôtel: ${createError.message}`);
          }
          hotel = newHotel;
          console.log('✅ Hôtel créé:', hotel);
        }
      } else {
        console.log('✅ Hôtel existant trouvé:', hotel);
      }

      // Phase 4: Validation et sauvegarde
      if (!hotel) {
        throw new Error('Aucun hôtel n\'a pu être trouvé ou créé');
      }

      console.log('💾 Sauvegarde dans localStorage...');
      const saveSuccess = LocalStorageManager.saveHotelData({
        id: hotel.id,
        code: hotel.hotel_code || '',
        name: hotel.name
      });
      
      if (!saveSuccess) {
        console.warn('⚠️ Échec sauvegarde localStorage, mais on continue...');
      }
      
      // Forcer la réinitialisation de useAutoSetup
      console.log('🔄 Déclenchement de la reconnexion...');
      window.dispatchEvent(new Event('hotel-reconnected'));
      
      // Attendre un peu pour la propagation de l'événement
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsFixed(true);
      toast({
        title: "✅ Problème résolu !",
        description: `Hôtel "${hotel.name}" configuré avec succès.`,
        duration: 3000
      });

      // Recharger la page après 2 secondes
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur quick fix:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      toast({
        variant: "destructive",
        title: "Correction automatique échouée",
        description: `Détails: ${errorMessage}`,
        duration: 7000
      });
    } finally {
      setIsFixing(false);
    }
  };

  if (isFixed) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span>Problème résolu ! Rechargement...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="text-orange-800">Correction automatique</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-orange-700">
          Votre compte semble avoir un problème de configuration. 
          Cliquez ci-dessous pour une correction automatique.
        </p>
        
        <Button 
          onClick={handleQuickFix}
          disabled={isFixing}
          className="w-full"
        >
          {isFixing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Correction en cours...
            </>
          ) : (
            'Corriger automatiquement'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};