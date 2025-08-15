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

      // Normalize code to support both short (HTL002-1234) and long (HTL002-NAME-1234) formats
      const normalized = (accessCode || '').trim().toUpperCase();
      const parts = normalized.split('-').filter(Boolean);
      const codeHotelPart = parts[0] || hotelCode;
      const suffix = parts.length >= 3 ? parts[2] : (parts[1] || '');
      const isShort = parts.length === 2;
      const isLong = parts.length >= 3;
      const shortVariant = codeHotelPart && suffix ? `${codeHotelPart}-${suffix}` : normalized;

      // 1) Try exact match in housekeeper_access_codes
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
        .eq('access_code', normalized)
        .eq('hotel_id', hotel.id)
        .eq('is_active', true)
        .maybeSingle();

      console.log('🔍 Recherche (exact) dans housekeeper_access_codes:', { accessCodeData, codeError });

      // 2) If not found and short format, try pattern HTLXXX-%-SUFFIX
      if (!accessCodeData && isShort && codeHotelPart && suffix) {
        console.log('🔄 Recherche (pattern court) dans housekeeper_access_codes');
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
          .eq('is_active', true)
          .ilike('access_code', `${codeHotelPart}-%-${suffix}`)
          .limit(1);
        if (!patternErr && patternCodes && patternCodes.length > 0) {
          accessCodeData = patternCodes[0] as any;
          codeError = null as any;
        }
      }

      // 3) If not found and long format, try short variant HTLXXX-SUFFIX
      if (!accessCodeData && isLong && shortVariant) {
        console.log('🔄 Recherche (variante courte) dans housekeeper_access_codes');
        const { data: shortCodes, error: shortErr } = await supabase
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
          .eq('is_active', true)
          .eq('access_code', shortVariant)
          .limit(1);
        if (!shortErr && shortCodes && shortCodes.length > 0) {
          accessCodeData = shortCodes[0] as any;
          codeError = null as any;
        }
      }

      // 4) If still not found, search directly in housekeepers table
      if (!accessCodeData) {
        console.log('🔄 Recherche dans housekeepers...');
        // 4a) Exact
        const { data: hkExact, error: hkExactErr } = await supabase
          .from('housekeepers')
          .select('*')
          .eq('access_code', normalized)
          .eq('hotel_id', hotel.id)
          .eq('is_active', true)
          .maybeSingle();

        if (hkExact && !hkExactErr) {
          accessCodeData = {
            id: 'mock-' + hkExact.id,
            access_code: normalized,
            hotel_id: hotel.id,
            housekeeper_id: hkExact.id,
            is_active: hkExact.is_active,
            created_at: new Date().toISOString(),
            created_by: null,
            expires_at: null,
            used_at: null,
            housekeepers: hkExact
          } as any;
        }

        // 4b) Short pattern
        if (!accessCodeData && isShort && codeHotelPart && suffix) {
          const { data: hkList, error: hkListErr } = await supabase
            .from('housekeepers')
            .select('*')
            .eq('hotel_id', hotel.id)
            .eq('is_active', true)
            .ilike('access_code', `${codeHotelPart}-%-${suffix}`)
            .limit(1);
          if (!hkListErr && hkList && hkList.length > 0) {
            const hk = hkList[0];
            accessCodeData = {
              id: 'mock-' + hk.id,
              access_code: hk.access_code,
              hotel_id: hotel.id,
              housekeeper_id: hk.id,
              is_active: hk.is_active,
              created_at: new Date().toISOString(),
              created_by: null,
              expires_at: null,
              used_at: null,
              housekeepers: hk
            } as any;
          }
        }

        // 4c) Long provided, try short variant
        if (!accessCodeData && isLong && shortVariant) {
          const { data: hkShort, error: hkShortErr } = await supabase
            .from('housekeepers')
            .select('*')
            .eq('hotel_id', hotel.id)
            .eq('is_active', true)
            .eq('access_code', shortVariant)
            .limit(1);
          if (!hkShortErr && hkShort && hkShort.length > 0) {
            const hk = hkShort[0];
            accessCodeData = {
              id: 'mock-' + hk.id,
              access_code: hk.access_code,
              hotel_id: hotel.id,
              housekeeper_id: hk.id,
              is_active: hk.is_active,
              created_at: new Date().toISOString(),
              created_by: null,
              expires_at: null,
              used_at: null,
              housekeepers: hk
            } as any;
          }
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
