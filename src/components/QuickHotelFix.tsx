import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { LocalStorageManager } from '@/utils/localStorageManager';

export const QuickHotelFix: React.FC = () => {
  const { user } = useAuth();
  const [isFixing, setIsFixing] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [fixDetails, setFixDetails] = useState<string[]>([]);

  const handleQuickFix = async () => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Utilisateur non authentifié"
      });
      return;
    }

    setIsFixing(true);
    setFixDetails([]);
    const details: string[] = [];
    
    try {
      console.log('🔧 Quick fix pour utilisateur:', user.email);
      details.push(`Correction pour ${user.email}`);

      // Phase 0: Diagnostic et nettoyage localStorage
      const diagnostic = LocalStorageManager.getDiagnosticReport();
      console.log('📊 Diagnostic localStorage:', diagnostic);
      
      if (diagnostic.corrupted.length > 0) {
        console.log('🧹 Nettoyage localStorage corrompu...');
        LocalStorageManager.cleanCorruptedValues();
        details.push('localStorage nettoyé');
      }

      // 1. Vérifier/créer le profil avec gestion d'erreur améliorée
      let profile;
      try {
        const { data: existingProfile, error: profileSelectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileSelectError) {
          console.warn('Erreur lecture profil:', profileSelectError);
          details.push('Erreur lecture profil existant');
        }

        profile = existingProfile;

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
            console.error('Erreur création profil:', profileError);
            details.push(`Erreur profil: ${profileError.message}`);
            throw new Error(`Profil: ${profileError.message}`);
          }
          profile = newProfile;
          details.push('Profil créé');
          console.log('✅ Profil créé:', profile);
        } else {
          details.push('Profil trouvé');
        }
      } catch (profileError) {
        console.error('Erreur profil globale:', profileError);
        details.push('Échec gestion profil');
      }

      // 2. Chercher/créer son hôtel avec gestion d'erreur robuste
      let hotel;
      try {
        // Chercher par user_id d'abord
        const { data: hotelByUserId } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        hotel = hotelByUserId;

        if (!hotel && user.email) {
          // Chercher par email
          const { data: hotelByEmail } = await supabase
            .from('hotels')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

          if (hotelByEmail) {
            // Associer l'hôtel existant
            const { data: updatedHotel, error: updateError } = await supabase
              .from('hotels')
              .update({ user_id: user.id })
              .eq('id', hotelByEmail.id)
              .select()
              .maybeSingle();

            if (updateError) {
              console.error('Erreur association hôtel:', updateError);
              details.push(`Erreur association: ${updateError.message}`);
            } else {
              hotel = updatedHotel;
              details.push('Hôtel récupéré par email');
              console.log('✅ Hôtel associé:', hotel);
            }
          }
        }

        if (!hotel) {
          // Créer un nouvel hôtel
          console.log('🏨 Création nouvel hôtel...');
          const hotelName = profile?.company_name || `Établissement de ${user.email?.split('@')[0] || 'Utilisateur'}`;
          
          const { data: newHotel, error: createError } = await supabase
            .from('hotels')
            .insert({
              name: hotelName,
              email: user.email || '',
              user_id: user.id
            })
            .select()
            .maybeSingle();

          if (createError) {
            console.error('Erreur création hôtel:', createError);
            details.push(`Erreur création hôtel: ${createError.message}`);
            throw new Error(`Hôtel: ${createError.message}`);
          }
          hotel = newHotel;
          details.push('Nouvel hôtel créé');
          console.log('✅ Hôtel créé:', hotel);
        } else {
          details.push('Hôtel trouvé');
        }
      } catch (hotelError) {
        console.error('Erreur hôtel globale:', hotelError);
        details.push('Échec gestion hôtel');
        throw hotelError;
      }

      // 3. Sauvegarder dans localStorage avec validation
      if (hotel) {
        try {
          const saveSuccess = LocalStorageManager.saveHotelData({
            id: hotel.id,
            code: hotel.hotel_code || 'HTL001',
            name: hotel.name
          });
          
          if (!saveSuccess) {
            throw new Error('Échec sauvegarde localStorage');
          }
          
          details.push('Données sauvegardées localement');
          
          // Forcer la réinitialisation de useAutoSetup
          window.dispatchEvent(new Event('hotel-reconnected'));
          details.push('Reconnexion déclenchée');
        } catch (storageError) {
          console.error('Erreur localStorage:', storageError);
          details.push('Erreur sauvegarde locale');
        }
      }

      setFixDetails(details);
      setIsFixed(true);
      
      toast({
        title: "✅ Correction réussie !",
        description: `Hôtel "${hotel?.name}" configuré. Rechargement...`,
        duration: 2000
      });

      // Recharger la page après 2 secondes
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('❌ Erreur quick fix:', error);
      details.push(`Erreur finale: ${error.message || 'Inconnue'}`);
      setFixDetails(details);
      
      toast({
        variant: "destructive",
        title: "Correction échouée",
        description: error.message || "Erreur inconnue lors de la correction",
        duration: 5000
      });
    } finally {
      setIsFixing(false);
    }
  };

  if (isFixed) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Correction réussie ! Rechargement...</span>
          </div>
          {fixDetails.length > 0 && (
            <div className="text-sm text-green-600 bg-green-100 p-2 rounded">
              <div className="flex items-center gap-1 mb-1">
                <Info className="h-4 w-4" />
                <span className="font-medium">Détails:</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                {fixDetails.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </div>
          )}
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
          Cette correction va vérifier et réparer votre profil et hôtel.
        </p>
        
        {fixDetails.length > 0 && !isFixed && (
          <div className="text-sm text-orange-600 bg-orange-100 p-2 rounded">
            <div className="flex items-center gap-1 mb-1">
              <Info className="h-4 w-4" />
              <span className="font-medium">Progression:</span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {fixDetails.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
            </div>
        )}
        
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
            <>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Corriger automatiquement
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};