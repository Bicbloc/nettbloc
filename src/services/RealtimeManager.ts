import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeCallback = (table: string, payload: any) => void;
type StatusCallback = (status: string) => void;

interface Subscription {
  id: string;
  callback: RealtimeCallback;
}

// Événements auth globaux (définis dans AuthContext)
const AUTH_EVENTS = {
  SIGNED_IN: 'auth:signed_in',
  SIGNED_OUT: 'auth:signed_out',
  SESSION_REFRESHED: 'auth:session_refreshed',
};

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
  private minTimeBetweenAttempts = 500; // Réduit pour des mises à jour plus rapides
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private statusCallbacks: Set<StatusCallback> = new Set();
  private isOnline = true;
  private lastSuccessfulPing = Date.now();
  private isPaused = false;
  private authListenerUnsubscribe: (() => void) | null = null;
  private consecutiveFailures = 0;
  private isForceReconnecting = false;
  private pendingHotelId: string | null = null; // Hôtel en attente de connexion auth

  // état réel du canal
  private isSubscribed = false;
  private lastStatus: string = 'DISCONNECTED';

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());

      // Écouter les événements globaux d'auth
      this.setupGlobalAuthListener();

      // Réduire l'agressivité de visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.hotelId) {
          const timeSinceLastPing = Date.now() - this.lastSuccessfulPing;
          if (timeSinceLastPing > 60000) {
            this.softReconnect();
          }
        }
      });

      this.setupAuthListener();
    }
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * Écoute les événements auth globaux émis par AuthContext
   * (plus fiable que onAuthStateChange pour la synchronisation)
   */
  private setupGlobalAuthListener() {
    window.addEventListener(AUTH_EVENTS.SIGNED_IN, ((event: CustomEvent) => {
      
      // Reset compteurs
      this.reconnectAttempts = 0;
      this.consecutiveFailures = 0;
      
      // Si on a un hôtel en attente, se connecter maintenant
      const targetHotel = this.pendingHotelId || this.hotelId;
      if (targetHotel) {
        setTimeout(() => this.connect(targetHotel), 500);
      }
    }) as EventListener);

    window.addEventListener(AUTH_EVENTS.SIGNED_OUT, () => {
      this.disconnect();
      this.pendingHotelId = null;
    });

    window.addEventListener(AUTH_EVENTS.SESSION_REFRESHED, () => {
      this.lastSuccessfulPing = Date.now();
      this.consecutiveFailures = 0;
      
      // Si déconnecté mais avec un hôtel, tenter reconnexion
      if (!this.isSubscribed && this.hotelId) {
        this.softReconnect();
      }
    });
  }

  private setupAuthListener() {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;


      if (event === 'SIGNED_OUT') {
        this.disconnect();
      } else if (event === 'TOKEN_REFRESHED') {
        this.lastSuccessfulPing = Date.now();
        this.consecutiveFailures = 0;
      }
    });

    this.authListenerUnsubscribe = subscription.unsubscribe;
  }

  private handleOnline() {
    this.isOnline = true;
    this.consecutiveFailures = 0;
    this.notifyStatus('ONLINE');

    if (this.hotelId) {
      this.reconnectAttempts = 0;
      setTimeout(() => this.softReconnect(), 500);
    }
  }

  private handleOffline() {
    this.isOnline = false;
    this.stopHeartbeat();
    this.notifyStatus('OFFLINE');
  }

  private notifyStatus(status: string) {
    this.lastStatus = status;
    this.statusCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch (e) {
        console.error('Error in status callback:', e);
      }
    });
  }

  private waitForSubscribed(targetHotelId: string, timeoutMs = 15000) {
    return new Promise<boolean>((resolve) => {
      const start = Date.now();

      const tick = () => {
        // Si on a changé d'hôtel entre temps
        if (this.hotelId !== targetHotelId) return resolve(false);

        if (this.isSubscribed) return resolve(true);

        if (Date.now() - start > timeoutMs) return resolve(false);

        setTimeout(tick, 250);
      };

      tick();
    });
  }

  /**
   * Soft reconnect - ne déconnecte pas si déjà connecté au même hôtel
   */
  private async softReconnect() {
    if (!this.hotelId || this.isConnecting) return;

    // Si le canal est SUBSCRIBED et sain, ne rien faire
    if (this.isSubscribed && this.consecutiveFailures < 2) {
      return;
    }

    await this.connect(this.hotelId);
  }

  /**
   * Initialise la connexion temps réel pour un hôtel
   */
  async connect(hotelId: string): Promise<boolean> {
    if (!hotelId || hotelId.length < 10) {
      return false;
    }

    const now = Date.now();

    // Éviter les connexions simultanées
    if (this.isConnecting) {
      if (this.hotelId === hotelId) {
        return this.waitForSubscribed(hotelId);
      }

      return false;
    }

    // Rate limiting sauf pour force reconnect
    if (
      !this.isForceReconnecting &&
      now - this.lastConnectionAttempt < this.minTimeBetweenAttempts
    ) {
      // Si c'est le même hôtel et déjà connecté, renvoyer true
      if (this.hotelId === hotelId && this.isSubscribed) {
        return true;
      }

      return false;
    }

    // Déjà connecté au même hôtel et fonctionnel
    if (this.channel && this.hotelId === hotelId && this.isSubscribed && this.consecutiveFailures === 0) {
      return true;
    }

    // Mémoriser le dernier hotelId demandé
    const previousHotelId = this.hotelId;
    this.hotelId = hotelId;

    // Vérifier session auth
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      this.pendingHotelId = hotelId; // Mémoriser pour connexion post-login
      this.isSubscribed = false;
      this.isConnecting = false;
      this.stopHeartbeat();
      await this.cleanupChannel();
      this.notifyStatus('AUTH_REQUIRED');
      return false;
    }
    
    // Session OK - effacer pending
    this.pendingHotelId = null;

    // Changement d'hôtel - déconnecter proprement
    if (previousHotelId && previousHotelId !== hotelId) {
      await this.cleanupChannel();
    }

    this.isConnecting = true;
    this.lastConnectionAttempt = now;
    this.hotelId = hotelId;
    this.isSubscribed = false;

    this.notifyStatus('CONNECTING');

    // Nettoyer l'ancien canal si existant
    await this.cleanupChannel();

    const channelName = `realtime_${hotelId}_${Date.now()}`;
    this.channel = supabase.channel(channelName);

    const tables = ['notifications', 'room_status_updates', 'assignments', 'rooms', 'daily_reports'];

    tables.forEach((table) => {
      this.channel!.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `hotel_id=eq.${hotelId}`,
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

        this.isConnecting = false;
        this.isForceReconnecting = false;
        this.isSubscribed = false;
        this.consecutiveFailures++;

        this.stopHeartbeat();
        this.cleanupChannel();
        this.notifyStatus('TIMED_OUT');
        this.scheduleReconnect();

        resolve(false);
      }, 15000);

      this.channel!.subscribe((status) => {

        switch (status) {
          case 'SUBSCRIBED':
            clearTimeout(timeoutId);
            this.reconnectAttempts = 0;
            this.consecutiveFailures = 0;
            this.isConnecting = false;
            this.isForceReconnecting = false;
            this.isSubscribed = true;
            this.lastSuccessfulPing = Date.now();
            this.startHeartbeat();
            this.notifyStatus('SUBSCRIBED');
            resolve(true);
            break;

          case 'CLOSED':
            this.isSubscribed = false;

            // CLOSED peut arriver pendant le setup, laisser le timeout gérer
            if (this.isConnecting) {
              this.notifyStatus('CLOSED');
              break;
            }

            this.stopHeartbeat();
            this.consecutiveFailures++;
            this.notifyStatus('CLOSED');
            this.cleanupChannel();
            this.scheduleReconnect();
            break;

          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            clearTimeout(timeoutId);
            this.isConnecting = false;
            this.isForceReconnecting = false;
            this.isSubscribed = false;
            this.consecutiveFailures++;
            this.stopHeartbeat();
            this.notifyStatus(status);
            this.cleanupChannel();
            this.scheduleReconnect();
            resolve(false);
            break;
        }
      });
    });
  }

  /**
   * Nettoyage propre du canal sans effacer hotelId
   */
  private async cleanupChannel() {
    if (this.channel) {
      try {
        await supabase.removeChannel(this.channel);
      } catch (e) {
        // Ignorer les erreurs de cleanup
      }
      this.channel = null;
    }

    this.isSubscribed = false;
  }

  /**
   * Reconnexion avec backoff exponentiel (max 30s)
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (!this.isOnline) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyStatus('FAILED');
      setTimeout(() => {
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;
      }, 120000);
      return;
    }

    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 15000);
    this.reconnectAttempts++;

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
      const index = subs.findIndex((s) => s.id === subscriptionId);
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
      subscribers.forEach((sub) => {
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
  }

  resume() {
    this.isPaused = false;
    if (this.consecutiveFailures > 0 && this.hotelId) {
      this.softReconnect();
    }
  }

  /**
   * Heartbeat avec ping edge function (bypassant RLS) et refresh session
   */
  private startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(async () => {
      if (!this.channel || !this.isOnline || this.isPaused) return;

      try {
        // 1) Vérifier/rafraîchir la session si proche expiration
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
          const shouldRefresh =
            !!expiresAtMs && expiresAtMs - Date.now() < 5 * 60 * 1000; // 5 min avant expiration

          if (shouldRefresh) {
            const { error } = await supabase.auth.refreshSession();
            if (!error) {
              this.lastSuccessfulPing = Date.now();
            }
          }
        }

        // 2) Ping via edge function (bypasse RLS)
        const { data, error: pingError } = await supabase.functions.invoke('ping');

        if (pingError || !data?.ok) {
          this.consecutiveFailures++;

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
    }, 30000); // Heartbeat toutes les 30s pour détection plus rapide
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
      try {
        supabase.removeChannel(this.channel);
      } catch (e) {
        // Ignorer
      }
      this.channel = null;
    }

    this.isSubscribed = false;
    this.notifyStatus('CLOSED');

    this.hotelId = null;
    this.reconnectAttempts = 0;
    this.consecutiveFailures = 0;
    this.isConnecting = false;
    this.isForceReconnecting = false;
  }

  /**
   * Force reconnect sans perdre hotelId
   */
  forceReconnect() {
    if (!this.hotelId) return;

    const hotelId = this.hotelId;

    this.isForceReconnecting = true;
    this.reconnectAttempts = 0;
    this.consecutiveFailures = 0;

    // Nettoyer le canal mais garder hotelId
    this.cleanupChannel().then(() => {
      setTimeout(() => this.connect(hotelId), 300);
    });
  }

  getStatus() {
    return {
      isConnected: this.isSubscribed && this.consecutiveFailures < 2,
      hotelId: this.hotelId,
      reconnectAttempts: this.reconnectAttempts,
      consecutiveFailures: this.consecutiveFailures,
      lastPing: this.lastSuccessfulPing,
      lastStatus: this.lastStatus,
      subscribersCount: Array.from(this.subscriptions.values()).reduce(
        (acc, subs) => acc + subs.length,
        0
      ),
    };
  }
}

export const realtimeManager = RealtimeManager.getInstance();
