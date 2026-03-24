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
  // Créer une session d'accès pour permettre l'accès aux données via RLS
  private static async createAccessSession(hotelId: string, housekeeperId: string, housekeeperName: string, accessCodeUsed: string): Promise<string | null> {
    try {
      
      // Créer une nouvelle session valide 24h
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      // Générer un token de session unique et plus court
      const sessionToken = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
      
      const { data, error } = await supabase
        .from('hotel_access_sessions')
        .insert({
          hotel_id: hotelId,
          access_code: accessCodeUsed,
          session_token: sessionToken,
          is_active: true,
          expires_at: expiresAt.toISOString(),
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur création session d\'accès:', error);
        // Ne pas bloquer la connexion si la session échoue
      } else {
      }
      
      // TOUJOURS sauvegarder le token localement - c'est notre source de vérité
      localStorage.setItem('housekeeperSessionToken', sessionToken);
      localStorage.setItem('housekeeperSessionExpires', expiresAt.toISOString());
      localStorage.setItem('housekeeperSessionHotelId', hotelId || '');
      localStorage.setItem('housekeeperSessionHousekeeperId', housekeeperId || 'anonymous');
      localStorage.setItem('housekeeperSessionHousekeeperName', housekeeperName || 'Housekeeper');
      
      return sessionToken;
    } catch (err) {
      console.error('💥 Erreur création session:', err);
      return null;
    }
  }
  
  // Vérifier si une session locale est valide
  static isSessionValid(): boolean {
    const expiresAt = localStorage.getItem('housekeeperSessionExpires');
    if (!expiresAt) return false;
    
    const isValid = new Date(expiresAt) > new Date();
    if (!isValid) {
      this.clearSession();
    }
    return isValid;
  }
  
  // Récupérer les données de session locales
  static getLocalSession(): { hotelId: string; housekeeperId: string; housekeeperName: string; sessionToken: string } | null {
    if (!this.isSessionValid()) return null;
    
    const hotelId = localStorage.getItem('housekeeperSessionHotelId');
    const housekeeperId = localStorage.getItem('housekeeperSessionHousekeeperId');
    const housekeeperName = localStorage.getItem('housekeeperSessionHousekeeperName');
    const sessionToken = localStorage.getItem('housekeeperSessionToken');
    
    if (!hotelId || !housekeeperId || !housekeeperName || !sessionToken) return null;
    
    return { hotelId, housekeeperId, housekeeperName, sessionToken };
  }
  
  // Nettoyer la session locale
  static clearSession(): void {
    localStorage.removeItem('housekeeperSessionToken');
    localStorage.removeItem('housekeeperSessionExpires');
    localStorage.removeItem('housekeeperSessionHotelId');
    localStorage.removeItem('housekeeperSessionHousekeeperId');
    localStorage.removeItem('housekeeperSessionHousekeeperName');
    localStorage.removeItem('housekeeper');
    localStorage.removeItem('housekeeperProfile');
    localStorage.removeItem('selectedHotelId');
  }

  // Authentification avec code complet en s'alignant sur la fonction SQL authenticate_housekeeper_by_code
  static async authenticateWithFullCode(accessCode: string): Promise<HousekeeperAuthResult> {

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
      const { data, error } = await supabase.rpc('authenticate_housekeeper_by_code', {
        p_access_code: normalized
      });


      if (error) {
        console.error('💥 Erreur RPC authenticate_housekeeper_by_code:', error);

        // Fallback spécifique si la fonction SQL a un bug de colonne ("hotel id" au lieu de "hotel_id")
        if (error.message && error.message.toLowerCase().includes('hotel id')) {

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
            id: (codeRecord as any).hotels?.id || (codeRecord as any).hotel_id,
            name: (codeRecord as any).hotels?.name || 'Hôtel',
            hotel_code: (codeRecord as any).hotels?.hotel_code || '',
          };

          const housekeeper = {
            id: (codeRecord as any).housekeepers?.id || (codeRecord as any).housekeeper_id || `hk-${Date.now()}`,
            name: (codeRecord as any).housekeepers?.name || (codeRecord as any).invited_name || 'Housekeeper',
            access_code: (codeRecord as any).access_code,
            hotel_id: (codeRecord as any).hotel_id,
            is_active: (codeRecord as any).housekeepers?.is_active ?? true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id: 'housekeeper_fallback',
            is_temporary: false,
            role_id: null
          };


          // Créer une session d'accès pour permettre l'accès aux données via RLS
          await this.createAccessSession(hotel.id, housekeeper.id, housekeeper.name, normalized);

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
        name: result.hotel_name || 'Hôtel',
        hotel_code: result.hotel_code || ''
      };

      const housekeeper = {
        id: result.housekeeper_id || `hk-${Date.now()}`,
        name: result.housekeeper_name || 'Housekeeper',
        access_code: result.resolved_access_code,
        hotel_id: result.hotel_id,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'housekeeper_rpc',
        is_temporary: false,
        role_id: null
      };


      // Créer une session d'accès pour permettre l'accès aux données via RLS
      await this.createAccessSession(hotel.id, housekeeper.id, housekeeper.name, normalized);

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

      return { success: true, hotel, debugInfo: { hotel } };

    } catch (error) {
      console.error('💥 Erreur recherche hôtel:', error);
      return { success: false, error: "Erreur lors de la recherche de l'hôtel", debugInfo: { error } };
    }
  }

  // Test if access code exists and is valid
  static async testAccessCode(accessCode: string): Promise<HousekeeperAuthResult> {
    
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
