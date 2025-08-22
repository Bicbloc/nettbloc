import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AccessCodeInfo {
  id: string;
  access_code: string;
  housekeeper_id?: string;
  housekeeper_name?: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  used_at?: string;
}

export class AccessCodeManagementService {
  // Fix hotel code inconsistencies
  static async fixHotelCodeConsistency(hotelId: string): Promise<void> {
    try {
      // Get hotel info
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', hotelId)
        .single();

      if (hotelError || !hotel) {
        throw new Error('Hôtel non trouvé');
      }

      // Ensure hotel has a code
      if (!hotel.hotel_code) {
        const { error: updateError } = await supabase
          .from('hotels')
          .update({ hotel_code: this.generateHotelCode() })
          .eq('id', hotelId);

        if (updateError) {
          throw new Error('Impossible de générer le code hôtel');
        }
      }

      console.log('✅ Code hôtel vérifié:', hotel.hotel_code);
    } catch (error) {
      console.error('❌ Erreur fixation code hôtel:', error);
      throw error;
    }
  }

  // Generate missing access codes for all housekeepers
  static async generateMissingAccessCodes(hotelId: string): Promise<number> {
    try {
      // Get hotel
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', hotelId)
        .single();

      if (hotelError || !hotel) {
        throw new Error('Hôtel non trouvé');
      }

      // Get all housekeepers without access codes
      const { data: housekeepers, error: hkError } = await supabase
        .from('housekeepers')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      if (hkError) {
        throw new Error('Impossible de récupérer les femmes de chambre');
      }

      if (!housekeepers || housekeepers.length === 0) {
        return 0;
      }

      let generated = 0;

      for (const housekeeper of housekeepers) {
        // Check if housekeeper already has an active access code
        const { data: existingCode, error: codeError } = await supabase
          .from('housekeeper_access_codes')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('housekeeper_id', housekeeper.id)
          .eq('is_active', true)
          .maybeSingle();

        if (codeError) {
          console.error('Erreur vérification code existant:', codeError);
          continue;
        }

        // Generate code if none exists or if housekeeper.access_code is empty
        if (!existingCode && !housekeeper.access_code) {
          try {
            const { data: newCode, error: generateError } = await supabase
              .rpc('generate_housekeeper_access_code', {
                p_hotel_id: hotelId,
                p_housekeeper_id: housekeeper.id
              });

            if (generateError) {
              console.error('Erreur génération code:', generateError);
              continue;
            }

            // Update housekeeper record with the new code
            const { error: updateError } = await supabase
              .from('housekeepers')
              .update({ access_code: newCode })
              .eq('id', housekeeper.id);

            if (updateError) {
              console.error('Erreur mise à jour femme de chambre:', updateError);
              continue;
            }

            generated++;
            console.log('✅ Code généré pour', housekeeper.name, ':', newCode);
          } catch (error) {
            console.error('Erreur génération pour', housekeeper.name, ':', error);
          }
        }
      }

      return generated;
    } catch (error) {
      console.error('❌ Erreur génération codes manquants:', error);
      throw error;
    }
  }

  // Get all access codes for a hotel with housekeeper info
  static async getHotelAccessCodes(hotelId: string): Promise<AccessCodeInfo[]> {
    try {
      const { data: codes, error } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          housekeepers (
            id,
            name
          )
        `)
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error('Impossible de récupérer les codes d\'accès');
      }

      return (codes || []).map(code => ({
        id: code.id,
        access_code: code.access_code,
        housekeeper_id: code.housekeeper_id,
        housekeeper_name: code.housekeepers?.name,
        is_active: code.is_active,
        created_at: code.created_at,
        expires_at: code.expires_at,
        used_at: code.used_at
      }));
    } catch (error) {
      console.error('❌ Erreur récupération codes:', error);
      throw error;
    }
  }

  // Get housekeepers with their access codes
  static async getHousekeepersWithCodes(hotelId: string): Promise<any[]> {
    try {
      const { data: housekeepers, error } = await supabase
        .from('housekeepers')
        .select(`
          *,
          housekeeper_access_codes!inner (
            access_code,
            is_active,
            created_at,
            used_at
          )
        `)
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      if (error) {
        console.error('Erreur récupération femmes de chambre:', error);
        return [];
      }

      return housekeepers || [];
    } catch (error) {
      console.error('❌ Erreur récupération femmes de chambre avec codes:', error);
      return [];
    }
  }

  // Generate hotel code
  private static generateHotelCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'HTL';
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Deactivate access code
  static async deactivateAccessCode(codeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('housekeeper_access_codes')
        .update({ is_active: false })
        .eq('id', codeId);

      if (error) {
        throw new Error('Impossible de désactiver le code');
      }
    } catch (error) {
      console.error('❌ Erreur désactivation code:', error);
      throw error;
    }
  }

  // Copy code to clipboard
  static async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copié !",
        description: "Code copié dans le presse-papier"
      });
    } catch (error) {
      console.error('Erreur copie:', error);
      toast({
        title: "Erreur",
        description: "Impossible de copier le code",
        variant: "destructive"
      });
    }
  }
}
