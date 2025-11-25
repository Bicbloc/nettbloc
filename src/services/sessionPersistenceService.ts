import { supabase } from '@/integrations/supabase/client';
import { HotelSessionService } from './hotelSessionService';

interface SessionPersistenceData {
  sessionToken: string;
  hotelId: string;
  lastActiveDate: string;
  room_data?: any[];
  housekeeper_assignments?: Record<string, string>;
  uploaded_reports?: any[];
  incidents?: any[];
}

export class SessionPersistenceService {
  private static readonly STORAGE_KEY = 'hotel_session_persistence';
  private static readonly MAX_SESSION_DAYS = 1; // Sessions expire after 1 day

  // Sauvegarder la session en cours
  static saveSessionData(sessionData: SessionPersistenceData): void {
    try {
      const dataWithTimestamp = {
        ...sessionData,
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (this.MAX_SESSION_DAYS * 24 * 60 * 60 * 1000)).toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataWithTimestamp));
      console.log('✅ Session data saved:', dataWithTimestamp);
    } catch (error) {
      console.error('❌ Failed to save session data:', error);
    }
  }

  // Récupérer les données de session sauvegardées
  static getSavedSessionData(): SessionPersistenceData | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (!saved) return null;

      const data = JSON.parse(saved);
      
      // Vérifier si la session a expiré
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        console.log('⚠️ Saved session expired, clearing');
        this.clearSavedSession();
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Failed to get saved session data:', error);
      return null;
    }
  }

  // Vérifier si c'est un nouveau jour
  static isNewDay(lastActiveDate: string): boolean {
    const today = new Date().toDateString();
    const lastDate = new Date(lastActiveDate).toDateString();
    return today !== lastDate;
  }

  // Archiver le rapport du jour précédent
  static async archiveOldReport(sessionToken: string, hotelId: string): Promise<boolean> {
    try {
      console.log('📦 Archiving old report for session:', sessionToken);
      
      // Récupérer la session actuelle
      const session = await HotelSessionService.getSession(sessionToken);
      if (!session) return false;

      // Récupérer les données persistées localement (rapports uploadés, incidents)
      const persistedData = this.getSavedSessionData();

      // Créer un rapport quotidien avec les données de la session
      const reportData = {
        hotel_id: hotelId,
        report_date: new Date(session.updated_at).toISOString().split('T')[0],
        room_data: JSON.parse(JSON.stringify(session.room_data || [])),
        summary: JSON.parse(JSON.stringify({
          total_rooms: session.room_data?.length || 0,
          completed_rooms: session.room_data?.filter((room: any) => room.status === 'completed').length || 0,
          housekeeper_assignments: session.housekeeper_assignments || {},
          uploaded_reports: persistedData?.uploaded_reports || [],
          incidents: persistedData?.incidents || [],
          archived_at: new Date().toISOString()
        })),
        notes: `Rapport archivé automatiquement - session du ${new Date(session.updated_at).toLocaleDateString()}`
      };

      const { error } = await supabase
        .from('daily_reports')
        .insert(reportData);

      if (error) {
        console.error('❌ Failed to archive report:', error);
        return false;
      }

      console.log('✅ Report archived successfully with uploaded reports and incidents');
      return true;
    } catch (error) {
      console.error('❌ Error archiving report:', error);
      return false;
    }
  }

  // Restaurer ou créer une nouvelle session
  static async restoreOrCreateSession(hotelId?: string): Promise<string | null> {
    try {
      const savedData = this.getSavedSessionData();
      
      if (savedData) {
        console.log('🔄 Found saved session data:', savedData);
        
        // Vérifier si c'est un nouveau jour
        if (this.isNewDay(savedData.lastActiveDate)) {
          console.log('📅 New day detected, archiving old session');
          
          // Archiver l'ancien rapport
          await this.archiveOldReport(savedData.sessionToken, savedData.hotelId);
          
          // Désactiver l'ancienne session
          await HotelSessionService.deactivateSession(savedData.sessionToken);
          
          // Nettoyer les données sauvegardées
          this.clearSavedSession();
          
          // Créer une nouvelle session
          console.log('🆕 Creating new session for new day');
          return await HotelSessionService.createSession(hotelId || savedData.hotelId);
        } else {
          // Même jour, essayer de restaurer la session existante
          console.log('📋 Same day, attempting to restore session');
          const existingSession = await HotelSessionService.getSession(savedData.sessionToken);
          
          if (existingSession && existingSession.is_active) {
            console.log('✅ Session restored successfully');
            return savedData.sessionToken;
          } else {
            console.log('⚠️ Saved session no longer active, creating new one');
            this.clearSavedSession();
            return await HotelSessionService.createSession(hotelId || savedData.hotelId);
          }
        }
      } else {
        // Pas de session sauvegardée, créer une nouvelle
        console.log('🆕 No saved session, creating new one');
        return await HotelSessionService.createSession(hotelId);
      }
    } catch (error) {
      console.error('❌ Error in session restoration:', error);
      return await HotelSessionService.createSession(hotelId);
    }
  }

  // Nettoyer les données sauvegardées
  static clearSavedSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🧹 Saved session data cleared');
    } catch (error) {
      console.error('❌ Failed to clear saved session:', error);
    }
  }

  // Mettre à jour les données de session sauvegardées
  static updateSessionData(updates: Partial<SessionPersistenceData>): void {
    const current = this.getSavedSessionData();
    if (current) {
      this.saveSessionData({
        ...current,
        ...updates,
        lastActiveDate: new Date().toISOString()
      });
    }
  }

  // Forcer la sauvegarde de la session actuelle avec l'hôtel ID
  static async forceSaveCurrentSession(hotelId: string): Promise<void> {
    try {
      const sessionData = {
        sessionToken: '',
        hotelId: hotelId,
        lastActiveDate: new Date().toISOString(),
      };
      this.saveSessionData(sessionData);
      
      // Également sauvegarder l'hotelId dans localStorage pour compatibilité
      localStorage.setItem('hotelId', hotelId);
      localStorage.setItem('lastSavedHotelId', hotelId);
      localStorage.setItem('hotelDataTimestamp', Date.now().toString());
      
      console.log('✅ Hotel session forcibly saved:', hotelId);
    } catch (error) {
      console.error('❌ Failed to force save session:', error);
    }
  }

  // Restaurer l'hotelId depuis le stockage local
  static getStoredHotelId(): string | null {
    try {
      const saved = this.getSavedSessionData();
      if (saved?.hotelId) {
        return saved.hotelId;
      }
      
      // Fallback vers localStorage direct
      return localStorage.getItem('hotelId') || localStorage.getItem('lastSavedHotelId');
    } catch (error) {
      console.error('❌ Failed to get stored hotel ID:', error);
      return localStorage.getItem('hotelId');
    }
  }

  // Sauvegarder un rapport uploadé dans la session
  static saveUploadedReport(reportData: any): void {
    try {
      const current = this.getSavedSessionData();
      if (current) {
        const uploadedReports = current.uploaded_reports || [];
        uploadedReports.push({
          ...reportData,
          uploaded_at: new Date().toISOString()
        });
        this.updateSessionData({ uploaded_reports: uploadedReports });
        console.log('✅ Uploaded report saved to session:', reportData);
      }
    } catch (error) {
      console.error('❌ Failed to save uploaded report:', error);
    }
  }

  // Sauvegarder un incident dans la session
  static saveIncident(incidentData: any): void {
    try {
      const current = this.getSavedSessionData();
      if (current) {
        const incidents = current.incidents || [];
        incidents.push({
          ...incidentData,
          created_at: new Date().toISOString()
        });
        this.updateSessionData({ incidents: incidents });
        console.log('✅ Incident saved to session:', incidentData);
      }
    } catch (error) {
      console.error('❌ Failed to save incident:', error);
    }
  }

  // Récupérer les rapports uploadés de la session
  static getUploadedReports(): any[] {
    try {
      const saved = this.getSavedSessionData();
      return saved?.uploaded_reports || [];
    } catch (error) {
      console.error('❌ Failed to get uploaded reports:', error);
      return [];
    }
  }

  // Récupérer les incidents de la session
  static getIncidents(): any[] {
    try {
      const saved = this.getSavedSessionData();
      return saved?.incidents || [];
    } catch (error) {
      console.error('❌ Failed to get incidents:', error);
      return [];
    }
  }
}