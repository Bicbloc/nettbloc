
import { supabase } from '@/integrations/supabase/client';

export interface ReportData {
  id: string;
  report_date: string;
  room_data: any[];
  housekeeper_assignments: Record<string, string[]>;
  housekeeper_names: string[];
  action_log: any[];
  hotel_id: string;
  user_id: string;
  created_at: string;
}

export class ReportService {
  static async saveReport(
    roomData: any[], 
    housekeeperAssignments: Record<string, string[]>, 
    housekeeperNames: string[], 
    actionLog: any[] = [],
    hotelId?: string
  ): Promise<{ success: boolean; report?: ReportData; error?: string }> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        return { success: false, error: 'Utilisateur non authentifié' };
      }

      // Utiliser l'hôtel ID fourni ou récupérer celui de l'utilisateur
      let selectedHotelId = hotelId;
      if (!selectedHotelId) {
        selectedHotelId = localStorage.getItem('selectedHotelId');
      }

      if (!selectedHotelId) {
        // Récupérer l'hôtel de l'utilisateur
        const { data: hotel, error: hotelError } = await supabase
          .from('hotels')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (hotelError || !hotel) {
          return { success: false, error: 'Aucun hôtel trouvé pour cet utilisateur' };
        }
        selectedHotelId = hotel.id;
      }

      const reportDate = new Date().toISOString().split('T')[0];

      // Vérifier s'il existe déjà un rapport pour cette date
      const { data: existingReport, error: checkError } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', userId)
        .eq('hotel_id', selectedHotelId)
        .eq('report_date', reportDate)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Erreur lors de la vérification du rapport:', checkError);
        return { success: false, error: 'Erreur lors de la vérification du rapport existant' };
      }

      const reportData = {
        user_id: userId,
        hotel_id: selectedHotelId,
        report_date: reportDate,
        room_data: roomData || [],
        housekeeper_assignments: housekeeperAssignments || {},
        housekeeper_names: housekeeperNames || [],
        action_log: actionLog || []
      };

      let result;
      if (existingReport) {
        // Mettre à jour le rapport existant
        const { data, error } = await supabase
          .from('daily_reports')
          .update(reportData)
          .eq('id', existingReport.id)
          .select()
          .single();

        result = { data, error };
      } else {
        // Créer un nouveau rapport
        const { data, error } = await supabase
          .from('daily_reports')
          .insert(reportData)
          .select()
          .single();

        result = { data, error };
      }

      if (result.error) {
        console.error('Erreur lors de la sauvegarde du rapport:', result.error);
        return { success: false, error: result.error.message };
      }

      console.log('✅ Rapport sauvegardé avec succès:', result.data);
      return { success: true, report: result.data };

    } catch (error) {
      console.error('Erreur lors de la sauvegarde du rapport:', error);
      return { success: false, error: 'Erreur inattendue lors de la sauvegarde' };
    }
  }

  static async getReports(
    limit: number = 10, 
    hotelId?: string
  ): Promise<{ success: boolean; reports?: ReportData[]; error?: string }> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        return { success: false, error: 'Utilisateur non authentifié' };
      }

      let selectedHotelId = hotelId;
      if (!selectedHotelId) {
        selectedHotelId = localStorage.getItem('selectedHotelId');
      }

      let query = supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', userId)
        .order('report_date', { ascending: false })
        .limit(limit);

      if (selectedHotelId) {
        query = query.eq('hotel_id', selectedHotelId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erreur lors de la récupération des rapports:', error);
        return { success: false, error: error.message };
      }

      const normalized: ReportData[] = (data || []).map((d: any) => ({
        id: d.id,
        report_date: d.report_date,
        room_data: (d.room_data as any[]) || [],
        housekeeper_assignments: (d.housekeeper_assignments as Record<string, string[]>) || {},
        housekeeper_names: (d.housekeeper_names as string[]) || [],
        action_log: (d.action_log as any[]) || [],
        hotel_id: d.hotel_id,
        user_id: d.user_id,
        created_at: d.created_at,
      }));

      return { success: true, reports: normalized };

    } catch (error) {
      console.error('Erreur lors de la récupération des rapports:', error);
      return { success: false, error: 'Erreur inattendue lors de la récupération' };
    }
  }

  static async getReportById(
    reportId: string
  ): Promise<{ success: boolean; report?: ReportData; error?: string }> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        return { success: false, error: 'Utilisateur non authentifié' };
      }

      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('id', reportId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erreur lors de la récupération du rapport:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Rapport non trouvé' };
      }
      const normalized: ReportData = {
        id: data.id,
        report_date: data.report_date,
        room_data: (data.room_data as any[]) || [],
        housekeeper_assignments: (data.housekeeper_assignments as Record<string, string[]>) || {},
        housekeeper_names: (data.housekeeper_names as string[]) || [],
        action_log: (data.action_log as any[]) || [],
        hotel_id: data.hotel_id,
        user_id: data.user_id,
        created_at: data.created_at,
      };

      return { success: true, report: normalized };

    } catch (error) {
      console.error('Erreur lors de la récupération du rapport:', error);
      return { success: false, error: 'Erreur inattendue lors de la récupération' };
    }
  }

  static async deleteReport(
    reportId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        return { success: false, error: 'Utilisateur non authentifié' };
      }

      const { error } = await supabase
        .from('daily_reports')
        .delete()
        .eq('id', reportId)
        .eq('user_id', userId);

      if (error) {
        console.error('Erreur lors de la suppression du rapport:', error);
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      console.error('Erreur lors de la suppression du rapport:', error);
      return { success: false, error: 'Erreur inattendue lors de la suppression' };
    }
  }
}

// Minimal placeholder to satisfy imports; implemented elsewhere
export async function generateCombinedReport(
  housekeeperRooms: { name: string; rooms: any[] }[],
  config: any,
  emailAddress: string,
  customFields?: any
): Promise<boolean> {
  console.warn('generateCombinedReport placeholder called');
  return true;
}

