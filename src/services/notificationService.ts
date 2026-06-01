import { supabase } from '@/integrations/supabase/client';

export interface CreateNotificationInput {
  hotelId: string;
  title: string;
  description: string;
  type: string;
  userType?: string;
  housekeeperName?: string;
  roomNumber?: string;
}

/**
 * Insère une notification directement en base pour un hôtel donné.
 * Utilisable hors du contexte React (services, mutations, panneaux admin).
 * Les abonnés temps réel (useNotifications) la recevront automatiquement.
 */
export async function createNotification(input: CreateNotificationInput): Promise<boolean> {
  if (!input.hotelId) {
    console.warn('createNotification: hotelId manquant', input);
    return false;
  }

  try {
    const { error } = await supabase.from('notifications').insert({
      hotel_id: input.hotelId,
      title: input.title,
      description: input.description,
      type: input.type,
      user_type: input.userType || 'admin',
      housekeeper_name: input.housekeeperName ?? null,
      room_number: input.roomNumber ?? null,
      is_read: false,
    });

    if (error) {
      console.error('❌ createNotification error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('💥 createNotification exception:', e);
    return false;
  }
}
