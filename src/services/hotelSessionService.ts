import { supabase } from '@/integrations/supabase/client';
import { Room } from '@/services/pdfService';
import { SessionPersistenceService } from './sessionPersistenceService';

interface HotelSessionRaw {
  id: string;
  session_token: string;
  hotel_id: string | null;
  room_data: any;
  housekeeper_names: any;
  housekeeper_assignments: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

interface HotelSession {
  id: string;
  session_token: string;
  hotel_id: string | null;
  room_data: Room[];
  housekeeper_names: string[];
  housekeeper_assignments: Record<string, string>;
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

  // Créer une nouvelle session d'hôtel
  static async createSession(hotelId?: string): Promise<string | null> {
    try {
      const sessionToken = this.generateSessionToken();
      
      // RÉCUPÉRATION OPTIMISÉE de l'hotel_id - UNE SEULE SOURCE À LA FOIS
      let finalHotelId = hotelId;

      if (!finalHotelId) {
        // Priorité 1: localStorage (source principale)
        finalHotelId = localStorage.getItem('selectedHotelId') || 
                       localStorage.getItem('currentHotelId') ||
                       SessionPersistenceService.getStoredHotelId() ||
                       undefined;
        
        if (finalHotelId) {
          console.log('✅ Hotel ID depuis localStorage:', finalHotelId.slice(0, 8) + '...');
        } else {
          // Priorité 2: récupérer depuis le profil user (une seule fois)
          try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
              const { data: hotel } = await supabase
                .from('hotels')
                .select('id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (hotel) {
                finalHotelId = hotel.id;
                console.log('✅ Hotel ID depuis profil user:', finalHotelId.slice(0, 8) + '...');
              }
            }
          } catch (error) {
            console.error('❌ Erreur récupération hotel:', error);
          }
        }
      }

      if (!finalHotelId) {
        console.warn('❌ Impossible de créer session: pas de hotel_id');
        return null;
      }

      // Créer la session en DB
      const { data, error } = await supabase
        .from('hotel_sessions')
        .insert({
          session_token: sessionToken,
          hotel_id: finalHotelId,
          room_data: [],
          housekeeper_names: [],
          housekeeper_assignments: {},
          is_active: true,
          last_activity: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur création session:', error);
        return null;
      }

      // SAUVEGARDE UNIQUE dans les emplacements principaux
      this.sessionToken = sessionToken;
      localStorage.setItem('hotelSessionToken', sessionToken);
      localStorage.setItem('selectedHotelId', finalHotelId);
      localStorage.setItem('currentHotelId', finalHotelId);
      
      // Sauvegarder dans le service de persistance
      SessionPersistenceService.saveSessionData({
        sessionToken: sessionToken,
        hotelId: finalHotelId,
        lastActiveDate: new Date().toISOString(),
        room_data: [],
        housekeeper_assignments: []
      });
      
      console.log('✅ Session créée:', sessionToken.slice(0, 10) + '...', 'Hotel:', finalHotelId.slice(0, 8) + '...');
      return sessionToken;
    } catch (err) {
      console.error('❌ Erreur createSession:', err);
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

      // Mettre à jour les données de persistance
      SessionPersistenceService.updateSessionData({
        room_data: rooms as any[]
      });

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

      // Mettre à jour les données de persistance
      SessionPersistenceService.updateSessionData({
        housekeeper_assignments: assignments
      });

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
      // Fonction conservée pour compatibilité mais ne fait plus rien
      // car is_distributed n'existe plus dans la table
      console.log('Session marquée comme distribuée (legacy)');
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
      room_data: Array.isArray(raw.room_data) ? raw.room_data as Room[] : [],
      housekeeper_names: Array.isArray(raw.housekeeper_names) ? raw.housekeeper_names as string[] : [],
      housekeeper_assignments: typeof raw.housekeeper_assignments === 'object' && raw.housekeeper_assignments ? raw.housekeeper_assignments as Record<string, string> : {},
      is_active: raw.is_active,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      expires_at: raw.expires_at
    };
  }

  // Modifier le service HotelSessionService pour utiliser la persistance
  static async initializeSession(): Promise<string | null> {
    return await SessionPersistenceService.restoreOrCreateSession();
  }
}