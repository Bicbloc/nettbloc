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
      const { data, error } = await supabase
        .from('housekeepers')
        .select('id, name, access_code, is_active, created_at')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

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
