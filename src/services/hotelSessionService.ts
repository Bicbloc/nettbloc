import { supabase } from '@/integrations/supabase/client';
import { Room } from '@/services/pdfService';
import { SessionPersistenceService } from './sessionPersistenceService';

interface HotelSessionRaw {
  id: string;
  session_token: string;
  hotel_id: string | null;
  housekeeper_names: any;
  housekeeper_assignments: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
  user_id: string | null;
  last_activity: string | null;
}

interface HotelSession {
  id: string;
  session_token: string;
  hotel_id: string | null;
  housekeeper_names: string[];
  housekeeper_assignments: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
  user_id: string | null;
  last_activity: string | null;
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
      // 1. Obtenir l'ID utilisateur courant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Utilisateur non authentifié');
        return null;
      }

      // 2. Trouver l'hôtel
      let effectiveHotelId = hotelId;
      
      if (!effectiveHotelId) {
        // Essayer depuis localStorage
        effectiveHotelId = localStorage.getItem('selectedHotelId') || 
                          localStorage.getItem('currentHotelId') ||
                          localStorage.getItem('hotelId') || null;
        
        console.log('🔍 HotelId depuis localStorage:', effectiveHotelId);
      }
      
      // Si toujours pas trouvé, chercher dans le profil via current_hotel_id
      if (!effectiveHotelId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_hotel_id')
          .eq('id', user.id)
          .single();
        
        if (profile?.current_hotel_id) {
          effectiveHotelId = profile.current_hotel_id;
          console.log('✅ HotelId trouvé via profiles.current_hotel_id:', effectiveHotelId);
        } else {
          // Fallback: chercher par user_id
          const { data: hotel } = await supabase
            .from('hotels')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .single();
          
          if (hotel) {
            effectiveHotelId = hotel.id;
            console.log('✅ HotelId trouvé via hotels.user_id:', effectiveHotelId);
          }
        }
      }

      if (!effectiveHotelId) {
        console.error('❌ Impossible de déterminer l\'hôtel');
        return null;
      }

      // Phase 2: ALWAYS deactivate all previous active sessions for this hotel
      console.log('🔄 Désactivation TOUTES anciennes sessions pour hôtel:', effectiveHotelId);
      const { error: deactivateError } = await supabase
        .from('hotel_sessions')
        .update({ is_active: false })
        .eq('hotel_id', effectiveHotelId)
        .eq('is_active', true);

      if (deactivateError) {
        console.error('⚠️ Erreur désactivation anciennes sessions:', deactivateError);
      }

      // 4. Générer un token unique
      const sessionToken = this.generateSessionToken();

      // 5. Créer la NOUVELLE session unique
      const { data, error } = await supabase
        .from('hotel_sessions')
        .insert({
          hotel_id: effectiveHotelId,
          user_id: user.id,
          session_token: sessionToken,
          is_active: true,
          housekeeper_assignments: {},
          housekeeper_names: [],
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur création session:', error);
        return null;
      }

      console.log('✅ Session unique créée:', data.id);
      
      // Phase 4: Store session token explicitly
      this.setSessionToken(sessionToken);
      
      // Sauvegarder dans SessionPersistenceService
      SessionPersistenceService.saveSessionData({
        sessionToken: sessionToken,
        hotelId: effectiveHotelId,
        lastActiveDate: new Date().toISOString()
      });
      
      return sessionToken;
    } catch (error) {
      console.error('Erreur createSession:', error);
      return null;
    }
  }

  // Phase 4: Explicit session token setter
  static setSessionToken(token: string): void {
    this.sessionToken = token;
    localStorage.setItem('hotel_session_token', token);
    localStorage.setItem('hotelSessionToken', token);
    console.log('✅ Token de session défini:', token);
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

  // Phase 6: Use hotel_id instead of session_token for better reliability
  static async updateHousekeeperAssignments(assignments: Record<string, string>, hotelId?: string): Promise<boolean> {
    try {
      // Get hotel ID from parameter or localStorage
      const effectiveHotelId = hotelId || localStorage.getItem('selectedHotelId');
      if (!effectiveHotelId) {
        console.error('No hotel ID found for updateHousekeeperAssignments');
        return false;
      }

      const { error } = await supabase
        .from('hotel_sessions')
        .update({ 
          housekeeper_assignments: assignments as any,
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('hotel_id', effectiveHotelId)
        .eq('is_active', true);

      if (error) {
        console.error('Erreur mise à jour assignments:', error);
        return false;
      }

      // Also save to SessionPersistenceService for redundancy
      SessionPersistenceService.updateSessionData({
        lastSyncTimestamp: Date.now()
      });

      console.log('✅ Assignments persistés (DB + localStorage) via hotel_id');
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

  // Mettre à jour le statut d'une chambre (deprecated - les rooms sont maintenant dans la table rooms)
  static async updateRoomStatus(roomNumber: string, newStatus: string): Promise<boolean> {
    console.warn('updateRoomStatus est deprecated - utilisez la table rooms directement');
    return true;
  }

  /**
   * @deprecated Phase 4: Les rooms sont maintenant dans la table Supabase 'rooms' uniquement
   * Utilisez la table 'rooms' directement
   */
  static updateRoomDataLocal(rooms: any[], hotelId: string): void {
    console.warn('⚠️ updateRoomDataLocal is deprecated - rooms are now in Supabase table "rooms" only');
    // Ne rien faire - les rooms sont dans Supabase
  }

  /**
   * @deprecated Phase 4: Les rooms sont maintenant dans la table Supabase 'rooms' uniquement
   * Utilisez la table 'rooms' directement
   */
  static restoreRoomDataLocal(hotelId: string): any[] {
    console.warn('⚠️ restoreRoomDataLocal is deprecated - rooms are now in Supabase table "rooms" only');
    return [];
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
      housekeeper_names: Array.isArray(raw.housekeeper_names) ? raw.housekeeper_names as string[] : [],
      housekeeper_assignments: typeof raw.housekeeper_assignments === 'object' && raw.housekeeper_assignments ? raw.housekeeper_assignments as Record<string, string> : {},
      is_active: raw.is_active,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      expires_at: raw.expires_at,
      user_id: raw.user_id,
      last_activity: raw.last_activity
    };
  }

  // Modifier le service HotelSessionService pour utiliser la persistance
  static async initializeSession(): Promise<string | null> {
    return await SessionPersistenceService.restoreOrCreateSession();
  }
}