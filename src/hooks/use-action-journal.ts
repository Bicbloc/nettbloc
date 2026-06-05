import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { realtimeManager } from '@/services/RealtimeManager';
import { nativeNotificationService } from '@/services/nativeNotificationService';
import type { Notification } from './use-notifications';

/**
 * Journal des actions complet pour l'admin/établissement.
 * Source de vérité: table `daily_action_logs` (toutes les actions: chambres,
 * affectations, incidents, nettoyage, objets trouvés...).
 *
 * L'état "lu" est géré localement (la table n'a pas de colonne is_read) via
 * localStorage afin que le compteur "non lus" clignote en temps réel.
 */

const isValidHotelId = (id?: string | null): id is string => {
  if (!id || typeof id !== 'string') return false;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const customHotel = /^hotel-[a-zA-Z0-9]+$/;
  return uuid.test(id) || customHotel.test(id);
};

const readKey = (hotelId: string) => `journal_read_ids_${hotelId}`;

const loadReadIds = (hotelId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(readKey(hotelId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

const saveReadIds = (hotelId: string, ids: Set<string>) => {
  try {
    // On limite la taille pour éviter de gonfler le localStorage
    const arr = Array.from(ids).slice(-500);
    localStorage.setItem(readKey(hotelId), JSON.stringify(arr));
  } catch {
    /* ignore */
  }
};

const mapType = (actionType: string): string => {
  const t = (actionType || '').toLowerCase();
  if (t.includes('assign')) return 'assignment';
  if (t.includes('cleaning-start') || t === 'cleaning_start') return 'cleaning-start';
  if (t.includes('cleaning-end') || t === 'cleaning_end') return 'cleaning-end';
  if (t.includes('inspection') || t.includes('status') || t.includes('pms')) return 'room-status';
  if (t.includes('incident') || t.includes('comment') || t.includes('remark') || t.includes('lost')) return 'remark';
  return 'action';
};

const buildTitle = (actionType: string): string => {
  switch (mapType(actionType)) {
    case 'assignment': return 'Affectation';
    case 'cleaning-start': return 'Nettoyage démarré';
    case 'cleaning-end': return 'Nettoyage terminé';
    case 'room-status': return 'Mise à jour chambre';
    case 'remark': return 'Incident / Remarque';
    default: return 'Action';
  }
};

const toNotification = (log: any, readIds: Set<string>): Notification => ({
  id: log.id,
  hotel_id: log.hotel_id,
  title: buildTitle(log.action_type),
  description: log.description || '',
  type: mapType(log.action_type),
  housekeeper_name: log.actor_name || undefined,
  room_number: log.room_number || undefined,
  is_read: readIds.has(log.id),
  user_type: log.actor_type || 'system',
  created_at: log.created_at,
});

export const useActionJournal = (hotelId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const readIdsRef = useRef<Set<string>>(new Set());

  const getEffectiveHotelId = useCallback((): string | null => {
    if (isValidHotelId(hotelId)) return hotelId;
    const stored = storageService.getHotelId();
    return isValidHotelId(stored) ? stored : null;
  }, [hotelId]);

  const loadJournal = useCallback(async () => {
    const effectiveHotelId = getEffectiveHotelId();
    if (!effectiveHotelId) {
      setNotifications([]);
      return;
    }

    try {
      setLoading(true);
      readIdsRef.current = loadReadIds(effectiveHotelId);

      const { data, error } = await supabase
        .from('daily_action_logs')
        .select('*')
        .eq('hotel_id', effectiveHotelId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setNotifications((data || []).map((log) => toNotification(log, readIdsRef.current)));
    } catch (error) {
      console.error('❌ Erreur chargement journal des actions:', error);
    } finally {
      setLoading(false);
    }
  }, [getEffectiveHotelId]);

  // Realtime: nouvelles entrées dans daily_action_logs
  useEffect(() => {
    const effectiveHotelId = getEffectiveHotelId();
    if (!effectiveHotelId) return;

    let subscriptionId: string | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let realtimeConnected = false;

    const setup = async () => {
      subscriptionId = realtimeManager.subscribe('daily_action_logs', (_table, payload) => {
        realtimeConnected = true;
        if (payload.eventType === 'INSERT' && payload.new) {
          const entry = toNotification(payload.new, readIdsRef.current);
          setNotifications((prev) => {
            if (prev.some((n) => n.id === entry.id)) return prev;
            return [entry, ...prev].slice(0, 100);
          });

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('staff-notification', {
                detail: { title: entry.title, description: entry.description },
              })
            );
          }
          nativeNotificationService.sendNotification({
            title: entry.title,
            body: entry.description,
          });
        } else {
          loadJournal();
        }
      });

      await realtimeManager.connect(effectiveHotelId);

      // Polling de secours tant que le realtime n'a pas confirmé
      pollingInterval = setInterval(() => {
        if (!realtimeConnected) loadJournal();
      }, 10000);
    };

    loadJournal();
    setup();

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (subscriptionId) realtimeManager.unsubscribe(subscriptionId);
    };
  }, [getEffectiveHotelId, loadJournal]);

  const hasUnread = notifications.some((n) => !n.is_read);

  const persistRead = useCallback(() => {
    const effectiveHotelId = getEffectiveHotelId();
    if (effectiveHotelId) saveReadIds(effectiveHotelId, readIdsRef.current);
  }, [getEffectiveHotelId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    readIdsRef.current.add(notificationId);
    persistRead();
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  }, [persistRead]);

  const markManyAsRead = useCallback(async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    let changed = false;
    setNotifications((prev) => {
      const next = prev.map((n) => {
        if (idSet.has(n.id) && !n.is_read) {
          readIdsRef.current.add(n.id);
          changed = true;
          return { ...n, is_read: true };
        }
        return n;
      });
      return changed ? next : prev;
    });
    if (changed) persistRead();
  }, [persistRead]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => {
      prev.forEach((n) => readIdsRef.current.add(n.id));
      persistRead();
      return prev.map((n) => ({ ...n, is_read: true }));
    });
  }, [persistRead]);

  // On ne supprime pas le journal: "Effacer" = tout marquer comme lu
  const clearNotifications = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  return {
    notifications,
    loading,
    hasUnread,
    markAsRead,
    markManyAsRead,
    markAllAsRead,
    clearNotifications,
    refreshNotifications: loadJournal,
  };
};
