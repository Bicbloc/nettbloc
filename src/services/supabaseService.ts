import { supabase } from '@/integrations/supabase/client';

export interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  hotel_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Hotel {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface RoomStatusUpdate {
  id: string;
  room_number: string;
  status: string;
  housekeeper_id?: string;
  hotel_id?: string;
  message?: string;
  created_at: string;
}

// Generate 4-digit code
export const generateAccessCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Hotel operations
export const createHotel = async (name: string, email: string): Promise<{ data: Hotel | null; error: any }> => {
  const { data, error } = await supabase
    .from('hotels')
    .insert([{ name, email }])
    .select()
    .single();
  
  return { data, error };
};

export const getHotels = async (): Promise<{ data: Hotel[] | null; error: any }> => {
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .order('created_at', { ascending: false });
  
  return { data, error };
};

// Housekeeper operations
export const createHousekeeper = async (name: string, hotelId?: string): Promise<{ data: Housekeeper | null; error: any }> => {
  const accessCode = generateAccessCode();
  
  const { data, error } = await supabase
    .from('housekeepers')
    .insert([{ 
      name, 
      access_code: accessCode,
      hotel_id: hotelId 
    }])
    .select()
    .single();
  
  return { data, error };
};

export const authenticateHousekeeper = async (accessCode: string): Promise<{ data: Housekeeper | null; error: any }> => {
  const { data, error } = await supabase
    .from('housekeepers')
    .select('*')
    .eq('access_code', accessCode)
    .eq('is_active', true)
    .single();
  
  return { data, error };
};

export const getHousekeepers = async (hotelId?: string): Promise<{ data: Housekeeper[] | null; error: any }> => {
  let query = supabase.from('housekeepers').select('*');
  
  if (hotelId) {
    query = query.eq('hotel_id', hotelId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  return { data, error };
};

// Room status operations
export const createRoomStatusUpdate = async (
  roomNumber: string, 
  status: string, 
  housekeeperId?: string, 
  hotelId?: string,
  message?: string
): Promise<{ data: RoomStatusUpdate | null; error: any }> => {
  const { data, error } = await supabase
    .from('room_status_updates')
    .insert([{ 
      room_number: roomNumber,
      status,
      housekeeper_id: housekeeperId,
      hotel_id: hotelId,
      message
    }])
    .select()
    .single();
  
  return { data, error };
};

export const getRoomStatusUpdates = async (hotelId?: string): Promise<{ data: RoomStatusUpdate[] | null; error: any }> => {
  let query = supabase.from('room_status_updates').select('*');
  
  if (hotelId) {
    query = query.eq('hotel_id', hotelId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  return { data, error };
};

// Real-time subscription
export const subscribeToRoomUpdates = (callback: (payload: any) => void, hotelId?: string) => {
  let channel = supabase
    .channel('room-status-updates')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_status_updates'
      },
      callback
    );

  return channel.subscribe();
};
