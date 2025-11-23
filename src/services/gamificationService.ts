import { supabase } from '@/integrations/supabase/client';

export interface GamificationResult {
  total_xp: number;
  current_level: number;
  level_up: boolean;
  new_badges: string[];
  current_streak: number;
}

export class GamificationService {
  // Ajouter de l'XP après avoir nettoyé une chambre
  static async addXpForRoomCleaned(
    housekeeperId: string,
    hotelId: string,
    duration: number // en minutes
  ): Promise<GamificationResult | null> {
    try {
      // Calculer l'XP basé sur la durée
      const baseXp = 50; // XP de base par chambre
      const speedBonus = duration <= 20 ? 30 : duration <= 30 ? 15 : 0; // Bonus vitesse
      const totalXp = baseXp + speedBonus;

      // Déterminer si c'est rapide
      const isFast = duration <= 20;

      // Appeler la fonction SQL pour ajouter l'XP et vérifier les badges
      const { data, error } = await supabase.rpc('add_housekeeper_xp', {
        p_housekeeper_id: housekeeperId,
        p_hotel_id: hotelId,
        p_xp_amount: totalXp,
        p_room_cleaned: true,
        p_is_perfect: true, // Pour l'instant, on considère toutes les chambres comme parfaites
        p_is_fast: isFast
      });

      if (error) {
        console.error('Erreur ajout XP:', error);
        return null;
      }

      // La fonction RPC retourne un JSONB, on le parse correctement
      return data as unknown as GamificationResult;
    } catch (error) {
      console.error('Erreur gamification:', error);
      return null;
    }
  }

  // Récupérer le niveau et les statistiques d'un housekeeper
  static async getHousekeeperLevel(housekeeperId: string, hotelId: string) {
    try {
      const { data, error } = await supabase
        .from('housekeeper_levels')
        .select('*')
        .eq('housekeeper_id', housekeeperId)
        .eq('hotel_id', hotelId)
        .maybeSingle();

      if (error) {
        console.error('Erreur récupération niveau:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erreur récupération niveau:', error);
      return null;
    }
  }

  // Récupérer tous les badges disponibles
  static async getAllBadges() {
    try {
      const { data, error } = await supabase
        .from('achievement_badges')
        .select('*')
        .order('rarity', { ascending: false })
        .order('points', { ascending: false });

      if (error) {
        console.error('Erreur récupération badges:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erreur récupération badges:', error);
      return [];
    }
  }

  // Récupérer les badges débloqués par un housekeeper
  static async getHousekeeperBadges(housekeeperId: string, hotelId: string) {
    try {
      const { data, error } = await supabase
        .from('housekeeper_achievements')
        .select(`
          *,
          achievement_badges (
            code,
            name,
            description,
            icon,
            category,
            points,
            rarity
          )
        `)
        .eq('housekeeper_id', housekeeperId)
        .eq('hotel_id', hotelId)
        .order('unlocked_at', { ascending: false });

      if (error) {
        console.error('Erreur récupération achievements:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erreur récupération achievements:', error);
      return [];
    }
  }

  // Récupérer tous les badges avec leur statut de déverrouillage
  static async getBadgesWithUnlockStatus(housekeeperId: string, hotelId: string) {
    try {
      // Récupérer tous les badges
      const allBadges = await this.getAllBadges();
      
      // Récupérer les badges débloqués
      const unlockedBadges = await this.getHousekeeperBadges(housekeeperId, hotelId);
      const unlockedCodes = new Set(unlockedBadges.map(b => b.badge_code));

      // Combiner les données
      return allBadges.map(badge => ({
        ...badge,
        unlocked: unlockedCodes.has(badge.code),
        unlocked_at: unlockedBadges.find(b => b.badge_code === badge.code)?.unlocked_at
      }));
    } catch (error) {
      console.error('Erreur récupération badges avec status:', error);
      return [];
    }
  }

  // Récupérer les détails d'un badge par son code
  static async getBadgeByCode(code: string) {
    try {
      const { data, error } = await supabase
        .from('achievement_badges')
        .select('*')
        .eq('code', code)
        .single();

      if (error) {
        console.error('Erreur récupération badge:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erreur récupération badge:', error);
      return null;
    }
  }
}
