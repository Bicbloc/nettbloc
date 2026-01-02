import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeCallback = (table: string, payload: any) => void;
type StatusCallback = (status: string) => void;

interface Subscription {
  id: string;
  callback: RealtimeCallback;
}

/**
 * Singleton pour gérer UNE SEULE connexion temps réel pour toute l'app
 * Avec heartbeat actif, reconnexion rapide et gestion de session auth
 */
class RealtimeManager {
  private static instance: RealtimeManager;
  private channel: RealtimeChannel | null = null;
  private hotelId: string | null = null;
  private subscriptions: Map<string, Subscription[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private lastConnectionAttempt = 0;
  private minTimeBetweenAttempts = 2000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private statusCallbacks: Set<StatusCallback> = new Set();
  private isOnline = true;
  private lastSuccessfulPing = Date.now();
  private isPaused = false;
  private authListenerUnsubscribe: (() => void) | null = null;
  private consecutiveFailures = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      
      // Écouter les changements d'authentification
      this.setupAuthListener();
    }
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  private setupAuthListener() {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 RealtimeManager: Auth event:', event);
      
      if (event === 'SIGNED_OUT') {
        console.log('🔐 RealtimeManager: Déconnexion détectée, nettoyage...');
        this.disconnect();
      } else if (event === 'SIGNED_IN' && this.hotelId) {
        console.log('🔐 RealtimeManager: Connexion détectée, reconnexion...');
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;
        setTimeout(() => this.forceReconnect(), 1000);
      } else if (event === 'TOKEN_REFRESHED') {
        // Token rafraîchi, vérifier la connexion
        this.lastSuccessfulPing = Date.now();
      }
    });
    
    this.authListenerUnsubscribe = subscription.unsubscribe;
  }

  private handleOnline() {
    console.log('🌐 Réseau: En ligne');
    this.isOnline = true;
    this.consecutiveFailures = 0;
    this.notifyStatus('ONLINE');
    
    if (this.hotelId) {
      this.reconnectAttempts = 0;
      setTimeout(() => this.forceReconnect(), 500);
    }
  }

  private handleOffline() {
    console.log('📵 Réseau: Hors ligne');
    this.isOnline = false;
    this.stopHeartbeat();
    this.notifyStatus('OFFLINE');
  }

  private notifyStatus(status: string) {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (e) {
        console.error('Error in status callback:', e);
      }
    });
  }

  /**
   * Initialise la connexion temps réel pour un hôtel
   */
  async connect(hotelId: string): Promise<boolean> {
    if (!hotelId || hotelId.length < 10) {
      console.warn('⚠️ RealtimeManager: hotelId invalide', hotelId);
      return false;
    }

    const now = Date.now();
    if (this.isConnecting) {
      console.log('⏳ RealtimeManager: Connexion déjà en cours');
      return false;
    }

    if (now - this.lastConnectionAttempt < this.minTimeBetweenAttempts) {
      console.log('⏳ RealtimeManager: Trop tôt pour reconnecter');
      return false;
    }

    // Déjà connecté au même hôtel
    if (this.channel && this.hotelId === hotelId && this.consecutiveFailures === 0) {
      return true;
    }

    // Changement d'hôtel
    if (this.hotelId && this.hotelId !== hotelId) {
      console.log('🔄 RealtimeManager: Changement d\'hôtel');
      this.disconnect();
    }

    this.isConnecting = true;
    this.lastConnectionAttempt = now;
    this.hotelId = hotelId;

    console.log('🔗 RealtimeManager: Connexion...', hotelId.slice(0, 8) + '...');

    // Nettoyer l'ancien canal si existant
    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch (e) {
        console.warn('Cleanup channel error:', e);
      }
      this.channel = null;
    }

    const channelName = `realtime_${hotelId}_${Date.now()}`;
    this.channel = supabase.channel(channelName);

    const tables = ['notifications', 'room_status_updates', 'assignments', 'rooms'];
    
    tables.forEach(table => {
      this.channel!.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `hotel_id=eq.${hotelId}`
        },
        (payload) => {
          this.lastSuccessfulPing = Date.now();
          this.consecutiveFailures = 0;
          this.notifySubscribers(table, payload);
        }
      );
    });

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('⏰ RealtimeManager: Timeout de connexion');
        this.isConnecting = false;
        this.consecutiveFailures++;
        resolve(false);
      }, 10000);

      this.channel!.subscribe((status) => {
        console.log('📡 RealtimeManager statut:', status);
        this.notifyStatus(status);
        
        switch (status) {
          case 'SUBSCRIBED':
            clearTimeout(timeoutId);
            console.log('✅ RealtimeManager: Connecté');
            this.reconnectAttempts = 0;
            this.consecutiveFailures = 0;
            this.isConnecting = false;
            this.lastSuccessfulPing = Date.now();
            this.startHeartbeat();
            resolve(true);
            break;
            
          case 'CLOSED':
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            clearTimeout(timeoutId);
            console.log('❌ RealtimeManager: Erreur', status);
            this.isConnecting = false;
            this.consecutiveFailures++;
            this.stopHeartbeat();
            this.scheduleReconnect();
            resolve(false);
            break;
        }
      });
    });
  }

  /**
   * Reconnexion avec backoff exponentiel (max 15s)
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (!this.isOnline) {
      console.log('📵 RealtimeManager: Hors ligne, attente...');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ RealtimeManager: Abandon après', this.maxReconnectAttempts, 'tentatives');
      this.notifyStatus('FAILED');
      setTimeout(() => {
        this.reconnectAttempts = 0;
      }, 60000);
      return;
    }

    // Backoff: 2s, 4s, 8s, max 15s
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 2000, 15000);
    this.reconnectAttempts++;

    console.log(`🔄 RealtimeManager: Reconnexion dans ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.notifyStatus('RECONNECTING');

    this.reconnectTimeout = setTimeout(() => {
      if (this.hotelId && this.isOnline && !this.isPaused) {
        this.connect(this.hotelId);
      }
    }, delay);
  }

  subscribe(table: string, callback: RealtimeCallback): string {
    const subscriptionId = `${table}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    if (!this.subscriptions.has(table)) {
      this.subscriptions.set(table, []);
    }
    
    this.subscriptions.get(table)!.push({ id: subscriptionId, callback });
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string) {
    for (const [table, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(table);
        }
        break;
      }
    }
  }

  private notifySubscribers(table: string, payload: any) {
    const subscribers = this.subscriptions.get(table);
    if (subscribers) {
      subscribers.forEach(sub => {
        try {
          sub.callback(table, payload);
        } catch (error) {
          console.error('❌ Erreur callback:', error);
        }
      });
    }
  }

  pause() {
    this.isPaused = true;
    console.log('⏸️ RealtimeManager: Pause');
  }

  resume() {
    this.isPaused = false;
    console.log('▶️ RealtimeManager: Reprise');
    if (this.consecutiveFailures > 0 && this.hotelId) {
      this.forceReconnect();
    }
  }

  /**
   * Heartbeat avec vérification session auth (30s)
   */
  private startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(async () => {
      if (!this.channel || !this.isOnline || this.isPaused) return;

      try {
        // 1) Vérifier/rafraîchir la session avant de ping
        const { data: { session } } = await supabase.auth.getSession();

        const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
        const shouldRefresh = !!expiresAtMs && (expiresAtMs - Date.now() < 2 * 60 * 1000);

        if (!session || shouldRefresh) {
          const { data, error } = await supabase.auth.refreshSession();
          if (error || !data.session) {
            console.log('💔 Heartbeat: Session invalide (refresh échoué)');
            this.consecutiveFailures++;
            if (this.consecutiveFailures >= 2) {
              this.notifyStatus('AUTH_EXPIRED');
            }
            return;
          }
          this.lastSuccessfulPing = Date.now();
          this.consecutiveFailures = 0;
        }

        // 2) Ping léger (tolérer "no rows" comme OK)
        const { error: pingError } = await supabase
          .from('hotels')
          .select('id')
          .limit(1)
          .maybeSingle();

        // PGRST116 = no rows returned (ce n'est pas une panne réseau)
        if (pingError && (pingError as any).code !== 'PGRST116') {
          this.consecutiveFailures++;
          console.log('💔 Heartbeat: Échec', this.consecutiveFailures, pingError);

          if (this.consecutiveFailures >= 3) {
            this.scheduleReconnect();
          }
        } else {
          this.lastSuccessfulPing = Date.now();
          this.consecutiveFailures = 0;
        }
      } catch (err) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.scheduleReconnect();
        }
      }
    }, 30000); // 30 secondes
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Ajouter un callback pour les changements de statut
   */
  onConnectionStatusChange(callback: StatusCallback) {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.channel) {
      console.log('🧹 RealtimeManager: Déconnexion');
      try {
        supabase.removeChannel(this.channel);
      } catch (e) {
        console.warn('Disconnect error:', e);
      }
      this.channel = null;
    }

    this.hotelId = null;
    this.reconnectAttempts = 0;
    this.consecutiveFailures = 0;
    this.isConnecting = false;
  }

  forceReconnect() {
    console.log('🔄 RealtimeManager: Reconnexion forcée');
    this.reconnectAttempts = 0;
    this.consecutiveFailures = 0;
    
    if (this.hotelId) {
      const hotelId = this.hotelId;
      this.disconnect();
      setTimeout(() => this.connect(hotelId), 500);
    }
  }

  getStatus() {
    return {
      isConnected: this.channel !== null && this.consecutiveFailures < 2,
      hotelId: this.hotelId,
      reconnectAttempts: this.reconnectAttempts,
      consecutiveFailures: this.consecutiveFailures,
      lastPing: this.lastSuccessfulPing,
      subscribersCount: Array.from(this.subscriptions.values()).reduce((acc, subs) => acc + subs.length, 0)
    };
  }
}

export const realtimeManager = RealtimeManager.getInstance();
