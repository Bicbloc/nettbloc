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
    linenTasksArchived: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    
    try {
      // 1. Récupérer les chambres actuelles pour l'archivage
      const { data: currentRooms, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', hotelId);
      
      if (fetchError) {
        console.error('❌ Erreur récupération chambres:', fetchError);
        throw fetchError;
      }
      
      const roomsCount = currentRooms?.length || 0;
      
      // 2. Récupérer les notifications/remarques du jour pour archivage
      const { data: todayNotifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('hotel_id', hotelId)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');
      
      const allNotifications = todayNotifications || [];
      const remarks = allNotifications.filter(n => n.type === 'remark');
      
      // 3. Récupérer les assignations actuelles pour archivage
      const { data: currentAssignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('hotel_id', hotelId);
      
      const assignments = currentAssignments || [];
      const housekeeperNames = [...new Set(assignments.map(a => a.housekeeper_name))];
      
      // 4. Récupérer le journal d'actions du jour
      const { data: todayLogs } = await supabase
        .from('daily_action_logs')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('log_date', today);
      
      const actionLogs = todayLogs || [];
      
      // 5. Récupérer les tâches d'inventaire linge du jour
      const { data: linenTasks } = await supabase
        .from('linen_inventory_tasks')
        .select(`
          *,
          linen_inventory_entries (
            *,
            linen_types (name, category)
          )
        `)
        .eq('hotel_id', hotelId)
        .eq('task_date', today);
      
      const linenTasksData = linenTasks || [];
      
      // Calculer les totaux d'inventaire linge
      const linenSummary = linenTasksData.reduce((acc, task) => {
        const entries = (task as any).linen_inventory_entries || [];
        entries.forEach((entry: any) => {
          const typeName = entry.linen_types?.name || 'Inconnu';
          if (!acc[typeName]) {
            acc[typeName] = { clean: 0, dirty: 0, damaged: 0 };
          }
          acc[typeName].clean += entry.quantity_clean || 0;
          acc[typeName].dirty += entry.quantity_dirty || 0;
          acc[typeName].damaged += entry.quantity_damaged || 0;
        });
        return acc;
      }, {} as Record<string, { clean: number; dirty: number; damaged: number }>);
      
      // 6. Créer le rapport d'archivage complet
      if (currentRooms && currentRooms.length > 0) {
        const archiveData = {
          hotel_id: hotelId,
          report_date: today,
          room_data: currentRooms,
          summary: {
            total_rooms: roomsCount,
            clean_rooms: currentRooms.filter(r => r.status === 'clean').length,
            dirty_rooms: currentRooms.filter(r => r.status === 'dirty' || r.status === 'needs-cleaning').length,
            in_progress_rooms: currentRooms.filter(r => r.status === 'in-progress').length,
            archived_at: new Date().toISOString(),
            housekeepers: housekeeperNames,
            assignments: assignments.reduce((acc, a) => {
              if (!acc[a.housekeeper_name]) acc[a.housekeeper_name] = [];
              const room = currentRooms.find(r => r.id === a.room_id);
              acc[a.housekeeper_name].push({
                room_number: room?.room_number || 'N/A',
                room_id: a.room_id,
                status: a.status,
                started_at: a.started_at,
                completed_at: a.completed_at,
                actual_duration: a.actual_duration
              });
              return acc;
            }, {} as Record<string, any[]>),
            remarks: remarks.map(r => ({
              room_number: r.room_number,
              description: r.description,
              housekeeper_name: r.housekeeper_name,
              created_at: r.created_at
            })),
            notifications: allNotifications.map(n => ({
              type: n.type,
              title: n.title,
              description: n.description,
              room_number: n.room_number,
              created_at: n.created_at
            })),
            action_log: actionLogs.map(log => ({
              action_type: log.action_type,
              actor_name: log.actor_name,
              actor_type: log.actor_type,
              room_number: log.room_number,
              description: log.description,
              details: log.details,
              created_at: log.created_at
            })),
            linen_inventory: {
              tasks_count: linenTasksData.length,
              summary: linenSummary,
              tasks: linenTasksData.map(task => ({
                assigned_to: (task as any).assigned_to,
                status: (task as any).status,
                started_at: (task as any).started_at,
                completed_at: (task as any).completed_at,
                entries: ((task as any).linen_inventory_entries || []).map((e: any) => ({
                  linen_type: e.linen_types?.name,
                  category: e.linen_types?.category,
                  quantity_clean: e.quantity_clean,
                  quantity_dirty: e.quantity_dirty,
                  quantity_damaged: e.quantity_damaged,
                  count_method: e.count_method
                }))
              }))
            }
          },
          total_rooms_cleaned: currentRooms.filter(r => r.status === 'clean').length,
          notes: `${housekeeperNames.length} femme(s) de chambre, ${remarks.length} commentaire(s), ${actionLogs.length} action(s), ${linenTasksData.length} inventaire(s) linge`
        };
        
        const { error: archiveError } = await supabase
          .from('daily_reports')
          .insert(archiveData);
        
        if (archiveError) {
        } else {
        }
      }
      
      // 7. Supprimer les assignations du jour
      const { data: deletedAssignments, error: assignmentsError } = await supabase
        .from('assignments')
        .delete()
        .eq('hotel_id', hotelId)
        .select('id');
      
      const assignmentsCleared = deletedAssignments?.length || 0;
      
      if (assignmentsError) {
      } else {
      }
      
      // 8. Supprimer les entrées d'inventaire linge liées aux tâches du jour
      const taskIds = linenTasksData.map(t => (t as any).id);
      if (taskIds.length > 0) {
        await supabase
          .from('linen_inventory_entries')
          .delete()
          .in('task_id', taskIds);
        
        // Supprimer les tâches d'inventaire du jour
        await supabase
          .from('linen_inventory_tasks')
          .delete()
          .eq('hotel_id', hotelId)
          .eq('task_date', today);
        
      }
      
      // 9. Supprimer les chambres pour vider la page (registre préservé)
      const { error: deleteError } = await supabase
        .from('rooms')
        .delete()
        .eq('hotel_id', hotelId);
      
      if (deleteError) {
        console.error('❌ Erreur suppression chambres:', deleteError);
        throw deleteError;
      }
      
      // 10. Supprimer les notifications du jour
      await supabase
        .from('notifications')
        .delete()
        .eq('hotel_id', hotelId)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');
      
      // 11. Supprimer le journal d'actions du jour
      await supabase
        .from('daily_action_logs')
        .delete()
        .eq('hotel_id', hotelId)
        .eq('log_date', today);
      
      
      return {
        archived: roomsCount,
        reset: roomsCount,
        assignmentsCleared,
        linenTasksArchived: taskIds.length
      };
    } catch (error) {
      console.error('❌ Erreur archivage complet:', error);
      throw error;
    }
  }

  /**
   * Supprime toutes les chambres existantes et les remplace par les nouvelles
   * Ne met PAS à jour le registre automatiquement - retourne les nouvelles chambres à confirmer
   */
  static async replaceAllRooms(
    hotelId: string, 
    newRooms: any[], 
    sourceName: string,
    skipRegistryUpdate: boolean = false
  ): Promise<{ deleted: number; inserted: number; newRoomsForRegistry: any[] }> {
    
    try {
      // 1. Compter les chambres existantes
      const { count: existingCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', hotelId);
      
      // 2. Récupérer le registre existant pour détecter les nouvelles chambres
      const { data: existingRegistry } = await supabase
        .from('hotel_rooms_registry')
        .select('room_number')
        .eq('hotel_id', hotelId);
      
      const existingRoomNumbers = new Set(existingRegistry?.map(r => r.room_number) || []);
      
      // 3. Supprimer toutes les assignations
      await supabase
        .from('assignments')
        .delete()
        .eq('hotel_id', hotelId);
      
      // 4. Supprimer toutes les chambres existantes (mais PAS le registre)
      const { error: deleteRoomsError } = await supabase
        .from('rooms')
        .delete()
        .eq('hotel_id', hotelId);
      
      if (deleteRoomsError) throw deleteRoomsError;
      
      // NOTE: Le registre des chambres (hotel_rooms_registry) est PRÉSERVÉ
      // Il sert de référence permanente des chambres de l'hôtel
      
      
      // 5. Insérer les nouvelles chambres dans rooms
      // IMPORTANT: Sauvegarder le cleaningType appris par l'IA
      // DÉDUPLICATION: Éviter les doublons de room_number
      const seenRoomNumbers = new Set<string>();
      const roomsForInsert = newRooms
        .map((room: any) => {
          const roomNumber = room.roomNumber || room.room_number || room.number;
          
          // Skip si déjà vu (doublon dans le PDF)
          if (!roomNumber || seenRoomNumbers.has(roomNumber)) {
            if (roomNumber) {
            }
            return null;
          }
          seenRoomNumbers.add(roomNumber);
          
          // Mapper le cleaningType pour la base de données
          let dbCleaningType = 'a_blanc';
          if (room.cleaningType === 'none' || room.notUrgent === true) {
            dbCleaningType = 'none';
          } else if (room.cleaningType === 'recouche' || room.cleaningType === 'quick') {
            dbCleaningType = 'recouche';
          } else if (room.cleaningType === 'a_blanc' || room.cleaningType === 'full') {
            dbCleaningType = 'a_blanc';
          }
          
          // Déterminer le statut correct selon le cleaningType
          const status = dbCleaningType === 'none' ? 'clean' : 'needs-cleaning';
          
          
          return {
            hotel_id: hotelId,
            room_number: roomNumber,
            floor: room.floor ?? null,
            status: status,
            room_type: room.type || room.room_type || null,
            cleaning_priority: 1, // Toujours normal - seul l'admin définit la priorité
            notes: null,
            cleaning_type: dbCleaningType // CRUCIAL: Sauvegarder le type de nettoyage IA
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      
      const { error: insertRoomsError } = await supabase
        .from('rooms')
        .insert(roomsForInsert);
      
      if (insertRoomsError) throw insertRoomsError;
      
      // 6. Identifier les NOUVELLES chambres (pas dans le registre existant)
      const newRoomsForRegistry = newRooms
        .map((room: any) => {
          const roomNumber = room.roomNumber || room.room_number || room.number;
          if (!roomNumber || existingRoomNumbers.has(roomNumber)) {
            return null;
          }
          return {
            room_number: roomNumber,
            floor: room.floor ?? null,
            room_type: room.type || room.room_type || null,
            building: room.building || null,
            zone: room.zone || null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      
      // Dédupliquer les nouvelles chambres
      const uniqueNewRooms = Array.from(
        new Map(newRoomsForRegistry.map(r => [r.room_number, r])).values()
      );
      
      
      
      return {
        deleted: existingCount || 0,
        inserted: roomsForInsert.length,
        newRoomsForRegistry: uniqueNewRooms
      };
    } catch (error) {
      console.error('❌ Erreur remplacement chambres:', error);
      throw error;
    }
  }

  /**
   * Ajouter des chambres au registre permanent
   */
  static async addRoomsToRegistry(
    hotelId: string,
    rooms: { room_number: string; floor?: number | null; room_type?: string | null; building?: string | null; zone?: string | null }[],
    sourceName: string = 'pdf_import'
  ): Promise<number> {
    if (rooms.length === 0) return 0;

    try {
      const registryData = rooms.map(room => ({
        hotel_id: hotelId,
        room_number: room.room_number,
        floor: room.floor ?? null,
        room_type: room.room_type ?? null,
        building: room.building ?? null,
        zone: room.zone ?? null,
        source: 'pdf_import',
        imported_from: sourceName,
        last_seen_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('hotel_rooms_registry')
        .upsert(registryData, {
          onConflict: 'hotel_id,room_number',
          ignoreDuplicates: false
        });

      if (error) throw error;

      return rooms.length;
    } catch (error) {
      console.error('❌ Erreur ajout au registre:', error);
      throw error;
    }
  }

  /**
   * Obtenir le nombre de chambres dans le registre
   */
  static async getRegistryCount(hotelId: string): Promise<number> {
    const { count } = await supabase
      .from('hotel_rooms_registry')
      .select('*', { count: 'exact', head: true })
      .eq('hotel_id', hotelId);
    
    return count || 0;
  }
}
