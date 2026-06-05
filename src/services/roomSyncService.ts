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

      // Trouver l'ID de la chambre dans la base
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('hotel_id', hotelId)
        .eq('room_number', room.number)
        .single();

      if (!existingRoom) {
        return false;
      }

      const previousStatus = existingRoom.status;

      // Construire l'objet de mise à jour avec tous les champs pertinents
      // IMPORTANT: `checkout` / `ready-to-clean` = vrai signal manuel "Client sorti"
      // et doivent être conservés tels quels. Sinon le bouton côté établissement
      // semble s'annuler tout seul et la femme de chambre ne reçoit jamais l'info.
      const safeStatus = room.status;
      
      const updateData: any = {
        status: safeStatus,
        // Ne PAS toucher aux notes - elles sont gérées manuellement par le client
        is_twin: room.isTwin || false,
        updated_at: new Date().toISOString()
      };

      // Ajouter cleaning_type selon cleaningType (normaliser a_blanc→full, recouche→quick)
      if (room.cleaningType === 'full' || room.cleaningType === 'a_blanc') {
        updateData.cleaning_type = 'a_blanc';
      } else if (room.cleaningType === 'quick' || room.cleaningType === 'recouche') {
        updateData.cleaning_type = 'recouche';
      } else if (room.cleaningType === 'none') {
        updateData.cleaning_type = 'none';
      }

      // Mettre à jour last_cleaned_at si la chambre est propre
      if (room.status === 'clean') {
        updateData.last_cleaned_at = new Date().toISOString();
      } else if (room.status === 'ready-to-clean' || room.status === 'checkout') {
        updateData.cleaning_type = 'a_blanc';
      }

      const { error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', existingRoom.id);

      if (error) {
        console.error('❌ Erreur synchronisation chambre:', error);
        return false;
      }

      // Répercuter aussi les mises à jour provenant du compte établissement
      // (RoomCard/useRoomManagement) vers Apaleo, pas seulement updateStatus().
      if (previousStatus !== safeStatus) {
        RoomSyncService.pushStatusToApaleo(hotelId, room.number, safeStatus);
      }

      // Logger le changement de statut si pertinent
      if (previousStatus !== room.status && actorName) {
        if (room.status === 'clean') {
          await ActionLogService.logCleaningEnd(hotelId, room.number, actorName);
        } else if (room.status === 'needs-cleaning' && previousStatus !== 'needs-cleaning') {
          // Potentiel début de nettoyage
        }
      }

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
      } else if (status === 'ready-to-clean' || status === 'checkout') {
        updateData.cleaning_type = 'a_blanc';
      }

      const { error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', room.id);

      if (error) {
        console.error('❌ Erreur mise à jour statut:', error);
        return false;
      }

      // Répercuter le statut (propre/sale) vers le PMS Apaleo (best-effort)
      RoomSyncService.pushStatusToApaleo(hotelId, roomNumber, status);

      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      return false;
    }
  }

  /**
   * Enfile un statut de chambre dans la file de synchro PMS puis déclenche un
   * traitement immédiat (best-effort). Public : utilisable par l'inspection
   * gouvernante pour pousser l'état "inspected"/"needs-cleaning" vers le PMS.
   */
  static pushStatusToPms(hotelId: string, roomNumber: string, status: string): void {
    RoomSyncService.pushStatusToApaleo(hotelId, roomNumber, status);
  }

  /**
   * Enfile le statut de la chambre (propre/sale) dans la file de synchro PMS,
   * puis déclenche un traitement immédiat (best-effort). Si l'envoi échoue,
   * l'entrée reste dans la file et sera retentée automatiquement (backoff).
   */
  private static pushStatusToApaleo(hotelId: string, roomNumber: string, status: string): void {
    supabase
      .from('pms_sync_queue')
      .insert({ hotel_id: hotelId, room_number: roomNumber, status })
      .then(({ error }) => {
        if (error) {
          console.warn('⚠️ Enfilement synchro PMS échoué:', error.message);
          return;
        }
        // Déclencher un traitement immédiat sans bloquer le flux principal
        supabase.functions
          .invoke('pms-sync-queue-process', { body: {} })
          .then(({ error: procError }) => {
            if (procError) {
              console.warn('⚠️ Traitement file PMS échoué (sera retenté):', procError.message);
            }
          })
          .catch((e) => console.warn('⚠️ Traitement file PMS échoué (sera retenté):', e));
      });
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

      const results = await Promise.all(
        rooms.map(room => this.syncRoom(hotelId, room))
      );

      const successCount = results.filter(r => r).length;

      return successCount === rooms.length;
    } catch (error) {
      console.error('❌ Erreur synchronisation batch:', error);
      return false;
    }
  }
}
