import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeCallback = (table: string, payload: any) => void;

interface Subscription {
  id: string;
  callback: RealtimeCallback;
}

/**
 * Singleton pour gérer UNE SEULE connexion temps réel pour toute l'app
 * Avec heartbeat actif et reconnexion rapide
 */
class RealtimeManager {
  private static instance: RealtimeManager;
  private channel: RealtimeChannel | null = null;
  private hotelId: string | null = null;
  private subscriptions: Map<string, Subscription[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private lastConnectionAttempt = 0;
  private minTimeBetweenAttempts = 1500; // 1.5 secondes minimum
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private onStatusChangeCallback: ((status: string) => void) | null = null;
  private isOnline = true;
  private lastSuccessfulPing = Date.now();

  private constructor() {
    // Écouter les changements de connectivité réseau
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  private handleOnline() {
    console.log('🌐 Réseau: En ligne');
    this.isOnline = true;
    if (this.hotelId) {
      // Reconnecter immédiatement
      this.reconnectAttempts = 0;
      this.forceReconnect();
    }
  }

  private handleOffline() {
    console.log('📵 Réseau: Hors ligne');
    this.isOnline = false;
    this.stopHeartbeat();
    this.stopPing();
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback('OFFLINE');
    }
  }

  /**
   * Initialise la connexion temps réel pour un hôtel
   */
  async connect(hotelId: string): Promise<boolean> {
    // Validation stricte du hotelId
    if (!hotelId || hotelId.length < 10) {
      console.warn('⚠️ RealtimeManager: hotelId invalide', hotelId);
      return false;
    }

    // Debounce: éviter les tentatives trop rapprochées
    const now = Date.now();
    if (this.isConnecting) {
      console.log('⏳ RealtimeManager: Connexion déjà en cours, ignoré');
      return false;
    }

    if (now - this.lastConnectionAttempt < this.minTimeBetweenAttempts) {
      console.log('⏳ RealtimeManager: Trop tôt pour reconnecter, ignoré');
      return false;
    }

    // Si déjà connecté au même hôtel, ne rien faire
    if (this.channel && this.hotelId === hotelId) {
      console.log('✅ RealtimeManager: Déjà connecté à', hotelId.slice(0, 8) + '...');
      return true;
    }

    // Déconnecter l'ancien canal si changement d'hôtel
    if (this.hotelId && this.hotelId !== hotelId) {
      console.log('🔄 RealtimeManager: Changement d\'hôtel détecté');
      this.disconnect();
    }

    this.isConnecting = true;
    this.lastConnectionAttempt = now;
    this.hotelId = hotelId;

    console.log('🔗 RealtimeManager: Connexion au canal temps réel...', hotelId.slice(0, 8) + '...');

    const channelName = `realtime_${hotelId}_${Date.now()}`;
    this.channel = supabase.channel(channelName);

    // Écouter les changements sur toutes les tables critiques - incluant rooms pour la synchro temps réel
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
          console.log(`📡 RealtimeManager [${table}]:`, payload.eventType);
          this.notifySubscribers(table, payload);
        }
      );
    });

    // Gérer le statut de connexion
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('⏰ RealtimeManager: Timeout de connexion');
        this.isConnecting = false;
        resolve(false);
      }, 10000); // 10 secondes max

      this.channel!.subscribe((status) => {
        console.log('📡 RealtimeManager statut:', status);
        
        // Notifier les observateurs du changement de statut
        if (this.onStatusChangeCallback) {
          this.onStatusChangeCallback(status);
        }
        
        switch (status) {
          case 'SUBSCRIBED':
            clearTimeout(timeoutId);
            console.log('✅ RealtimeManager: Connexion établie');
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            this.lastSuccessfulPing = Date.now();
            this.startHeartbeat();
            this.startPing();
            resolve(true);
            break;
            
          case 'CLOSED':
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            clearTimeout(timeoutId);
            console.log('❌ RealtimeManager: Erreur', status);
            this.isConnecting = false;
            this.stopHeartbeat();
            this.scheduleReconnect();
            resolve(false);
            break;
        }
      });
    });
  }

  /**
   * Planifie une reconnexion avec backoff exponentiel (max 10s)
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (!this.isOnline) {
      console.log('📵 RealtimeManager: Hors ligne, attente du réseau...');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ RealtimeManager: Abandon après', this.maxReconnectAttempts, 'tentatives');
      // Reset après 30s pour permettre une nouvelle tentative
      setTimeout(() => {
        this.reconnectAttempts = 0;
      }, 30000);
      return;
    }

    // Backoff exponentiel avec max 10 secondes (au lieu de 30)
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 10000);
    this.reconnectAttempts++;

    console.log(`🔄 RealtimeManager: Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.hotelId && this.isOnline) {
        this.connect(this.hotelId);
      }
    }, delay);
  }

  /**
   * S'abonner aux changements d'une table
   */
  subscribe(table: string, callback: RealtimeCallback): string {
    const subscriptionId = `${table}_${Date.now()}_${Math.random()}`;
    
    if (!this.subscriptions.has(table)) {
      this.subscriptions.set(table, []);
    }
    
    this.subscriptions.get(table)!.push({
      id: subscriptionId,
      callback
    });

    console.log(`✅ RealtimeManager: Abonnement ajouté pour ${table}`, subscriptionId);
    return subscriptionId;
  }

  /**
   * Se désabonner
   */
  unsubscribe(subscriptionId: string) {
    for (const [table, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        console.log(`🗑️ RealtimeManager: Désabonnement de ${table}`, subscriptionId);
        
        // Si plus d'abonnés pour cette table, nettoyer
        if (subs.length === 0) {
          this.subscriptions.delete(table);
        }
        break;
      }
    }
  }

  /**
   * Notifier tous les abonnés d'une table
   */
  private notifySubscribers(table: string, payload: any) {
    const subscribers = this.subscriptions.get(table);
    if (subscribers) {
      subscribers.forEach(sub => {
        try {
          sub.callback(table, payload);
        } catch (error) {
          console.error('❌ Erreur callback subscriber:', error);
        }
      });
    }
  }

  /**
   * Démarrer le heartbeat avec vrai ping vers Supabase
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(async () => {
      if (!this.channel || !this.isOnline) {
        return;
      }
      
      try {
        // Vrai ping vers Supabase
        const { error } = await supabase
          .from('hotels')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.log('💔 Heartbeat: Échec -', error.message);
          this.scheduleReconnect();
        } else {
          this.lastSuccessfulPing = Date.now();
          console.log('💓 Heartbeat: OK');
        }
      } catch (err) {
        console.log('💔 Heartbeat: Exception');
        this.scheduleReconnect();
      }
    }, 20000); // Toutes les 20 secondes
  }

  /**
   * Ping régulier pour maintenir la connexion active
   */
  private startPing() {
    this.stopPing();
    
    this.pingInterval = setInterval(async () => {
      if (!this.isOnline) return;
      
      const timeSinceLastPing = Date.now() - this.lastSuccessfulPing;
      if (timeSinceLastPing > 60000) { // Plus de 60s sans ping réussi
        console.log('⚠️ Ping: Connexion potentiellement perdue');
        this.forceReconnect();
      }
    }, 15000); // Check toutes les 15 secondes
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Arrêter le heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Définir un callback pour les changements de statut
   */
  onConnectionStatusChange(callback: (status: string) => void) {
    this.onStatusChangeCallback = callback;
  }

  /**
   * Déconnecter proprement
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();
    this.stopPing();

    if (this.channel) {
      console.log('🧹 RealtimeManager: Déconnexion du canal');
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.hotelId = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  /**
   * Forcer une reconnexion
   */
  forceReconnect() {
    console.log('🔄 RealtimeManager: Reconnexion forcée');
    this.reconnectAttempts = 0;
    if (this.hotelId) {
      this.disconnect();
      this.connect(this.hotelId);
    }
  }

  /**
   * Obtenir le statut de connexion
   */
  getStatus() {
    return {
      isConnected: this.channel !== null,
      hotelId: this.hotelId,
      reconnectAttempts: this.reconnectAttempts,
      subscribersCount: Array.from(this.subscriptions.values()).reduce((acc, subs) => acc + subs.length, 0)
    };
  }
}

export const realtimeManager = RealtimeManager.getInstance();
