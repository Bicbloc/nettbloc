import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export class ConnectionManager {
  private static instance: ConnectionManager;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isReconnecting = false;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  // Vérifier l'état de la connexion avec timeout
  async checkConnection(): Promise<boolean> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );
      
      const connectionPromise = supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      const { error } = await Promise.race([connectionPromise, timeoutPromise]) as any;
      
      if (error) {
        return false;
      }
      
      this.reconnectAttempts = 0;
      return true;
    } catch (error) {
      return false;
    }
  }

  // Reconnecter automatiquement avec stratégie intelligente
  async attemptReconnection(): Promise<boolean> {
    if (this.isReconnecting) {
      return false;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      toast({
        variant: "destructive",
        title: "Connexion instable",
        description: "Veuillez vérifier votre connexion internet."
      });
      return false;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    try {
      // Backoff exponentiel: 1s, 2s, 4s, 8s...
      const delay = Math.min(Math.pow(2, this.reconnectAttempts - 1) * 1000, 15000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const connected = await this.checkConnection();
      
      if (connected) {
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        toast({
          title: "Connexion rétablie",
          description: "Synchronisation en cours...",
        });
        return true;
      } else {
        this.isReconnecting = false;
        // Réessayer automatiquement
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => this.attemptReconnection(), 1000);
        }
        return false;
      }
    } catch (error) {
      this.isReconnecting = false;
      return false;
    }
  }

  // Réinitialiser le gestionnaire de connexion
  reset(): void {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.isReconnecting = false;
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  // Démarrer la surveillance de connexion
  startMonitoring(): void {
    if (this.connectionCheckInterval) return;
    
    this.connectionCheckInterval = setInterval(async () => {
      const isConnected = await this.checkConnection();
      if (!isConnected && this.reconnectAttempts === 0) {
        this.attemptReconnection();
      }
    }, 60000); // Vérifier toutes les minutes
  }

  // Arrêter la surveillance
  stopMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  // Obtenir le statut actuel
  getStatus(): { 
    attempts: number; 
    maxAttempts: number; 
    isReconnecting: boolean; 
    delay: number; 
  } {
    return {
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      isReconnecting: this.isReconnecting,
      delay: this.reconnectDelay
    };
  }
}

// Service de synchronisation améliore
export class SyncService {
  private static retryCount = 0;
  private static maxRetries = 3;

  // Synchroniser les données de chambre avec retry automatique
  static async syncRoomStatus(hotelId: string, roomNumber: string, status: string): Promise<boolean> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Synchronisation statut chambre ${roomNumber} (tentative ${attempt + 1})`);
        
        const { error } = await supabase
          .from('room_status_updates')
          .insert({
            hotel_id: hotelId,
            room_number: roomNumber,
            status: status,
            message: `Statut mis à jour: ${status}`
          });

        if (error) {
          console.error(`❌ Erreur sync (tentative ${attempt + 1}):`, error);
          if (attempt === this.maxRetries) {
            throw error;
          }
          // Attendre avant la prochaine tentative
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        console.log(`✅ Statut chambre ${roomNumber} synchronisé`);
        this.retryCount = 0;
        return true;
      } catch (error) {
        console.error(`❌ Échec sync chambre ${roomNumber}:`, error);
        if (attempt === this.maxRetries) {
          // Essayer de reconnecter
          const connectionManager = ConnectionManager.getInstance();
          await connectionManager.attemptReconnection();
          return false;
        }
      }
    }
    return false;
  }

  // Synchroniser les assignations
  static async syncAssignment(hotelId: string, roomNumber: string, housekeeperName: string): Promise<boolean> {
    try {
      console.log(`🔄 Synchronisation assignation: ${roomNumber} -> ${housekeeperName}`);
      
      const { error } = await supabase
        .from('assignments')
        .insert({
          hotel_id: hotelId,
          room_id: `room_${roomNumber}`, // Générer un ID temporaire
          housekeeper_name: housekeeperName,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Erreur sync assignation:', error);
        throw error;
      }

      console.log(`✅ Assignation synchronisée: ${roomNumber} -> ${housekeeperName}`);
      return true;
    } catch (error) {
      console.error('❌ Échec sync assignation:', error);
      // Essayer de reconnecter
      const connectionManager = ConnectionManager.getInstance();
      await connectionManager.attemptReconnection();
      return false;
    }
  }

  // Synchroniser les sessions utilisateur
  static async syncUserSession(hotelId: string, userId: string, userName: string, userType: 'admin' | 'housekeeper'): Promise<boolean> {
    try {
      console.log(`🔄 Synchronisation session utilisateur: ${userName}`);
      
      // Désactiver les sessions existantes pour cet utilisateur
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('hotel_id', hotelId);

      // Créer une nouvelle session
      const { error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          hotel_id: hotelId,
          user_name: userName,
          user_type: userType,
          session_token: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          is_active: true
        });

      if (error) {
        console.error('❌ Erreur sync session:', error);
        throw error;
      }

      console.log(`✅ Session utilisateur synchronisée: ${userName}`);
      return true;
    } catch (error) {
      console.error('❌ Échec sync session:', error);
      return false;
    }
  }
}