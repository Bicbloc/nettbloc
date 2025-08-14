import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const QuickHotelFix: React.FC = () => {
  const { user } = useAuth();
  const [isFixing, setIsFixing] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  const handleQuickFix = async () => {
    if (!user?.id) return;

    setIsFixing(true);
    try {
      console.log('🔧 Quick fix pour utilisateur:', user.email);

      // 1. Vérifier/créer le profil
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) {
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            company_name: 'Mon Établissement'
          })
          .select()
          .single();

        if (profileError) throw profileError;
        profile = newProfile;
        console.log('✅ Profil créé:', profile);
      }

      // 2. Chercher son hôtel
      let { data: hotel } = await supabase
        .from('hotels')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!hotel) {
        // Chercher par email
        const { data: hotelByEmail } = await supabase
          .from('hotels')
          .select('*')
          .eq('email', user.email)
          .single();

        if (hotelByEmail) {
          // Récupérer l'hôtel
          const { data: updatedHotel, error: updateError } = await supabase
            .from('hotels')
            .update({ user_id: user.id })
            .eq('id', hotelByEmail.id)
            .select()
            .single();

          if (updateError) throw updateError;
          hotel = updatedHotel;
          console.log('✅ Hôtel récupéré:', hotel);
        } else {
          // Créer un nouvel hôtel
          const { data: newHotel, error: createError } = await supabase
            .from('hotels')
            .insert({
              name: profile.company_name || `Établissement de ${user.email}`,
              email: user.email,
              user_id: user.id
            })
            .select()
            .single();

          if (createError) throw createError;
          hotel = newHotel;
          console.log('✅ Hôtel créé:', hotel);
        }
      }

      // 3. Mettre à jour localStorage
      if (hotel) {
        localStorage.setItem('selectedHotelId', hotel.id);
        localStorage.setItem('selectedHotelCode', hotel.hotel_code || '');
        localStorage.setItem('selectedHotelName', hotel.name);
        localStorage.setItem('autoSetupComplete', 'true');
      }

      setIsFixed(true);
      toast({
        title: "✅ Problème résolu !",
        description: `Hôtel ${hotel.name} configuré avec succès.`,
        duration: 3000
      });

      // Recharger la page après 1 seconde
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('❌ Erreur quick fix:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de corriger automatiquement. Contactez le support.",
        duration: 5000
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