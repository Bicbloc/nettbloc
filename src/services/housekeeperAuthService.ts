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
  // Authenticate with full access code using secure RPC
  static async authenticateWithFullCode(accessCode: string): Promise<HousekeeperAuthResult> {
    console.log('🔐 Authentification avec code complet:', accessCode);
    
    try {
      // Validate code format
      if (!accessCode || accessCode.length < 5) {
        return {
          success: false,
          error: 'Code d\'accès invalide (trop court)',
          debugInfo: { providedCode: accessCode }
        };
      }

      // Use the secure RPC function to authenticate
      const { data: authResult, error: rpcError } = await supabase
        .rpc('authenticate_housekeeper_by_code', {
          p_access_code: accessCode
        });

      if (rpcError) {
        console.error('❌ Erreur RPC authentification:', rpcError);
        return {
          success: false,
          error: 'Erreur lors de l\'authentification',
          debugInfo: { rpcError }
        };
      }

      if (!authResult || authResult.length === 0) {
        console.error('❌ Aucun résultat RPC');
        return {
          success: false,
          error: 'Erreur inattendue lors de l\'authentification',
          debugInfo: { authResult }
        };
      }

      const result = authResult[0];
      console.log('🔍 Résultat RPC authentification:', result);

      if (!result.success) {
        console.error('❌ Authentification échouée:', result);
        
        // Message d'erreur plus clair selon le contexte
        let errorMessage = 'Code d\'accès invalide ou expiré';
        if (result.hotel_id && result.hotel_name) {
          errorMessage = `Code d'accès non trouvé pour l'hôtel "${result.hotel_name}". Vérifiez que le code est correct et actif.`;
        } else if (accessCode.includes('-')) {
          const hotelCode = accessCode.split('-')[0];
          errorMessage = `Hôtel non trouvé avec le code "${hotelCode}". Vérifiez le code auprès de votre administration.`;
        } else {
          errorMessage = 'Format de code d\'accès invalide. Le code doit contenir le code hôtel suivi d\'un tiret.';
        }
        
        return {
          success: false,
          error: errorMessage,
          debugInfo: { 
            accessCode,
            rpcResult: result,
            hotelFound: !!result.hotel_id,
            hotelCode: accessCode.split('-')[0]
          }
        };
      }

      // Success - construct response
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
        is_active: true
      };

      console.log('✅ Authentification RPC réussie:', { hotel, housekeeper });

      return {
        success: true,
        user: housekeeper,
        hotel: hotel,
        debugInfo: { 
          rpcResult: result,
          codeSource: result.code_source
        }
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
