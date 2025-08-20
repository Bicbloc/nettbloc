import { supabase } from '@/integrations/supabase/client';
import { Room } from '@/services/pdfService';

interface HotelSessionRaw {
  id: string;
  session_token: string;
  hotel_id: string | null;
  ip_address: unknown;
  room_data: any;
  housekeeper_names: any;
  housekeeper_assignments: any;
  is_distributed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

interface HotelSession {
  id: string;
  session_token: string;
  hotel_id: string | null;
  ip_address: string | null;
  room_data: Room[];
  housekeeper_names: string[];
  housekeeper_assignments: Record<string, string>;
  is_distributed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export class HotelSessionService {
  private static sessionToken: string | null = null;

  // Générer un token de session unique
  private static generateSessionToken(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Obtenir l'adresse IP du client
  private static async getClientIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Erreur récupération IP:', error);
      return null;
    }
  }

  // Créer une nouvelle session d'hôtel
  static async createSession(hotelId?: string): Promise<string | null> {
    try {
      const sessionToken = this.generateSessionToken();
      const ipAddress = await this.getClientIP();
      
      // Si pas d'hotelId fourni, essayer de le récupérer depuis localStorage ou le user actuel
      let finalHotelId = hotelId;
      if (!finalHotelId) {
        const savedHotelId = localStorage.getItem('selectedHotelId');
        const savedHotelCode = localStorage.getItem('selectedHotelCode');
        
        if (savedHotelId) {
          finalHotelId = savedHotelId;
          console.log('🏨 Session: Hotel ID récupéré depuis localStorage:', finalHotelId);
        } else if (savedHotelCode) {
          // Récupérer l'hotel ID réel depuis la base via le code
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            const { data: hotel } = await supabase
              .from('hotels')
              .select('id')
              .eq('hotel_code', savedHotelCode)
              .single();
            
            if (hotel) {
              finalHotelId = hotel.id;
              localStorage.setItem('selectedHotelId', hotel.id);
              console.log('🏨 Session: Hotel ID récupéré depuis la base via code:', finalHotelId);
            }
          } catch (error) {
            console.error('❌ Session: Erreur récupération hotel via code:', error);
          }
        } else {
          // Essayer de récupérer l'hôtel du user connecté
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
              const { data: hotel } = await supabase
                .from('hotels')
                .select('id')
                .eq('user_id', user.id)
                .single();
              
              if (hotel) {
                finalHotelId = hotel.id;
                console.log('🏨 Session: Hotel ID récupéré depuis user connecté:', finalHotelId);
              }
            }
          } catch (error) {
            console.error('❌ Session: Erreur récupération hotel du user:', error);
          }
        }
      }

