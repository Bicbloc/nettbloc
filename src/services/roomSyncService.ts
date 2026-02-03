import { supabase } from "@/integrations/supabase/client";
import { Room } from "@/services/pdfService";
import { toast } from "@/hooks/use-toast";
import { ActionLogService } from "@/services/actionLogService";

/**
 * Service centralisé pour toutes les synchronisations de chambres vers Supabase
 * Assure la cohérence entre état local et base de données
 */
export class RoomSyncService {
  /**
   * Synchroniser une chambre complète vers Supabase
   */
  static async syncRoom(hotelId: string, room: Room, actorName?: string): Promise<boolean> {
    try {
      console.log('🔄 Synchronisation chambre:', { hotelId, roomNumber: room.number, status: room.status });

      // Trouver l'ID de la chambre dans la base
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('hotel_id', hotelId)
        .eq('room_number', room.number)
        .single();

      if (!existingRoom) {
        console.warn('⚠️ Chambre non trouvée en base:', room.number);
        return false;
      }

      const previousStatus = existingRoom.status;

      // Construire l'objet de mise à jour avec tous les champs pertinents
      const updateData: any = {
        status: room.status,
        notes: room.notes || null,
        cleaning_priority: room.isUrgent ? 10 : (room.notUrgent ? 1 : 5),
        is_twin: room.isTwin || false,
        updated_at: new Date().toISOString()
      };

      // Ajouter cleaning_type selon cleaningType
      if (room.cleaningType === 'full') {
        updateData.cleaning_type = 'full';
      } else if (room.cleaningType === 'quick') {
        updateData.cleaning_type = 'quick';
      }

      // Mettre à jour last_cleaned_at si la chambre est propre
      if (room.status === 'clean') {
        updateData.last_cleaned_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', existingRoom.id);

      if (error) {
        console.error('❌ Erreur synchronisation chambre:', error);
        return false;
      }

      // Logger le changement de statut si pertinent
      if (previousStatus !== room.status && actorName) {
        if (room.status === 'clean') {
          await ActionLogService.logCleaningEnd(hotelId, room.number, actorName);
        } else if (room.status === 'needs-cleaning' && previousStatus !== 'needs-cleaning') {
          // Potentiel début de nettoyage
        }
      }

      console.log('✅ Chambre synchronisée:', room.number);
      return true;
    } catch (error) {
      console.error('❌ Erreur synchronisation chambre:', error);
      return false;
    }
  }

  /**
   * Mettre à jour uniquement le statut d'une chambre
   */
  static async updateStatus(
    hotelId: string, 
    roomNumber: string, 
    status: string
  ): Promise<boolean> {
    try {
      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('room_number', roomNumber)
        .single();

      if (!room) return false;

      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'clean') {
        updateData.last_cleaned_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', room.id);

      if (error) {
        console.error('❌ Erreur mise à jour statut:', error);
        return false;
      }

      console.log('✅ Statut mis à jour:', roomNumber, status);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      return false;
    }
  }

  /**
   * Mettre à jour le type de nettoyage (recouche/à blanc)
   */
  static async updateCleaningType(
    hotelId: string,
    roomNumber: string,
    cleaningType: 'full' | 'quick'
  ): Promise<boolean> {
    try {
      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('room_number', roomNumber)
        .single();

      if (!room) return false;

      const { error } = await supabase
        .from('rooms')
        .update({
          cleaning_type: cleaningType,
          status: 'needs-cleaning',
          updated_at: new Date().toISOString()
        })
        .eq('id', room.id);

      if (error) {
        console.error('❌ Erreur mise à jour type nettoyage:', error);
        return false;
      }

      console.log('✅ Type nettoyage mis à jour:', roomNumber, cleaningType);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour type nettoyage:', error);
      return false;
    }
  }

  /**
   * Synchroniser plusieurs chambres en batch
   */
  static async syncMultipleRooms(hotelId: string, rooms: Room[]): Promise<boolean> {
    try {
      console.log('🔄 Synchronisation batch de', rooms.length, 'chambres');

      const results = await Promise.all(
        rooms.map(room => this.syncRoom(hotelId, room))
      );

      const successCount = results.filter(r => r).length;
      console.log(`✅ ${successCount}/${rooms.length} chambres synchronisées`);

      return successCount === rooms.length;
    } catch (error) {
      console.error('❌ Erreur synchronisation batch:', error);
      return false;
    }
  }
}
