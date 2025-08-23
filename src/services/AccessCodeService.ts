import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AccessCode {
  id: string;
  access_code: string;
  housekeeper_name?: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  used_at?: string;
  hotel_id: string;
}

class AccessCodeServiceClass {
  
  // Générer un code d'accès permanent (sans expiration)
  async generatePermanentCode(hotelId: string, housekeeperName?: string): Promise<string> {
    try {
      const { data: accessCode, error } = await supabase
        .rpc('generate_permanent_access_code', {
          p_hotel_id: hotelId,
          p_housekeeper_name: housekeeperName
        });

      if (error) throw error;

      toast({
        title: "Code d'accès généré",
        description: `Code permanent: ${accessCode}`,
      });

      return accessCode;
    } catch (error) {
      console.error('Erreur génération code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le code d'accès"
      });
      throw error;
    }
  }

  // Régénérer tous les codes pour un hôtel
  async regenerateAllCodes(hotelId: string): Promise<{name: string, code: string}[]> {
    try {
      const { data: results, error } = await supabase
        .rpc('regenerate_housekeeper_codes', {
          p_hotel_id: hotelId
        });

      if (error) throw error;

      toast({
        title: "Codes régénérés",
        description: `${results?.length || 0} codes mis à jour`
      });

      return (results || []).map((r: any) => ({ 
        name: r.housekeeper_name, 
        code: r.new_code 
      }));
    } catch (error) {
      console.error('Erreur régénération codes:', error);
      toast({
        variant: "destructive", 
        title: "Erreur",
        description: "Impossible de régénérer les codes"
      });
      throw error;
    }
  }

  // Authentifier avec un code d'accès
  async authenticateWithCode(accessCode: string) {
    try {
      const { data: result, error } = await supabase
        .rpc('authenticate_housekeeper_by_code', {
          p_access_code: accessCode.trim().toUpperCase()
        });

      if (error) throw error;

      const authResult = Array.isArray(result) ? result[0] : result;

      if (!authResult?.success) {
        throw new Error('Code d\'accès invalide');
      }

      return {
        success: true,
        hotel: {
          id: authResult.hotel_id,
          name: authResult.hotel_name,
          code: authResult.hotel_code
        },
        housekeeper: {
          id: authResult.housekeeper_id,
          name: authResult.housekeeper_name
        },
        accessCode: authResult.resolved_access_code,
        source: authResult.code_source
      };
    } catch (error) {
      console.error('Erreur authentification:', error);
      throw error;
    }
  }

  // Valider qu'un code existe et est actif
  async validateCode(accessCode: string): Promise<boolean> {
    try {
      const result = await this.authenticateWithCode(accessCode);
      return result.success;
    } catch (error) {
      return false;
    }
  }

  // Récupérer tous les codes actifs pour un hôtel
  async getActiveCodes(hotelId: string): Promise<AccessCode[]> {
    try {
      const { data: codes, error } = await supabase
        .from('housekeeper_access_codes')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return codes || [];
    } catch (error) {
      console.error('Erreur récupération codes:', error);
      return [];
    }
  }

  // Désactiver un code d'accès
  async deactivateCode(codeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('housekeeper_access_codes')
        .update({ is_active: false })
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "Code désactivé",
        description: "Le code d'accès a été désactivé"
      });
    } catch (error) {
      console.error('Erreur désactivation code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de désactiver le code"
      });
      throw error;
    }
  }

  // Réactiver un code d'accès
  async reactivateCode(codeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('housekeeper_access_codes')
        .update({ is_active: true })
      .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "Code réactivé",
        description: "Le code d'accès a été réactivé"
      });
    } catch (error) {
      console.error('Erreur réactivation code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de réactiver le code"
      });
      throw error;
    }
  }

  // Générer QR Code pour un code d'accès
  generateQRCodeUrl(accessCode: string, hotelCode: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/mobile?code=${accessCode}&hotel=${hotelCode}`;
  }

  // Créer des codes manquants pour femmes de chambre existantes
  async createMissingCodes(hotelId: string): Promise<number> {
    try {
      // Récupérer femmes de chambre sans codes actifs
      const { data: housekeepers, error: hkError } = await supabase
        .from('housekeepers')
        .select(`
          id, name, access_code,
          housekeeper_access_codes!left(id, is_active)
        `)
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      if (hkError) throw hkError;

      let created = 0;
      
      for (const hk of housekeepers || []) {
        const hasActiveCode = hk.housekeeper_access_codes?.some((code: any) => code.is_active);
        
        if (!hasActiveCode) {
          await this.generatePermanentCode(hotelId, hk.name);
          created++;
        }
      }

      if (created > 0) {
        toast({
          title: "Codes créés",
          description: `${created} codes d'accès générés`
        });
      }

      return created;
    } catch (error) {
      console.error('Erreur création codes manquants:', error);
      throw error;
    }
  }

  // Copier un code dans le presse-papier
  async copyCodeToClipboard(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Code copié",
        description: "Code d'accès copié dans le presse-papier"
      });
    } catch (error) {
      // Fallback pour anciens navigateurs
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: "Code copié",
        description: "Code d'accès copié dans le presse-papier"
      });
    }
  }

  // Statistiques des codes
  async getCodeStats(hotelId: string) {
    try {
      const { data: stats, error } = await supabase
        .from('housekeeper_access_codes')
        .select('is_active, expires_at, used_at')
        .eq('hotel_id', hotelId);

      if (error) throw error;

      const active = stats?.filter(s => s.is_active).length || 0;
      const expired = stats?.filter(s => s.expires_at && new Date(s.expires_at) < new Date()).length || 0;
      const used = stats?.filter(s => s.used_at).length || 0;
      const total = stats?.length || 0;

      return { active, expired, used, total };
    } catch (error) {
      console.error('Erreur statistiques codes:', error);
      return { active: 0, expired: 0, used: 0, total: 0 };
    }
  }
}

export const AccessCodeService = new AccessCodeServiceClass();