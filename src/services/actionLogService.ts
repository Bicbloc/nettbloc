import { supabase } from '@/integrations/supabase/client';

export interface ActionLogEntry {
  hotelId: string;
  actionType: 'cleaning_start' | 'cleaning_end' | 'assignment' | 'unassignment' | 'incident' | 'comment' | 'status_change';
  actorName?: string;
  actorType?: 'housekeeper' | 'admin' | 'system';
  roomNumber?: string;
  description: string;
  details?: Record<string, any>;
}

export class ActionLogService {
  /**
   * Enregistrer une action dans le journal quotidien
   */
  static async logAction(entry: ActionLogEntry): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('daily_action_logs')
        .insert({
          hotel_id: entry.hotelId,
          action_type: entry.actionType,
          actor_name: entry.actorName || null,
          actor_type: entry.actorType || 'system',
          room_number: entry.roomNumber || null,
          description: entry.description,
          details: entry.details || {},
          log_date: new Date().toISOString().split('T')[0]
        });

      if (error) {
        console.error('❌ Erreur enregistrement action:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erreur ActionLogService.logAction:', error);
      return false;
    }
  }

  /**
   * Récupérer les actions du jour pour un hôtel
   */
  static async getTodayLogs(hotelId: string) {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('daily_action_logs')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('log_date', today)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur chargement logs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Archiver les logs du jour et les supprimer de la table principale
   */
  static async archiveDailyLogs(hotelId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Récupérer tous les logs du jour
      const logs = await this.getTodayLogs(hotelId);
      
      if (logs.length === 0) {
        return true;
      }

      // 2. Créer un résumé
      const summary = {
        totalActions: logs.length,
        byType: logs.reduce((acc, log) => {
          acc[log.action_type] = (acc[log.action_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byActor: logs.reduce((acc, log) => {
          if (log.actor_name) {
            acc[log.actor_name] = (acc[log.actor_name] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>),
        roomsAffected: Array.from(new Set(logs.map(l => l.room_number).filter(Boolean)))
      };

      // 3. Insérer dans les archives
      const { error: archiveError } = await supabase
        .from('archived_daily_logs')
        .insert({
          hotel_id: hotelId,
          archive_date: today,
          logs_data: logs,
          summary
        });

      if (archiveError) {
        console.error('❌ Erreur archivage:', archiveError);
        return false;
      }

      // 4. Supprimer les logs archivés
      const { error: deleteError } = await supabase
        .from('daily_action_logs')
        .delete()
        .eq('hotel_id', hotelId)
        .eq('log_date', today);

      if (deleteError) {
        console.error('❌ Erreur suppression logs après archivage:', deleteError);
        // Ne pas échouer, les logs sont déjà archivés
      }

      return true;
    } catch (error) {
      console.error('❌ Erreur ActionLogService.archiveDailyLogs:', error);
      return false;
    }
  }

  /**
   * Helper pour loguer le début de nettoyage
   */
  static async logCleaningStart(hotelId: string, roomNumber: string, housekeeperName: string): Promise<boolean> {
    return this.logAction({
      hotelId,
      actionType: 'cleaning_start',
      actorName: housekeeperName,
      actorType: 'housekeeper',
      roomNumber,
      description: `${housekeeperName} a commencé le nettoyage de la chambre ${roomNumber}`
    });
  }

  /**
   * Helper pour loguer la fin de nettoyage
   */
  static async logCleaningEnd(hotelId: string, roomNumber: string, housekeeperName: string): Promise<boolean> {
    return this.logAction({
      hotelId,
      actionType: 'cleaning_end',
      actorName: housekeeperName,
      actorType: 'housekeeper',
      roomNumber,
      description: `${housekeeperName} a terminé le nettoyage de la chambre ${roomNumber}`
    });
  }

  /**
   * Helper pour loguer une assignation
   */
  static async logAssignment(hotelId: string, roomNumber: string, housekeeperName: string, assignedBy?: string): Promise<boolean> {
    return this.logAction({
      hotelId,
      actionType: 'assignment',
      actorName: assignedBy || 'Système',
      actorType: assignedBy ? 'admin' : 'system',
      roomNumber,
      description: `Chambre ${roomNumber} assignée à ${housekeeperName}`,
      details: { housekeeper: housekeeperName }
    });
  }

  /**
   * Helper pour loguer une désassignation
   */
  static async logUnassignment(hotelId: string, roomNumber: string, previousHousekeeper: string, unassignedBy?: string): Promise<boolean> {
    return this.logAction({
      hotelId,
      actionType: 'unassignment',
      actorName: unassignedBy || 'Système',
      actorType: unassignedBy ? 'admin' : 'system',
      roomNumber,
      description: `Chambre ${roomNumber} désassignée de ${previousHousekeeper}`,
      details: { previousHousekeeper }
    });
  }

  /**
   * Helper pour loguer un incident
   */
  static async logIncident(hotelId: string, roomNumber: string, title: string, reporterName: string): Promise<boolean> {
    return this.logAction({
      hotelId,
      actionType: 'incident',
      actorName: reporterName,
      actorType: 'housekeeper',
      roomNumber,
      description: `Incident signalé: ${title} (Chambre ${roomNumber})`,
      details: { title }
    });
  }

  /**
   * Helper pour loguer un commentaire
   */
  static async logComment(hotelId: string, incidentId: string, commenterName: string, roomNumber?: string): Promise<boolean> {
    return this.logAction({
      hotelId,
      actionType: 'comment',
      actorName: commenterName,
      roomNumber,
      description: `${commenterName} a ajouté un commentaire`,
      details: { incidentId }
    });
  }

  /**
   * Helper pour loguer une remarque de chambre (visible pour admin)
   */
  static async logRoomRemark(hotelId: string, roomNumber: string, housekeeperName: string, remark: string): Promise<boolean> {
    return this.logAction({
      hotelId,
      actionType: 'comment',
      actorName: housekeeperName,
      actorType: 'housekeeper',
      roomNumber,
      description: `Remarque de ${housekeeperName} pour CH ${roomNumber}: "${remark}"`,
      details: { remark, type: 'room_remark' }
    });
  }
}
