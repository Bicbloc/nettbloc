import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Assignment {
  id: string;
  hotel_id: string;
  room_id: string;
  housekeeper_id: string | null;
  housekeeper_name: string;
  status: string;
  assigned_at: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  estimated_duration?: number;
  actual_duration?: number;
}

/**
 * Service centralisé pour gérer toutes les opérations d'assignation
 * avec persistance dans Supabase
 */
export class AssignmentService {
  /**
   * Créer une nouvelle assignation de chambre à une femme de chambre
   * Utilise le nom exact de la base de données pour assurer la cohérence
   */
  static async assignRoom(
    hotelId: string,
    roomId: string,
    housekeeperId: string | null,
    housekeeperName: string,
    notes?: string
  ): Promise<{ success: boolean; assignmentId?: string; error?: string }> {
    try {
      console.log('🔄 Assignation chambre:', { hotelId, roomId, housekeeperId, housekeeperName });

      // 1. Vérifier si une assignation active existe déjà pour cette chambre
      const { data: existingAssignment } = await supabase
        .from('assignments')
        .select('id, housekeeper_name, status')
        .eq('hotel_id', hotelId)
        .eq('room_id', roomId)
        .in('status', ['assigned', 'in_progress'])
        .maybeSingle();

      // Récupérer le nom EXACT depuis la base de données pour cohérence
      let exactHousekeeperName = housekeeperName.trim();
      
      if (housekeeperId) {
        const { data: hkData } = await supabase
          .from('housekeepers')
          .select('name, user_id')
          .eq('id', housekeeperId)
          .maybeSingle();
        
        if (hkData) {
          exactHousekeeperName = hkData.name;
          console.log('✅ Nom exact récupéré:', exactHousekeeperName);
        }
      }

      // 2. Si une assignation existe, la mettre à jour (réassigner)
      if (existingAssignment) {
        console.log('📝 Assignation existante trouvée, mise à jour:', existingAssignment.id);
        
        const { data, error } = await supabase
          .from('assignments')
          .update({
            housekeeper_id: housekeeperId,
            housekeeper_name: exactHousekeeperName,
            assigned_at: new Date().toISOString(),
            notes: notes
          })
          .eq('id', existingAssignment.id)
          .select()
          .single();

        if (error) {
          console.error('❌ Erreur mise à jour assignation:', error);
          return { success: false, error: error.message };
        }

        console.log('✅ Assignation mise à jour:', data.id);
        return { success: true, assignmentId: data.id };
      }

      // 3. Sinon, créer une nouvelle assignation
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          hotel_id: hotelId,
          room_id: roomId,
          housekeeper_id: housekeeperId,
          housekeeper_name: exactHousekeeperName,
          status: 'assigned',
          notes: notes,
          estimated_duration: 30
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur assignation:', error);
        toast({
          variant: "destructive",
          title: "Erreur d'assignation",
          description: error.message
        });
        return { success: false, error: error.message };
      }

      console.log('✅ Assignation créée:', data.id);

      // Récupérer le numéro de chambre pour la notification
      const { data: roomData } = await supabase
        .from('rooms')
        .select('room_number')
        .eq('id', roomId)
        .maybeSingle();

      // Créer une notification pour la femme de chambre
      await supabase.from('notifications').insert({
        hotel_id: hotelId,
        title: '🆕 Nouvelle chambre assignée',
        description: `La chambre ${roomData?.room_number || 'N/A'} vous a été assignée`,
        type: 'room_assigned',
        housekeeper_name: housekeeperName,
        room_number: roomData?.room_number,
        user_type: 'housekeeper'
      });

      return { success: true, assignmentId: data.id };
    } catch (error: any) {
      console.error('❌ Erreur assignation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Désassigner une chambre (supprimer l'assignation)
   */
  static async unassignRoom(assignmentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) {
        console.error('❌ Erreur désassignation:', error);
        toast({
          variant: "destructive",
          title: "Erreur de désassignation",
          description: error.message
        });
        return false;
      }

      console.log('✅ Assignation supprimée:', assignmentId);
      return true;
    } catch (error) {
      console.error('❌ Erreur désassignation:', error);
      return false;
    }
  }

  /**
   * Réassigner une chambre à une nouvelle femme de chambre
   */
  static async reassignRoom(
    assignmentId: string,
    newHousekeeperId: string | null,
    newHousekeeperName: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({
          housekeeper_id: newHousekeeperId,
          housekeeper_name: newHousekeeperName,
          assigned_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) {
        console.error('❌ Erreur réassignation:', error);
        toast({
          variant: "destructive",
          title: "Erreur de réassignation",
          description: error.message
        });
        return false;
      }

      console.log('✅ Assignation mise à jour:', assignmentId);
      return true;
    } catch (error) {
      console.error('❌ Erreur réassignation:', error);
      return false;
    }
  }

  /**
   * Récupérer toutes les assignations d'un hôtel
   */
  static async getAssignmentsForHotel(hotelId: string): Promise<Assignment[]> {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur chargement assignations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Erreur chargement assignations:', error);
      return [];
    }
  }

  /**
   * Récupérer les assignations d'une femme de chambre spécifique
   */
  static async getAssignmentsForHousekeeper(
    hotelId: string,
    housekeeperId: string
  ): Promise<Assignment[]> {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('housekeeper_id', housekeeperId)
        .eq('status', 'assigned')
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur chargement assignations femme de chambre:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Erreur chargement assignations femme de chambre:', error);
      return [];
    }
  }

  /**
   * Mettre à jour le statut d'une assignation
   */
  static async updateAssignmentStatus(
    assignmentId: string,
    status: 'assigned' | 'in_progress' | 'completed',
    additionalData?: {
      started_at?: string;
      completed_at?: string;
      actual_duration?: number;
    }
  ): Promise<boolean> {
    try {
      const updateData: any = { status };
      
      if (additionalData?.started_at) updateData.started_at = additionalData.started_at;
      if (additionalData?.completed_at) updateData.completed_at = additionalData.completed_at;
      if (additionalData?.actual_duration) updateData.actual_duration = additionalData.actual_duration;

      const { error } = await supabase
        .from('assignments')
        .update(updateData)
        .eq('id', assignmentId);

      if (error) {
        console.error('❌ Erreur mise à jour statut:', error);
        return false;
      }

      console.log('✅ Statut assignation mis à jour:', assignmentId, status);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      return false;
    }
  }
}
