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
  // Authentification avec code complet en s'alignant sur la fonction SQL authenticate_housekeeper_by_code
  static async authenticateWithFullCode(accessCode: string): Promise<HousekeeperAuthResult> {
    console.log('🔐 Authentification (RPC) avec code complet:', accessCode);

    try {
      // Validation basique
      if (!accessCode || accessCode.trim().length < 8) {
        return {
          success: false,
          error: "Code d'accès invalide (trop court)",
          debugInfo: { providedCode: accessCode }
        };
      }

      const normalized = accessCode.trim().toUpperCase();

      // Utiliser la fonction SQL centralisée
      console.log('📞 Appel RPC authenticate_housekeeper_by_code avec:', normalized);
      const { data, error } = await supabase.rpc('authenticate_housekeeper_by_code', {
        p_access_code: normalized
      });

      console.log('📊 Réponse RPC brute:', { data, error });

      if (error) {
        console.error('💥 Erreur RPC authenticate_housekeeper_by_code:', error);

        // Fallback spécifique si la fonction SQL a un bug de colonne ("hotel id" au lieu de "hotel_id")
        if (error.message && error.message.toLowerCase().includes('hotel id')) {
          console.warn('⚠️ Erreur de colonne dans la fonction RPC, fallback via requête directe sur les tables');

          const { data: codeRecord, error: fallbackError } = await supabase
            .from('housekeeper_access_codes')
            .select(`
              id,
              access_code,
              hotel_id,
              housekeeper_id,
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
            .eq('access_code', normalized)
            .eq('is_active', true)
            .maybeSingle();

          if (fallbackError || !codeRecord) {
            console.error('❌ Fallback direct échoué:', { fallbackError, codeRecord });
            return {
              success: false,
              error: "Code d'accès introuvable ou inactif (fallback)",
              debugInfo: { fallbackError, codeRecord, normalized }
            };
          }

          const hotel = {
            id: (codeRecord as any).hotels?.id,
            name: (codeRecord as any).hotels?.name,
            hotel_code: (codeRecord as any).hotels?.hotel_code,
          };

          const housekeeper = {
            id: (codeRecord as any).housekeepers?.id,
            name: (codeRecord as any).housekeepers?.name,
            access_code: (codeRecord as any).access_code,
            hotel_id: (codeRecord as any).hotel_id,
            is_active: (codeRecord as any).housekeepers?.is_active ?? true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id: 'housekeeper_fallback',
            is_temporary: false,
            role_id: null
          };

          console.log('✅ Authentification réussie via fallback direct:', { hotel, housekeeper });

          return {
            success: true,
            user: housekeeper,
            hotel,
            debugInfo: { source: 'fallback_query', hotel, housekeeper, raw: codeRecord }
          };
        }

        return {
          success: false,
          error: `Erreur RPC: ${error.message}`,
          debugInfo: { error, normalized }
        };
      }

      const result = (data as any)?.[0];

      console.log('📊 Résultat RPC authenticate_housekeeper_by_code:', result);

      if (!result || !result.success) {
        return {
          success: false,
          error: `Code d'accès "${accessCode}" introuvable ou inactif`,
          debugInfo: { accessCode: normalized, rpcResult: data }
        };
      }

      // Construire les objets hotel et housekeeper compatibles avec le reste de l'app
      const hotel = {
        id: result.hotel_id,
        name: result.hotel_name,
        hotel_code: result.hotel_code
      };

      const housekeeper = {
        id: result.housekeeper_id,
        name: result.housekeeper_name,
        access_code: result.resolved_access_code,
        hotel_id: result.hotel_id,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'housekeeper_rpc',
        is_temporary: false,
        role_id: null
      };

      console.log('✅ Authentification réussie via RPC:', { hotel, housekeeper, code_source: result.code_source });

      return {
        success: true,
        user: housekeeper,
        hotel: hotel,
        debugInfo: { raw: result, hotel, housekeeper }
      };
    } catch (error) {
      console.error('💥 Erreur inattendue authenticateWithFullCode:', error);
      return {
        success: false,
        error: "Erreur lors de l'authentification",
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
      return { success: false, error: "Erreur lors de la recherche de l'hôtel", debugInfo: { error } };
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
