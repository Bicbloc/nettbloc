import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  hotel_id: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface CreateResult {
  housekeeper: Housekeeper;
  isNew: boolean;
}

export class HousekeeperService {
  /**
   * Crée ou récupère une femme de chambre/technicien
   * Empêche les doublons en vérifiant d'abord si le nom existe déjà
   */
  static async createOrGetHousekeeper(
    hotelId: string,
    name: string,
    userId: string
  ): Promise<CreateResult | null> {
    try {
      const trimmedName = name.trim();
      
      if (!trimmedName) {
        toast.error("Le nom ne peut pas être vide");
        return null;
      }

      // Vérifier si le nom existe déjà (insensible à la casse)
      const { data: existing, error: checkError } = await supabase
        .from('housekeepers')
        .select('*')
        .eq('hotel_id', hotelId)
        .ilike('name', trimmedName)
        .eq('is_active', true)
        .maybeSingle();

      if (checkError) {
        console.error('Erreur lors de la vérification des doublons:', checkError);
        toast.error("Erreur lors de la vérification");
        return null;
      }

      // Si existe déjà, retourner l'existant
      if (existing) {
        toast.info(`${trimmedName} existe déjà`);
        return {
          housekeeper: existing as Housekeeper,
          isNew: false
        };
      }

      // Générer un code d'accès via la fonction Supabase
      const { data: accessCode, error: codeError } = await supabase
        .rpc('generate_and_insert_access_code', {
          p_hotel_id: hotelId,
          p_housekeeper_name: trimmedName
        });

      if (codeError || !accessCode) {
        console.error('Erreur génération code:', codeError);
        toast.error("Erreur lors de la génération du code d'accès");
        return null;
      }

      // Récupérer la femme de chambre créée
      const { data: newHousekeeper, error: fetchError } = await supabase
        .from('housekeepers')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('access_code', accessCode)
        .maybeSingle();

      if (fetchError || !newHousekeeper) {
        console.error('Erreur récupération:', fetchError);
        toast.error("Erreur lors de la création");
        return null;
      }

      return {
        housekeeper: newHousekeeper as Housekeeper,
        isNew: true
      };
    } catch (error) {
      console.error('Erreur inattendue:', error);
      toast.error("Une erreur inattendue s'est produite");
      return null;
    }
  }

  /**
   * Vérifie si un nom existe déjà pour cet hôtel
   */
  static async checkNameExists(hotelId: string, name: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('housekeepers')
        .select('id')
        .eq('hotel_id', hotelId)
        .ilike('name', name.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Erreur vérification nom:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Erreur inattendue:', error);
      return false;
    }
  }

  /**
   * Trouve les noms similaires (pour suggérer à l'utilisateur)
   */
  static async findSimilarNames(
    hotelId: string,
    searchTerm: string,
    limit: number = 3
  ): Promise<string[]> {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from('housekeepers')
        .select('name')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .ilike('name', `%${searchTerm}%`)
        .limit(limit);

      if (error) {
        console.error('Erreur recherche similaires:', error);
        return [];
      }

      return data?.map(h => h.name) || [];
    } catch (error) {
      console.error('Erreur inattendue:', error);
      return [];
    }
  }
}