      const { data, error } = await supabase
        .from('hotel_sessions')
        .insert({
          session_token: sessionToken,
          hotel_id: finalHotelId || null,
          ip_address: ipAddress,
          room_data: [],
          housekeeper_names: [],
          housekeeper_assignments: {},
          is_distributed: false,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur création session:', error);
        return null;
      }

      // Stocker le token localement
      this.sessionToken = sessionToken;
      localStorage.setItem('hotel_session_token', sessionToken);
      
      console.log('Session créée avec hotelId:', finalHotelId);
      return sessionToken;
    } catch (err) {
      console.error('Erreur createSession:', err);
      return null;
    }
  }

  // Récupérer le token de session actuel
  static getSessionToken(): string | null {
    if (!this.sessionToken) {
      this.sessionToken = localStorage.getItem('hotel_session_token');
    }
    return this.sessionToken;
  }

  // Récupérer une session par token
  static async getSession(token?: string): Promise<HotelSession | null> {
    const sessionToken = token || this.getSessionToken();
    if (!sessionToken) return null;

    try {
      const { data, error } = await supabase
        .from('hotel_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Erreur récupération session:', error);
        return null;
      }

      return this.transformSession(data as unknown as HotelSessionRaw);
    } catch (err) {
      console.error('Erreur getSession:', err);
      return null;
    }
  }

  // Mettre à jour les données de chambre
  static async updateRoomData(rooms: Room[]): Promise<boolean> {
    const sessionToken = this.getSessionToken();
    if (!sessionToken) return false;

    try {
      const { error } = await supabase
        .from('hotel_sessions')
        .update({ 
          room_data: rooms as any,
          updated_at: new Date().toISOString()
        })
        .eq('session_token', sessionToken);

      if (error) {
        console.error('Erreur mise à jour rooms:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Erreur updateRoomData:', err);
      return false;
    }
  }

  // Mettre à jour les noms des femmes de chambre
  static async updateHousekeeperNames(names: string[]): Promise<boolean> {
    const sessionToken = this.getSessionToken();
    if (!sessionToken) return false;

    try {
      const { error } = await supabase
        .from('hotel_sessions')
        .update({ 
          housekeeper_names: names as any,
          updated_at: new Date().toISOString()
        })
        .eq('session_token', sessionToken);

      if (error) {
        console.error('Erreur mise à jour housekeeper names:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Erreur updateHousekeeperNames:', err);
      return false;
    }
  }

  // Mettre à jour les assignations des chambres
  static async updateHousekeeperAssignments(assignments: Record<string, string>): Promise<boolean> {
    const sessionToken = this.getSessionToken();
    if (!sessionToken) return false;

    try {
      const { error } = await supabase
        .from('hotel_sessions')
        .update({ 
          housekeeper_assignments: assignments as any,
          updated_at: new Date().toISOString()
        })
        .eq('session_token', sessionToken);

      if (error) {
        console.error('Erreur mise à jour assignments:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Erreur updateHousekeeperAssignments:', err);
      return false;
    }
  }

  // Marquer la session comme distribuée
  static async markAsDistributed(): Promise<boolean> {
    const sessionToken = this.getSessionToken();
    if (!sessionToken) return false;

    try {
      const { error } = await supabase
        .from('hotel_sessions')
        .update({ 
          is_distributed: true,
          updated_at: new Date().toISOString()
        })
        .eq('session_token', sessionToken);

      if (error) {
        console.error('Erreur marquer comme distribué:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Erreur markAsDistributed:', err);
      return false;
    }
  }

  // Mettre à jour le statut d'une chambre
  static async updateRoomStatus(roomNumber: string, newStatus: string): Promise<boolean> {
    const session = await this.getSession();
    if (!session) return false;

    // Mettre à jour les données localement
    const updatedRooms = session.room_data.map(room => 
      room.number === roomNumber 
        ? { ...room, status: newStatus }
        : room
    );

    // Sauvegarder en base
    return await this.updateRoomData(updatedRooms);
  }

  // Désactiver une session
  static async deactivateSession(token?: string): Promise<boolean> {
    const sessionToken = token || this.getSessionToken();
    if (!sessionToken) return false;

    try {
      const { error } = await supabase
        .from('hotel_sessions')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('session_token', sessionToken);

      if (error) {
        console.error('Erreur désactivation session:', error);
        return false;
      }

      // Nettoyer le token local si c'est la session actuelle
      if (sessionToken === this.getSessionToken()) {
        this.sessionToken = null;
        localStorage.removeItem('hotel_session_token');
      }

      return true;
    } catch (err) {
      console.error('Erreur deactivateSession:', err);
      return false;
    }
  }

  // Récupérer toutes les sessions actives
  static async getActiveSessions(): Promise<HotelSession[]> {
    try {
      const { data, error } = await supabase
        .from('hotel_sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur récupération sessions actives:', error);
        return [];
      }

      return data?.map(session => this.transformSession(session as unknown as HotelSessionRaw)) || [];
    } catch (err) {
      console.error('Erreur getActiveSessions:', err);
      return [];
    }
  }

  // Transformer les données brutes de Supabase vers le type HotelSession
  private static transformSession(raw: HotelSessionRaw | null): HotelSession | null {
    if (!raw) return null;
    
    return {
      id: raw.id,
      session_token: raw.session_token,
      hotel_id: raw.hotel_id,
      ip_address: raw.ip_address as string | null,
      room_data: Array.isArray(raw.room_data) ? raw.room_data as Room[] : [],
      housekeeper_names: Array.isArray(raw.housekeeper_names) ? raw.housekeeper_names as string[] : [],
      housekeeper_assignments: typeof raw.housekeeper_assignments === 'object' && raw.housekeeper_assignments ? raw.housekeeper_assignments as Record<string, string> : {},
      is_distributed: raw.is_distributed,
      is_active: raw.is_active,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      expires_at: raw.expires_at
    };
  }

  // Initialiser ou récupérer une session existante
  static async initializeSession(): Promise<string | null> {
    // Essayer de récupérer une session existante
    const existingToken = this.getSessionToken();
    if (existingToken) {
      const session = await this.getSession(existingToken);
      if (session) {
        return existingToken;
      }
    }

    // Créer une nouvelle session si aucune n'existe
    return await this.createSession();
  }
}