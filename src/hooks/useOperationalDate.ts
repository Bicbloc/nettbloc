import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Format a Date as a local YYYY-MM-DD string (no UTC shift). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a local Date (midnight local time). */
function parseLocalISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(s: string, n: number): string {
  const d = parseLocalISODate(s);
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

function diffDays(from: string, to: string): number {
  const a = parseLocalISODate(from).getTime();
  const b = parseLocalISODate(to).getTime();
  return Math.round((b - a) / 86400000);
}

export interface OperationalDateInfo {
  /** Today's calendar date (local). */
  today: string;
  /** Last date that was closed (max report_date), or null if never closed. */
  lastClosureDate: string | null;
  /**
   * The operational date the hotel should currently be working on.
   * = lastClosureDate + 1 day, capped at never going past today.
   * If never closed, it's simply today.
   */
  operationalDate: string;
  /** True when the operational date is behind today (missed/unused days). */
  isBehind: boolean;
  /** Number of unused days between the operational date and today (inclusive of today). */
  missedDaysCount: number;
  /** The list of unused dates (operationalDate .. today). */
  missedDates: string[];
  loading: boolean;
  refresh: () => void;
}

/**
 * Computes the hotel's operational date based on actual closures
 * (daily_reports), NOT the calendar/agenda date. Detects gaps caused
 * by bugs, missing connections or disconnections.
 */
export function useOperationalDate(hotelId: string | null): OperationalDateInfo {
  const today = toLocalISODate(new Date());
  const [lastClosureDate, setLastClosureDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!hotelId) {
        if (!cancelled) {
          setLastClosureDate(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('daily_reports')
        .select('report_date')
        .eq('hotel_id', hotelId)
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setLastClosureDate((data?.report_date as string) ?? null);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [hotelId, tick]);

  let operationalDate = today;
  if (lastClosureDate) {
    const next = addDays(lastClosureDate, 1);
    // Never go beyond today.
    operationalDate = diffDays(next, today) < 0 ? today : next;
  }

  const gap = diffDays(operationalDate, today); // >= 0
  const isBehind = gap > 0;
  const missedDaysCount = gap + 1; // includes today as a still-to-open day
  const missedDates: string[] = [];
  for (let i = 0; i <= gap; i++) missedDates.push(addDays(operationalDate, i));

  return {
    today,
    lastClosureDate,
    operationalDate,
    isBehind,
    missedDaysCount,
    missedDates,
    loading,
    refresh,
  };
}
