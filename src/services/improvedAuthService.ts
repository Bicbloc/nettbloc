import { supabase } from '@/integrations/supabase/client';

export interface AuthResult {
  success: boolean;
  user?: any;
  hotel?: any;
  accessCode?: string;
  error?: string;
  debugInfo?: any;
}

export class ImprovedAuthService {
  /**
   * Authenticate with access code - NO EXPIRATION CHECKS
   * This replaces the old authentication with permanent codes
   */
  static async authenticateWithCode(accessCode: string): Promise<AuthResult> {
    console.log('🔐 Authentification améliorée avec code:', accessCode);
    
    try {
      if (!accessCode || accessCode.length < 5) {
        return {
          success: false,
          error: 'Code d\'accès invalide (trop court)'
        };
      }

      // Normalize code
      const normalized = accessCode.trim().toUpperCase();
      const parts = normalized.split('-').filter(Boolean);
      const hotelCode = parts[0];

      if (!hotelCode) {
        return {
          success: false,
          error: 'Format de code invalide'
        };
      }

      console.log('🏨 Code hôtel extrait:', hotelCode);

      // Find hotel by code
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('hotel_code', hotelCode)
        .maybeSingle();

      if (hotelError || !hotel) {
        console.error('❌ Hôtel non trouvé:', { hotelCode, error: hotelError });
        return {
          success: false,
          error: `Hôtel avec le code \"${hotelCode}\" introuvable`
        };
      }

      console.log('✅ Hôtel trouvé:', hotel);

      // Search for access code in multiple formats - NO EXPIRATION CHECK
      let accessCodeData = null;
      
      // 1. Exact match in housekeeper_access_codes (ONLY check is_active, ignore expires_at)
      const { data: exactMatch, error: exactError } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          housekeepers (
            id,
            name,
            hotel_id,
            user_id,
            is_active
          )
        `)
        .eq('access_code', normalized)
        .eq('hotel_id', hotel.id)
        .eq('is_active', true) // ONLY CHECK is_active
        .maybeSingle();

      if (exactMatch && !exactError) {
        accessCodeData = exactMatch;
        console.log('✅ Code trouvé (exact match)');
      }

      // 2. If not found, try pattern matching for short codes
      if (!accessCodeData && parts.length === 2) {
        const suffix = parts[1];
        const { data: patternCodes, error: patternErr } = await supabase
          .from('housekeeper_access_codes')
          .select(`
            *,
            housekeepers (
              id,
              name,
              hotel_id,
              user_id,
              is_active
            )
          `)
          .eq('hotel_id', hotel.id)
          .eq('is_active', true) // ONLY CHECK is_active
          .ilike('access_code', `${hotelCode}-%-${suffix}`)
          .limit(1);

        if (!patternErr && patternCodes && patternCodes.length > 0) {
          accessCodeData = patternCodes[0];
          console.log('✅ Code trouvé (pattern match)');
        }
      }

      // 3. Fallback: search in housekeepers table directly
      if (!accessCodeData) {
        const { data: housekeeperMatch, error: hkError } = await supabase
          .from('housekeepers')
          .select('*')
          .eq('hotel_id', hotel.id)
          .eq('is_active', true)
          .eq('access_code', normalized)
          .maybeSingle();

        if (housekeeperMatch && !hkError) {
          // Create a mock access code data for compatibility
          accessCodeData = {
            id: `hk-${housekeeperMatch.id}`,
            access_code: normalized,
            hotel_id: hotel.id,
            housekeeper_id: housekeeperMatch.id,
            is_active: true,
            housekeepers: housekeeperMatch
          };
          console.log('✅ Code trouvé (housekeeper direct)');
        }
      }

      if (!accessCodeData) {
        console.error('❌ Code d\'accès non trouvé');
        return {
          success: false,
          error: `Code d'accès \"${accessCode}\" non trouvé ou inactif`
        };
      }

      // Handle general access codes (no specific housekeeper)
      if (!accessCodeData.housekeeper_id) {
        console.log('✅ Code d\'accès général détecté');
        const guestHousekeeper = {
          id: `guest-${accessCodeData.id}`,
          name: accessCodeData.invited_name || 'Femme de chambre invitée',
          hotel_id: hotel.id,
          user_id: 'guest',
          is_active: true,
          access_code: accessCodeData.access_code,
          is_temporary: true
        };

        // Mark as used (optional tracking)
        await supabase
          .from('housekeeper_access_codes')
          .update({ used_at: new Date().toISOString() })
          .eq('id', accessCodeData.id);

        return {
          success: true,
          user: guestHousekeeper,
          hotel: hotel,
          accessCode: accessCodeData.access_code
        };
      }

      // Handle specific housekeeper codes
      const housekeeper = accessCodeData.housekeepers;
      if (!housekeeper || !housekeeper.is_active) {
        return {
          success: false,
          error: 'Femme de chambre inactive ou non trouvée'
        };
      }

      console.log('✅ Authentification réussie pour:', housekeeper.name);

      // Mark as used (optional tracking)
      await supabase
        .from('housekeeper_access_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', accessCodeData.id);

      return {
        success: true,
        user: housekeeper,
        hotel: hotel,
        accessCode: accessCodeData.access_code
      };

    } catch (error) {
      console.error('💥 Erreur authentification améliorée:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'authentification'
      };
    }
  }

  /**
   * Simple hotel lookup by code
   */
  static async findHotelByCode(hotelCode: string): Promise<AuthResult> {
    try {
      const normalized = hotelCode.trim().toUpperCase();
      
      const { data: hotel, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('hotel_code', normalized)
        .maybeSingle();

      if (error || !hotel) {
        return {
          success: false,
          error: `Hôtel avec le code \"${normalized}\" non trouvé`
        };
      }

      return {
        success: true,
        hotel: hotel
      };
    } catch (error) {
      console.error('💥 Erreur recherche hôtel:', error);
      return {
        success: false,
        error: 'Erreur lors de la recherche de l\'hôtel'
      };
    }
  }

  /**
   * Test if access code exists (for diagnostics)
   */
  static async testAccessCode(accessCode: string): Promise<AuthResult> {
    try {
      const normalized = accessCode.trim().toUpperCase();
      
      // Check in access codes table (no expiration check)
      const { data: codes, error } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          hotels (id, name, hotel_code),
          housekeepers (id, name, is_active)
        `)
        .eq('access_code', normalized)
        .eq('is_active', true); // Only check is_active

      if (error) {
        return {
          success: false,
          error: 'Erreur lors du test du code'
        };
      }

      if (!codes || codes.length === 0) {
        return {
          success: false,
          error: 'Code d\'accès non trouvé'
        };
      }

      const activeCode = codes[0]; // We already filtered by is_active
      return {
        success: true,
        debugInfo: {
          accessCode: normalized,
          codeData: activeCode,
          hotel: activeCode.hotels,
          housekeeper: activeCode.housekeepers
        }
      };
    } catch (error) {
      console.error('💥 Erreur test code:', error);
      return {
        success: false,
        error: 'Erreur lors du test du code'
      };
    }
  }
}
