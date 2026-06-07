import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OccupancyDay {
  forecast_date: string;
  total_rooms: number;
  occupied_rooms: number;
  arrivals: number;
  departures: number;
  stayovers: number;
  occupancy_rate: number;
}

/**
 * Lit le prévisionnel d'occupation (alimenté depuis le PMS) pour un hôtel.
 * Le propriétaire peut déclencher un rafraîchissement (appel PMS direct) ;
 * le personnel lit simplement les valeurs mises en cache.
 */
export function useOccupancyForecast(hotelId: string | null | undefined, opts?: { autoRefresh?: boolean }) {
  const [days, setDays] = useState<OccupancyDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [staleOrEmpty, setStaleOrEmpty] = useState(false);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('pms_occupancy_forecast')
      .select('forecast_date,total_rooms,occupied_rooms,arrivals,departures,stayovers,occupancy_rate,computed_at')
      .eq('hotel_id', hotelId)
      .gte('forecast_date', today)
      .order('forecast_date', { ascending: true });
    const rows = (data as (OccupancyDay & { computed_at?: string })[]) || [];
    setDays(rows);
    // Considère les données obsolètes après 6h (rafraîchissement par le propriétaire).
    const computedAt = rows[0]?.computed_at ? new Date(rows[0].computed_at).getTime() : 0;
    const stale = rows.length === 0 || Date.now() - computedAt > 6 * 60 * 60 * 1000;
    setStaleOrEmpty(stale);
    setLoading(false);
  }, [hotelId]);

  const refresh = useCallback(async () => {
    if (!hotelId) return;
    setRefreshing(true);
    try {
      await supabase.functions.invoke('pms-forecast', { body: { hotel_id: hotelId } });
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [hotelId, load]);

  useEffect(() => {
    load();
  }, [load]);

  // Le propriétaire rafraîchit depuis le PMS si les données sont absentes ou périmées
  useEffect(() => {
    if (opts?.autoRefresh && hotelId && !loading && !refreshing && staleOrEmpty) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.autoRefresh, hotelId, loading, staleOrEmpty]);


  const today = days[0];

  return { days, today, loading, refreshing, refresh, reload: load };
}
