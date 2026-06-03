import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PlanType } from "@/hooks/useSubscription";

export interface PricingConfigRow {
  plan_name: PlanType;
  price_monthly: number;
  max_rooms: number | null;
  is_active: boolean;
  trial_days: number;
}

export function usePricingConfig() {
  const [plans, setPlans] = useState<PricingConfigRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pricing_config")
        .select("plan_name, price_monthly, max_rooms, is_active")
        .order("price_monthly", { ascending: true });

      if (error) throw error;

      setPlans(
        (data || []).map((row) => ({
          plan_name: row.plan_name as PlanType,
          price_monthly: Number(row.price_monthly),
          max_rooms: row.max_rooms === null ? null : Number(row.max_rooms),
          is_active: Boolean(row.is_active),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byPlan = useMemo(() => {
    const entries = plans.map((p) => [p.plan_name, p] as const);
    return Object.fromEntries(entries) as Partial<Record<PlanType, PricingConfigRow>>;
  }, [plans]);

  return { plans, byPlan, loading, refresh: load, setPlans };
}
