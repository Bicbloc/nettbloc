import { supabase } from '@/integrations/supabase/client';

export interface HousekeeperWithCode {
  id: string;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
}

export class SimpleCodeService {
  // Get housekeepers with their codes for a hotel
  static async getHousekeepersWithCodes(hotelId: string): Promise<HousekeeperWithCode[]> {
    try {
      // Validate hotelId format
      if (!hotelId || hotelId.length < 10) {
        console.error('Invalid hotelId format:', hotelId);
        return [];
      }

      // Create query promise
      const queryPromise = supabase
        .from('housekeepers')
        .select('id, name, access_code, is_active, created_at')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

      // Create timeout promise (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: La requête a pris trop de temps')), 10000)
      );

      // Race between query and timeout
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.error('Error loading housekeepers:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getHousekeepersWithCodes:', error);
      return [];
    }
  }

  // Copy code to clipboard
  static async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }
}
