import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface PermanentAccessCode {
  id: string;
  access_code: string;
  housekeeper_name?: string;
  is_active: boolean;
  created_at: string;
  used_at?: string;
}

export class PermanentAccessCodeService {
  /**
   * Generate a permanent access code (no expiration)
   */
  static async generatePermanentCode(hotelId: string, housekeeperName?: string): Promise<string> {
    try {
      const { data: newCode, error } = await supabase
        .rpc('generate_permanent_access_code', {
          p_hotel_id: hotelId,
          p_housekeeper_name: housekeeperName
        });

      if (error) {
        console.error('Erreur génération code permanent:', error);
        throw new Error('Impossible de générer le code d\'accès');
      }

      console.log('✅ Code permanent généré:', newCode);
      
      toast({
        title: "Code généré",
        description: `Code d'accès permanent: ${newCode}`,
      });

      return newCode;
    } catch (error) {
      console.error('❌ Erreur service génération code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le code d'accès"
      });
      throw error;
    }
  }

  /**
   * Regenerate codes for all existing housekeepers
   */
  static async regenerateAllCodes(hotelId: string): Promise<{name: string, code: string}[]> {
    try {
      const { data: results, error } = await supabase
        .rpc('regenerate_housekeeper_codes', {
          p_hotel_id: hotelId
        });

      if (error) {
        console.error('Erreur régénération codes:', error);
        throw new Error('Impossible de régénérer les codes');
      }

      console.log('✅ Codes régénérés:', results);
      
      toast({
        title: "Codes régénérés",
        description: `${results?.length || 0} codes ont été régénérés avec succès`,
      });

      return (results || []).map(result => ({
        name: result.housekeeper_name,
        code: result.new_code
      }));
    } catch (error) {
      console.error('❌ Erreur régénération codes:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de régénérer les codes d'accès"
      });
      throw error;
    }
  }

  /**
   * Get all permanent access codes for a hotel
   */
  static async getPermanentCodes(hotelId: string): Promise<PermanentAccessCode[]> {
    try {
      const { data: codes, error } = await supabase
        .from('housekeeper_access_codes')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur récupération codes:', error);
        return [];
      }

      return (codes || []).map(code => ({
        id: code.id,
        access_code: code.access_code,
        housekeeper_name: code.invited_name,
        is_active: code.is_active,
        created_at: code.created_at,
        used_at: code.used_at
      }));
    } catch (error) {
      console.error('❌ Erreur récupération codes permanents:', error);
      return [];
    }
  }

  /**
   * Create codes for housekeepers without them
   */
  static async createMissingCodes(hotelId: string): Promise<number> {
    try {
      // Get housekeepers without codes
      const { data: housekeepers, error } = await supabase
        .from('housekeepers')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .or('access_code.is.null,access_code.eq.');

      if (error) {
        console.error('Erreur récupération femmes de chambre:', error);
        return 0;
      }

      if (!housekeepers || housekeepers.length === 0) {
        return 0;
      }

      let created = 0;
      for (const housekeeper of housekeepers) {
        try {
          const newCode = await this.generatePermanentCode(hotelId, housekeeper.name);
          
          // Update housekeeper record with new code
          await supabase
            .from('housekeepers')
            .update({ access_code: newCode })
            .eq('id', housekeeper.id);

          created++;
        } catch (error) {
          console.error('Erreur création code pour', housekeeper.name, ':', error);
        }
      }

      return created;
    } catch (error) {
      console.error('❌ Erreur création codes manquants:', error);
      return 0;
    }
  }

  /**
   * Copy code to clipboard with enhanced feedback
   */
  static async copyCodeToClipboard(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Code copié !",
        description: `${code} copié dans le presse-papier`,
      });
    } catch (error) {
      console.error('Erreur copie:', error);
      
      // Fallback: try manual selection
      try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        toast({
          title: "Code copié !",
          description: `${code} copié dans le presse-papier`,
        });
      } catch (fallbackError) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de copier le code",
        });
      }
    }
  }

  /**
   * Reactivate a deactivated code
   */
  static async reactivateCode(codeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('housekeeper_access_codes')
        .update({ is_active: true })
        .eq('id', codeId);

      if (error) {
        throw new Error('Impossible de réactiver le code');
      }

      toast({
        title: "Code réactivé",
        description: "Le code d'accès a été réactivé avec succès",
      });
    } catch (error) {
      console.error('❌ Erreur réactivation code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de réactiver le code d'accès"
      });
      throw error;
    }
  }
}
