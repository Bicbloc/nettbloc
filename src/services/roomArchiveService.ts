import { supabase } from '@/integrations/supabase/client';

/**
 * Service pour archiver et réinitialiser les chambres lors de la clôture de journée
 */
export class RoomArchiveService {
  /**
   * Archive les chambres du jour et réinitialise les statuts
   */
  static async archiveAndResetRooms(hotelId: string): Promise<{
    archived: number;
    reset: number;
    assignmentsCleared: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('📦 Début de l\'archivage des chambres pour', hotelId);
    
    try {
      // 1. Récupérer les chambres actuelles pour l'archivage
      const { data: currentRooms, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', hotelId);
      
      if (fetchError) throw fetchError;
      
      const roomsCount = currentRooms?.length || 0;
      console.log(`📊 ${roomsCount} chambres à archiver`);
      
      // 2. Archiver dans daily_reports si des chambres existent
      if (currentRooms && currentRooms.length > 0) {
        const archiveData = {
          hotel_id: hotelId,
          report_date: today,
          room_data: currentRooms,
          summary: {
            total_rooms: roomsCount,
            clean_rooms: currentRooms.filter(r => r.status === 'clean').length,
            dirty_rooms: currentRooms.filter(r => r.status === 'dirty').length,
            in_progress_rooms: currentRooms.filter(r => r.status === 'in-progress').length,
            archived_at: new Date().toISOString()
          },
          total_rooms_cleaned: currentRooms.filter(r => r.status === 'clean').length
        };
        
        const { error: archiveError } = await supabase
          .from('daily_reports')
          .insert(archiveData);
        
        if (archiveError) {
          console.warn('⚠️ Erreur archivage daily_reports:', archiveError);
          // Continuer malgré l'erreur
        } else {
          console.log('✅ Rapport archivé dans daily_reports');
        }
      }
      
      // 3. Supprimer les assignations du jour
      const { data: deletedAssignments, error: assignmentsError } = await supabase
        .from('assignments')
        .delete()
        .eq('hotel_id', hotelId)
        .select('id');
      
      const assignmentsCleared = deletedAssignments?.length || 0;
      
      if (assignmentsError) {
        console.warn('⚠️ Erreur suppression assignations:', assignmentsError);
      } else {
        console.log(`🗑️ ${assignmentsCleared} assignations supprimées`);
      }
      
      // 4. Réinitialiser le statut de toutes les chambres à 'needs-cleaning'
      const { error: resetError } = await supabase
        .from('rooms')
        .update({ 
          status: 'needs-cleaning',
          cleaning_type: null,
          notes: null,
          updated_at: new Date().toISOString()
        })
        .eq('hotel_id', hotelId);
      
      if (resetError) {
        console.error('❌ Erreur réinitialisation chambres:', resetError);
        throw resetError;
      }
      
      console.log(`✅ ${roomsCount} chambres réinitialisées à 'needs-cleaning'`);
      
      return {
        archived: roomsCount,
        reset: roomsCount,
        assignmentsCleared
      };
    } catch (error) {
      console.error('❌ Erreur archivage chambres:', error);
      throw error;
    }
  }

  /**
   * Supprime toutes les chambres existantes et les remplace par les nouvelles
   */
  static async replaceAllRooms(
    hotelId: string, 
    newRooms: any[], 
    sourceName: string
  ): Promise<{ deleted: number; inserted: number }> {
    console.log(`🔄 Remplacement de toutes les chambres pour ${hotelId}`);
    
    try {
      // 1. Compter les chambres existantes
      const { count: existingCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', hotelId);
      
      // 2. Supprimer toutes les assignations
      await supabase
        .from('assignments')
        .delete()
        .eq('hotel_id', hotelId);
      
      // 3. Supprimer toutes les chambres existantes
      const { error: deleteRoomsError } = await supabase
        .from('rooms')
        .delete()
        .eq('hotel_id', hotelId);
      
      if (deleteRoomsError) throw deleteRoomsError;
      
      // 4. Supprimer du registre également
      await supabase
        .from('hotel_rooms_registry')
        .delete()
        .eq('hotel_id', hotelId);
      
      console.log(`🗑️ ${existingCount || 0} anciennes chambres supprimées`);
      
      // 5. Insérer les nouvelles chambres dans rooms
      const roomsForInsert = newRooms.map((room: any) => {
        const roomNumber = room.roomNumber || room.room_number || room.number;
        return {
          hotel_id: hotelId,
          room_number: roomNumber,
          floor: room.floor ?? null,
          status: 'needs-cleaning',
          room_type: room.type || room.room_type || null,
          cleaning_priority: room.priority === 'high' ? 2 : 1,
          notes: null
        };
      }).filter(r => !!r.room_number);
      
      const { error: insertRoomsError } = await supabase
        .from('rooms')
        .insert(roomsForInsert);
      
      if (insertRoomsError) throw insertRoomsError;
      
      // 6. Insérer dans le registre
      const registryData = newRooms.map((room: any) => {
        const roomNumber = room.roomNumber || room.room_number || room.number;
        return {
          hotel_id: hotelId,
          room_number: roomNumber,
          floor: room.floor ?? null,
          room_type: room.type || room.room_type || null,
          building: room.building || null,
          zone: room.zone || null,
          source: 'pdf_import',
          imported_from: sourceName,
          metadata: { status: room.status, raw_data: room }
        };
      }).filter(r => !!r.room_number);
      
      await supabase
        .from('hotel_rooms_registry')
        .insert(registryData);
      
      console.log(`✅ ${roomsForInsert.length} nouvelles chambres insérées`);
      
      return {
        deleted: existingCount || 0,
        inserted: roomsForInsert.length
      };
    } catch (error) {
      console.error('❌ Erreur remplacement chambres:', error);
      throw error;
    }
  }
}
