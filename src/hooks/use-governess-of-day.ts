import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Récupère la gouvernante du jour pour un hôtel (et éventuellement
 * pour une femme de chambre donnée si elle figure dans l'assignation).
 */
export function useGovernessOfDay(hotelId: string | null | undefined, housekeeperName?: string) {
  const [governessName, setGovernessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hotelId) {
      setGovernessName(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const { data } = await supabase
        .from('daily_governess_assignments')
        .select('governess_name, assigned_housekeepers')
        .eq('hotel_id', hotelId)
        .eq('assignment_date', today);

      if (cancelled) return;

      const rows = (data as { governess_name: string; assigned_housekeepers: string[] | null }[]) || [];

      // Priorité: l'assignation qui contient explicitement cette femme de chambre
      let match = housekeeperName
        ? rows.find(r => (r.assigned_housekeepers || []).some(h => h && h.toLowerCase() === housekeeperName.toLowerCase()))
        : undefined;

      // Sinon, la première gouvernante assignée à l'hôtel aujourd'hui
      if (!match && rows.length > 0) match = rows[0];

      setGovernessName(match?.governess_name || null);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [hotelId, housekeeperName]);

  return { governessName, loading };
}
