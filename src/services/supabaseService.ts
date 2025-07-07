import { supabase } from '@/integrations/supabase/client';

interface Hotel {
  id: string;
  name: string;
  email: string;
  hotel_code?: string; // Optional for compatibility
  created_at: string;
  updated_at: string;
}

interface Housekeeper {
  id: string;
  hotel_id: string | null;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RoomStatusUpdate {
  id: string;
  hotel_id: string | null;
  housekeeper_id: string | null;
  room_number: string;
  status: string;
  message: string | null;
  created_at: string;
}

export class SupabaseService {
  // Gestion des hôtels
  static async createHotel(name: string, email: string, hotelCode: string): Promise<Hotel | null> {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .insert({ name, email })
        .select('id, name, email, created_at, updated_at')
        .single();
      
      if (error || !data) {
        console.error('Erreur création hôtel:', error);
        return null;
      }
      return data as Hotel;
    } catch (err) {
      console.error('Erreur createHotel:', err);
      return null;
    }
  }

  static async getHotelByCode(hotelCode: string): Promise<Hotel | null> {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .select('id, name, email, created_at, updated_at')
        .eq('name', hotelCode) // Using name field temporarily since hotel_code may not exist yet
        .maybeSingle();
      
      if (error || !data) {
        console.error('Erreur récupération hôtel par code:', error);
        return null;
      }
      return data as Hotel;
    } catch (err) {
      console.error('Erreur getHotelByCode:', err);
      return null;
    }
  }

  static async getHotels(): Promise<Hotel[]> {
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur récupération hôtels:', error);
      return [];
    }
    return (data || []) as Hotel[];
  }

  // Gestion des femmes de chambre
  static async createHousekeeper(hotelId: string, name: string): Promise<Housekeeper | null> {
    const accessCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    const { data, error } = await supabase
      .from('housekeepers')
      .insert({ 
        hotel_id: hotelId, 
        name, 
        access_code: accessCode 
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erreur création femme de chambre:', error);
      return null;
    }
    return data as Housekeeper;
  }

  static async authenticateHousekeeper(accessCode: string): Promise<Housekeeper | null> {
    const { data, error } = await supabase
      .from('housekeepers')
      .select('*')
      .eq('access_code', accessCode)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('Erreur authentification femme de chambre:', error);
      return null;
    }
    return data as Housekeeper;
  }

  static async getHousekeepers(hotelId?: string): Promise<Housekeeper[]> {
    let query = supabase
      .from('housekeepers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (hotelId) {
      query = query.eq('hotel_id', hotelId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erreur récupération femmes de chambre:', error);
      return [];
    }
    return (data || []) as Housekeeper[];
  }

  static async deactivateHousekeeper(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('housekeepers')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) {
      console.error('Erreur désactivation femme de chambre:', error);
      return false;
    }
    return true;
  }

  // Gestion des mises à jour de statut des chambres
  static async createRoomStatusUpdate(
    hotelId: string,
    housekeeperId: string,
    roomNumber: string,
    status: string,
    message?: string
  ): Promise<RoomStatusUpdate | null> {
    const { data, error } = await supabase
      .from('room_status_updates')
      .insert({
        hotel_id: hotelId,
        housekeeper_id: housekeeperId,
        room_number: roomNumber,
        status,
        message
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erreur création mise à jour statut chambre:', error);
      return null;
    }
    return data as RoomStatusUpdate;
  }
}