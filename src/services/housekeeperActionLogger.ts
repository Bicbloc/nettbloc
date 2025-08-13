import { supabase } from '@/integrations/supabase/client';

export interface HousekeeperActionLog {
  hotel_id: string;
  type: 'housekeeper_connected' | 'room_assigned' | 'cleaning-start' | 'cleaning-end' | 'housekeeper_access_request' | 'access_approved';
  title?: string;
  description?: string;
  housekeeper_name?: string;
  room_number?: string;
  target_user_id?: string;
}

export class HousekeeperActionLogger {
  /**
   * Log an action using the secure RPC function
   */
  static async logAction(action: HousekeeperActionLog): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('log_housekeeper_action', {
        p_hotel_id: action.hotel_id,
        p_type: action.type,
        p_title: action.title || null,
        p_description: action.description || null,
        p_housekeeper_name: action.housekeeper_name || null,
        p_room_number: action.room_number || null,
        p_target_user_id: action.target_user_id || null
      });

      if (error) {
        console.error('Error logging housekeeper action:', error);
        return false;
      }

      console.log(`✅ Action logged: ${action.type} (${data} notifications created)`);
      return true;
    } catch (error) {
      console.error('Error in logAction:', error);
      return false;
    }
  }

  /**
   * Log housekeeper connection
   */
  static async logHousekeeperConnection(
    hotelId: string, 
    housekeeperName: string, 
    accessCode?: string
  ): Promise<boolean> {
    return this.logAction({
      hotel_id: hotelId,
      type: 'housekeeper_connected',
      housekeeper_name: housekeeperName,
      description: accessCode ? 
        `${housekeeperName} s'est connectée avec le code ${accessCode}` : 
        `${housekeeperName} s'est connectée`
    });
  }

  /**
   * Log room assignment
   */
  static async logRoomAssignment(
    hotelId: string,
    roomNumber: string,
    housekeeperName: string
  ): Promise<boolean> {
    return this.logAction({
      hotel_id: hotelId,
      type: 'room_assigned',
      housekeeper_name: housekeeperName,
      room_number: roomNumber
    });
  }

  /**
   * Log cleaning start
   */
  static async logCleaningStart(
    hotelId: string,
    roomNumber: string,
    housekeeperName: string
  ): Promise<boolean> {
    return this.logAction({
      hotel_id: hotelId,
      type: 'cleaning-start',
      housekeeper_name: housekeeperName,
      room_number: roomNumber
    });
  }

  /**
   * Log cleaning completion
   */
  static async logCleaningEnd(
    hotelId: string,
    roomNumber: string,
    housekeeperName: string
  ): Promise<boolean> {
    return this.logAction({
      hotel_id: hotelId,
      type: 'cleaning-end',
      housekeeper_name: housekeeperName,
      room_number: roomNumber
    });
  }

  /**
   * Log access request
   */
  static async logAccessRequest(
    hotelId: string,
    housekeeperName: string,
    hotelCode: string
  ): Promise<boolean> {
    return this.logAction({
      hotel_id: hotelId,
      type: 'housekeeper_access_request',
      housekeeper_name: housekeeperName,
      description: `${housekeeperName} demande l'accès à l'hôtel (${hotelCode})`
    });
  }

  /**
   * Log access approval
   */
  static async logAccessApproval(
    hotelId: string,
    housekeeperName: string,
    accessCode: string
  ): Promise<boolean> {
    return this.logAction({
      hotel_id: hotelId,
      type: 'access_approved',
      housekeeper_name: housekeeperName,
      description: `Accès approuvé pour ${housekeeperName}. Code: ${accessCode}`
    });
  }
}