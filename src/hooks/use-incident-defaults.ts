import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook pour initialiser automatiquement les données par défaut des incidents
 * (rôles, catégories, items, types) lors du premier accès
 */
export function useIncidentDefaults(hotelId: string | undefined) {
  const { toast } = useToast();

  useEffect(() => {
    if (!hotelId) return;

    const initializeDefaults = async () => {
      try {
        // Vérifier si des rôles existent déjà
        const { data: existingRoles } = await supabase
          .from('staff_roles')
          .select('id')
          .eq('hotel_id', hotelId)
          .limit(1);

        // Si aucun rôle n'existe, créer les données par défaut
        if (!existingRoles || existingRoles.length === 0) {
          
          const { error } = await supabase
            .rpc('create_hotel_incident_defaults', { p_hotel_id: hotelId });

          if (error) {
            console.error('Erreur lors de l\'initialisation des données par défaut:', error);
          } else {
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification/création des données par défaut:', error);
      }
    };

    initializeDefaults();
  }, [hotelId]);
}
