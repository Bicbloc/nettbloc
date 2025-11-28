import { supabase } from '@/integrations/supabase/client';

export interface HousekeeperProfile {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  phone?: string;
}

export interface HousekeeperWithCode {
  id: string;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResult {
  success: boolean;
  user?: any;
  hotel?: any;
  housekeeper?: any;
  accessCode?: string;
  error?: string;
}

export class UnifiedHousekeeperService {
  // Authentication
  static async authenticateWithCode(accessCode: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.rpc('authenticate_housekeeper_by_code', {
        p_access_code: accessCode.trim().toUpperCase(),
      });

      if (error) throw error;

      const authData = data?.[0];
      if (!authData || !authData.success) {
        return {
          success: false,
          error: 'Code d\'accès invalide ou expiré',
        };
      }

      return {
        success: true,
        hotel: {
          id: authData.hotel_id,
          name: authData.hotel_name,
          code: authData.hotel_code,
        },
        housekeeper: authData.housekeeper_id ? {
          id: authData.housekeeper_id,
          name: authData.housekeeper_name,
        } : undefined,
        accessCode: authData.resolved_access_code,
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'authentification',
      };
    }
  }

  // Profile management
  static async getProfileByEmail(email: string): Promise<HousekeeperProfile | null> {
    try {
      const { data, error } = await supabase
        .from('housekeeper_profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  static async createProfile(profile: {
    email: string;
    name: string;
    phone?: string;
  }): Promise<HousekeeperProfile | null> {
    try {
      const { data, error } = await supabase
        .from('housekeeper_profiles')
        .insert({
          email: profile.email,
          name: profile.name,
          phone: profile.phone,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating profile:', error);
      return null;
    }
  }

  // Access codes management
  static async getCodesForHotel(hotelId: string): Promise<HousekeeperWithCode[]> {
    if (!hotelId || hotelId.length < 10) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('housekeepers')
        .select('id, name, access_code, is_active, created_at')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading housekeepers:', error);
      return [];
    }
  }

  // Access requests
  static async requestHotelAccess(
    profileId: string,
    hotelCode: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find hotel by code
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('id, name')
        .eq('hotel_code', hotelCode.trim().toUpperCase())
        .maybeSingle();

      if (hotelError) throw hotelError;
      if (!hotel) {
        return { success: false, error: 'Hôtel introuvable' };
      }

      // Check for existing request
      const { data: existing } = await supabase
        .from('housekeeper_access_requests')
        .select('id, status')
        .eq('housekeeper_profile_id', profileId)
        .eq('hotel_id', hotel.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'Une demande est déjà en attente pour cet hôtel' };
      }

      // Create new request
      const { error: insertError } = await supabase
        .from('housekeeper_access_requests')
        .insert({
          housekeeper_profile_id: profileId,
          hotel_id: hotel.id,
          hotel_code: hotelCode.trim().toUpperCase(),
          status: 'pending',
        });

      if (insertError) throw insertError;

      return { success: true };
    } catch (error) {
      console.error('Error requesting access:', error);
      return { success: false, error: 'Erreur lors de la demande d\'accès' };
    }
  }

  // Utility
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
