import { supabase } from '@/integrations/supabase/client';
import { generateHotelId } from '@/lib/utils';

export interface HousekeeperAuthResult {
  success: boolean;
  user?: any;
  hotel?: any;
  error?: string;
  debugInfo?: any;
}

export class HousekeeperAuthService {
  // Authenticate with full access code (e.g., HTL002-ALA-0835)
  static async authenticateWithFullCode(accessCode: string): Promise<HousekeeperAuthResult> {
    console.log('🔐 Authentification avec code complet:', accessCode);
    
    try {
      // Validate code format
      if (!accessCode || accessCode.length < 8) {
        return {
          success: false,
          error: 'Code d\'accès invalide (trop court)',
          debugInfo: { providedCode: accessCode }
        };
      }

      // Extraire et normaliser le code hôtel
      const rawHotelPart = accessCode.split('-')[0]?.trim().toUpperCase();
      const hotelCode = rawHotelPart || '';
      console.log('🏨 Code hôtel extrait:', hotelCode);

      // Rechercher l'hôtel par code exact (insensible à la casse)
      let { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('hotel_code', hotelCode)
        .maybeSingle();

      // Fallback: tenter via l'ID déterministe si non trouvé
      if (!hotel) {
        const deterministicId = generateHotelId(hotelCode);
        const { data: byId, error: byIdError } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', deterministicId)
          .maybeSingle();
        hotel = byId as any;
        hotelError = byIdError as any;
      }

      if (hotelError || !hotel) {
        console.error('❌ Hôtel non trouvé:', { hotelCode, error: hotelError });
        return {
          success: false,
          error: `Hôtel avec le code "${hotelCode}" introuvable`,
          debugInfo: { hotelCode, hotelError, triedDeterministicId: true }
        };
      }

      console.log('✅ Hôtel trouvé:', hotel);

      // Find housekeeper access code - chercher dans les deux tables
      let { data: accessCodeData, error: codeError } = await supabase
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
        .eq('access_code', accessCode)
        .eq('hotel_id', hotel.id)
        .eq('is_active', true)
        .maybeSingle();

      console.log('🔍 Recherche dans housekeeper_access_codes:', { accessCodeData, codeError });

      // Si pas trouvé dans housekeeper_access_codes, chercher directement dans housekeepers
      if (!accessCodeData) {
        console.log('🔄 Code non trouvé dans housekeeper_access_codes, recherche dans housekeepers...');
        const { data: housekeeper, error: housekeeperError } = await supabase
          .from('housekeepers')
          .select('*')
          .eq('access_code', accessCode)
          .eq('hotel_id', hotel.id)
          .eq('is_active', true)
          .maybeSingle();

        console.log('🔍 Résultat recherche housekeeper:', { housekeeper, housekeeperError });

        if (housekeeper) {
          // Create a mock accessCodeData structure
          accessCodeData = {
            id: 'mock-' + housekeeper.id,
            access_code: accessCode,
            hotel_id: hotel.id,
            housekeeper_id: housekeeper.id,
            is_active: true,
            created_at: new Date().toISOString(),
            created_by: null,
            expires_at: null,
            used_at: null,
            housekeepers: housekeeper
          } as any;
          codeError = null;
          console.log('✅ Femme de chambre trouvée via access_code:', housekeeper);
        }
      }

      if (codeError || !accessCodeData) {
        console.error('❌ Code d\'accès non trouvé dans les deux tables:', { accessCode, error: codeError });
        
        // Try to find any code with this pattern for debugging
        const { data: allCodes } = await supabase
          .from('housekeeper_access_codes')
          .select('access_code, hotel_id, is_active, housekeeper_id')
          .eq('hotel_id', hotel.id);
          
        const { data: allHousekeepers } = await supabase
          .from('housekeepers')
          .select('name, access_code, hotel_id, is_active')
          .eq('hotel_id', hotel.id);
        
        return {
          success: false,
          error: `Code d'accès "${accessCode}" non trouvé`,
          debugInfo: { 
            accessCode, 
            hotelId: hotel.id,
            availableCodes: allCodes,
            availableHousekeepers: allHousekeepers,
            searchedInBothTables: true,
            codeError 
          }
        };
      }

      const housekeeper = accessCodeData.housekeepers;
      if (!housekeeper || !housekeeper.is_active) {
        return {
          success: false,
          error: 'Femme de chambre inactive ou non trouvée',
          debugInfo: { housekeeper, accessCodeData }
        };
      }

      console.log('✅ Authentification réussie:', housekeeper);

      // Mark code as used
      await supabase
        .from('housekeeper_access_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', accessCodeData.id);

      return {
        success: true,
        user: housekeeper,
        hotel: hotel,
        debugInfo: { accessCodeData, housekeeper, hotel }
      };

    } catch (error) {
      console.error('💥 Erreur authentification:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'authentification',
        debugInfo: { error }
      };
    }
  }

  // Find hotel by code only (for two-step authentication)
  static async findHotelByCode(hotelCodeInput: string): Promise<HousekeeperAuthResult> {
    console.log('🔍 Recherche hôtel avec code:', hotelCodeInput);
    
    try {
      const normalized = (hotelCodeInput || '').trim().toUpperCase();
      const codeOnly = normalized.split('-')[0];

      // Tentative 1: par hotel_code exact
      let { data: hotel, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('hotel_code', codeOnly)
        .maybeSingle();

      // Tentative 2: par ID déterministe
      if (!hotel) {
        const deterministicId = generateHotelId(codeOnly);
        const { data: byId, error: byIdError } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', deterministicId)
          .maybeSingle();
        hotel = byId as any;
        error = byIdError as any;
      }

      if (error || !hotel) {
        console.error('❌ Hôtel non trouvé:', { codeOnly, error });
        const { data: allHotels } = await supabase
          .from('hotels')
          .select('hotel_code, name, id');
        return {
          success: false,
          error: `Hôtel avec le code "${codeOnly}" non trouvé`,
          debugInfo: { input: hotelCodeInput, codeOnly, availableHotels: allHotels, error }
        };
      }

      console.log('✅ Hôtel trouvé:', hotel);
      return { success: true, hotel, debugInfo: { hotel } };

    } catch (error) {
      console.error('💥 Erreur recherche hôtel:', error);
      return { success: false, error: 'Erreur lors de la recherche de l\'hôtel', debugInfo: { error } };
    }
  }

  // Test if access code exists and is valid
  static async testAccessCode(accessCode: string): Promise<HousekeeperAuthResult> {
    console.log('🧪 Test du code d\'accès:', accessCode);
    
    try {
      // Get all matching codes for debugging
      const { data: codes, error } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          hotels (
            id,
            name,
            hotel_code
          ),
          housekeepers (
            id,
            name,
            is_active
          )
        `)
        .eq('access_code', accessCode);

      if (error) {
        return {
          success: false,
          error: 'Erreur lors du test du code',
          debugInfo: { error }
        };
      }

      if (!codes || codes.length === 0) {
        return {
          success: false,
          error: 'Code d\'accès non trouvé dans la base de données',
          debugInfo: { accessCode, searchResult: codes }
        };
      }

      const activeCode = codes.find(code => code.is_active);
      if (!activeCode) {
        return {
          success: false,
          error: 'Code d\'accès trouvé mais inactif',
          debugInfo: { accessCode, codes }
        };
      }

      return {
        success: true,
        debugInfo: { 
          accessCode, 
          codeData: activeCode,
          hotel: activeCode.hotels,
          housekeeper: activeCode.housekeepers,
          allMatches: codes 
        }
      };

    } catch (error) {
      console.error('💥 Erreur test code:', error);
      return {
        success: false,
        error: 'Erreur lors du test du code',
        debugInfo: { error }
      };
    }
  }
}
