import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeCallback = (table: string, payload: any) => void;

interface Subscription {
  id: string;
  callback: RealtimeCallback;
}

/**
 * Singleton pour gérer UNE SEULE connexion temps réel pour toute l'app
 * Évite les conflits de canaux multiples et les reconnexions en boucle
 */
class RealtimeManager {
  private static instance: RealtimeManager;
  private channel: RealtimeChannel | null = null;
  private hotelId: string | null = null;
  private subscriptions: Map<string, Subscription[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private lastConnectionAttempt = 0;
  private minTimeBetweenAttempts = 5000; // 5 secondes minimum entre tentatives

  private constructor() {}

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
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

    // Écouter les changements sur toutes les tables critiques
    const tables = ['notifications', 'room_status_updates', 'assignments', 'housekeepers'];
    
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
        
        switch (status) {
          case 'SUBSCRIBED':
            clearTimeout(timeoutId);
            console.log('✅ RealtimeManager: Connexion établie');
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            resolve(true);
            break;
            
          case 'CLOSED':
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            clearTimeout(timeoutId);
            console.log('❌ RealtimeManager: Erreur', status);
            this.isConnecting = false;
            this.scheduleReconnect();
            resolve(false);
            break;
        }
      });
    });
  }

  /**
   * Planifie une reconnexion avec backoff exponentiel
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ RealtimeManager: Abandon après', this.maxReconnectAttempts, 'tentatives');
      return;
    }

    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 30000);
    this.reconnectAttempts++;

    console.log(`🔄 RealtimeManager: Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.hotelId) {
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
   * Déconnecter proprement
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

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
