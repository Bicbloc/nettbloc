import { supabase } from '@/integrations/supabase/client';
import { HotelSessionService } from './hotelSessionService';

interface SessionPersistenceData {
  sessionToken: string;
  hotelId: string;
  lastActiveDate: string;
  housekeeper_assignments?: any; // Flexible: peut être un array ou un Record
  lastSyncTimestamp?: number;
}

export class SessionPersistenceService {
  private static readonly STORAGE_KEY = 'hotel_session_persistence';
  private static readonly MAX_SESSION_DAYS = 7; // Sessions expire after 7 days
  private static readonly BACKUP_KEY = 'hotel_session_backup';

  // Sauvegarder la session en cours avec backup
  static saveSessionData(sessionData: SessionPersistenceData): void {
    try {
      // Vérification de cohérence avant sauvegarde
      if (!sessionData.hotelId || sessionData.hotelId.length < 10) {
        console.warn('⚠️ HotelId invalide, sauvegarde annulée');
        return;
      }

      const dataWithTimestamp = {
        ...sessionData,
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (this.MAX_SESSION_DAYS * 24 * 60 * 60 * 1000)).toISOString(),
        lastSyncTimestamp: Date.now()
      };
      
      // Triple sauvegarde pour redondance maximale
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataWithTimestamp));
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify(dataWithTimestamp));
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataWithTimestamp));
      
      console.log('✅ Session data saved with backup:', {
        hotelId: dataWithTimestamp.hotelId.slice(0, 8) + '...',
        housekeepers: Array.isArray(sessionData.housekeeper_assignments) 
          ? sessionData.housekeeper_assignments.length 
          : Object.keys(sessionData.housekeeper_assignments || {}).length,
        lastSyncTimestamp: new Date(dataWithTimestamp.lastSyncTimestamp).toLocaleString()
      });
    } catch (error) {
      console.error('❌ Failed to save session data:', error);
    }
  }

  // Récupérer les données de session sauvegardées avec fallbacks
  static getSavedSessionData(): SessionPersistenceData | null {
    try {
      // Essayer localStorage principal
      let saved = localStorage.getItem(this.STORAGE_KEY);
      
      // Fallback vers backup si principal échoue
      if (!saved) {
        console.log('⚠️ Primary storage empty, trying backup...');
        saved = localStorage.getItem(this.BACKUP_KEY);
      }
      
      // Fallback vers sessionStorage
      if (!saved) {
        console.log('⚠️ Backup empty, trying sessionStorage...');
        saved = sessionStorage.getItem(this.STORAGE_KEY);
      }
      
      if (!saved) {
        console.log('⚠️ No saved session data found in any storage');
        return null;
      }

      const data = JSON.parse(saved);
      
      // Vérification de cohérence des données
      if (!data.hotelId || data.hotelId.length < 10) {
        console.warn('⚠️ Données corrompues: hotelId invalide');
        this.clearSavedSession();
        return null;
      }
      
      // Vérifier si la session a expiré
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        console.log('⚠️ Saved session expired, clearing');
        this.clearSavedSession();
        return null;
      }

      // Vérifier la fraîcheur des données (max 24h)
      if (data.lastSyncTimestamp) {
        const hoursSinceSync = (Date.now() - data.lastSyncTimestamp) / (1000 * 60 * 60);
        if (hoursSinceSync > 24) {
          console.warn('⚠️ Données obsolètes (>24h depuis dernière sync)');
        }
      }

      console.log('✅ Session data restored:', {
        hotelId: data.hotelId?.slice(0, 8) + '...',
        housekeepers: Array.isArray(data.housekeeper_assignments) 
          ? data.housekeeper_assignments.length 
          : Object.keys(data.housekeeper_assignments || {}).length,
        age: data.savedAt ? Math.round((Date.now() - new Date(data.savedAt).getTime()) / 1000 / 60) + ' minutes' : 'unknown',
        lastSyncTimestamp: data.lastSyncTimestamp ? new Date(data.lastSyncTimestamp).toLocaleString() : 'N/A'
      });

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

  // Archiver le rapport du jour précédent (deprecated - les rooms sont dans la table rooms)
  static async archiveOldReport(sessionToken: string, hotelId: string): Promise<boolean> {
    console.log('📦 Archiving old report - deprecated, skipping');
    return true;
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
      localStorage.removeItem(this.BACKUP_KEY);
      sessionStorage.removeItem(this.STORAGE_KEY);
      console.log('🧹 Saved session data cleared from all storages');
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
}