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
  private minTimeBetweenAttempts = 1000; // Réduit de 2000ms à 1000ms
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private statusCallbacks: Set<StatusCallback> = new Set();
  private isOnline = true;
  private lastSuccessfulPing = Date.now();
  private isPaused = false;
  private authListenerUnsubscribe: (() => void) | null = null;
  private consecutiveFailures = 0;
  private isForceReconnecting = false;

  // état réel du canal (évite "channel !== null" qui est trompeur)
  private isSubscribed = false;
  private lastStatus: string = 'DISCONNECTED';

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());

      // Réduire l'agressivité de visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.hotelId) {
          // Vérifier seulement si déconnecté depuis longtemps
          const timeSinceLastPing = Date.now() - this.lastSuccessfulPing;
          if (timeSinceLastPing > 60000) {
            // 1 minute sans ping
            console.log(
              '👁️ RealtimeManager: Page visible, reconnexion après inactivité'
            );
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

  private setupAuthListener() {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Ignorer les événements répétitifs
      if (event === 'INITIAL_SESSION') return;

      console.log('🔐 RealtimeManager: Auth event:', event);

      if (event === 'SIGNED_OUT') {
        console.log('🔐 RealtimeManager: Déconnexion détectée, nettoyage...');
        this.disconnect();
      } else if (event === 'SIGNED_IN' && this.hotelId) {
        console.log('🔐 RealtimeManager: Connexion détectée, reconnexion...');
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;
        setTimeout(() => this.softReconnect(), 1000);
      } else if (event === 'TOKEN_REFRESHED') {
        this.lastSuccessfulPing = Date.now();
        this.consecutiveFailures = 0;
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
      setTimeout(() => this.softReconnect(), 500);
    }
  }

  private handleOffline() {
    console.log('📵 Réseau: Hors ligne');
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
      console.log('✅ RealtimeManager: Connexion active, skip reconnect');
      return;
    }

    await this.connect(this.hotelId);
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

    // Éviter les connexions simultanées
    if (this.isConnecting) {
      if (this.hotelId === hotelId) {
        console.log('⏳ RealtimeManager: Connexion déjà en cours, attente...');
        return this.waitForSubscribed(hotelId);
      }

      console.log('⏳ RealtimeManager: Connexion déjà en cours (autre hôtel)');
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

      console.log('⏳ RealtimeManager: Trop tôt pour reconnecter');
      return false;
    }

    // Déjà connecté au même hôtel et fonctionnel
    if (this.channel && this.hotelId === hotelId && this.isSubscribed && this.consecutiveFailures === 0) {
      console.log('✅ RealtimeManager: Déjà connecté');
      return true;
    }

    // Mémoriser le dernier hotelId demandé (même si l'auth n'est pas encore prête)
    const previousHotelId = this.hotelId;
    this.hotelId = hotelId;

    // Éviter les boucles sur /auth : pas de session => pas de realtime
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.log('🔐 RealtimeManager: Pas de session, realtime en attente');
      this.isSubscribed = false;
      this.stopHeartbeat();
      await this.cleanupChannel();
      this.notifyStatus('AUTH_REQUIRED');
      return false;
    }

    // Changement d'hôtel - déconnecter proprement
    if (previousHotelId && previousHotelId !== hotelId) {
      console.log("🔄 RealtimeManager: Changement d'hôtel");
      await this.cleanupChannel();
    }

    this.isConnecting = true;
    this.lastConnectionAttempt = now;
    this.hotelId = hotelId;
    this.isSubscribed = false;

    console.log('🔗 RealtimeManager: Connexion...', hotelId.slice(0, 8) + '...');
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
        console.log('⏰ RealtimeManager: Timeout de connexion');

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
        console.log('📡 RealtimeManager statut:', status);

        switch (status) {
          case 'SUBSCRIBED':
            clearTimeout(timeoutId);
            console.log('✅ RealtimeManager: Connecté');
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
              console.log('⚠️ RealtimeManager: CLOSED pendant connexion, attente...');
              this.notifyStatus('CLOSED');
              break;
            }

            console.log('⚠️ RealtimeManager: Canal CLOSED, reconnexion...');
            this.stopHeartbeat();
            this.consecutiveFailures++;
            this.notifyStatus('CLOSED');
            this.cleanupChannel();
            this.scheduleReconnect();
            break;

          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            clearTimeout(timeoutId);
            console.log('❌ RealtimeManager: Erreur', status);
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
      console.log('📵 RealtimeManager: Hors ligne, attente...');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(
        '❌ RealtimeManager: Abandon après',
        this.maxReconnectAttempts,
        'tentatives'
      );
      this.notifyStatus('FAILED');
      // Reset après 2 minutes pour permettre une nouvelle tentative
      setTimeout(() => {
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;
      }, 120000);
      return;
    }

    // Backoff: 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 2000, 30000);
    this.reconnectAttempts++;

    console.log(
      `🔄 RealtimeManager: Reconnexion dans ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );
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
    console.log('⏸️ RealtimeManager: Pause');
  }

  resume() {
    this.isPaused = false;
    console.log('▶️ RealtimeManager: Reprise');
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
            console.log('🔄 Heartbeat: Refresh session préventif');
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
          console.log('💔 Heartbeat: Échec ping edge function', this.consecutiveFailures, pingError?.message);

          if (this.consecutiveFailures >= 3) {
            this.scheduleReconnect();
          }
        } else {
          this.lastSuccessfulPing = Date.now();
          this.consecutiveFailures = 0;
        }
      } catch (err) {
        this.consecutiveFailures++;
        console.log('💔 Heartbeat: Exception', this.consecutiveFailures);
        if (this.consecutiveFailures >= 3) {
          this.scheduleReconnect();
        }
      }
    }, 45000);
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

    console.log('🔄 RealtimeManager: Reconnexion forcée');
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
