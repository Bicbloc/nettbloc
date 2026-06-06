/**
 * Service de gestion de la facturation des petits-déjeuners par hôtel.
 * Pattern aligné sur reportConfigService (load/save par hotel_id).
 */
import { supabase } from '@/integrations/supabase/client';

export interface BreakfastType {
  name: string;
  price: number;
}

export interface BreakfastConfig {
  id?: string;
  hotel_id: string;
  is_active: boolean;
  pricing_source: 'manual' | 'pms';
  price_per_person: number;
  currency: string;
  breakfast_types: BreakfastType[];
  default_included: boolean;
}

export interface BreakfastLogItem {
  name: string;
  qty: number;
  price: number;
}

export interface BreakfastLog {
  id: string;
  hotel_id: string;
  room_number: string;
  log_date: string;
  people_count: number;
  breakfast_type: string | null;
  unit_price: number;
  total_amount: number;
  included: boolean;
  source: string;
  logged_by: string | null;
  pms_status: string;
  items: BreakfastLogItem[];
}

const DEFAULT_CONFIG = (hotelId: string): BreakfastConfig => ({
  hotel_id: hotelId,
  is_active: false,
  pricing_source: 'manual',
  price_per_person: 0,
  currency: 'EUR',
  breakfast_types: [],
  default_included: false,
});

export function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/** Charge la configuration petit-déjeuner d'un hôtel (ou des valeurs par défaut). */
export async function loadBreakfastConfig(hotelId: string): Promise<BreakfastConfig> {
  const { data, error } = await supabase
    .from('hotel_breakfast_configs')
    .select('*')
    .eq('hotel_id', hotelId)
    .maybeSingle();

  if (error) {
    console.error('[breakfast] load config error:', error);
    return DEFAULT_CONFIG(hotelId);
  }
  if (!data) return DEFAULT_CONFIG(hotelId);

  return {
    id: data.id,
    hotel_id: data.hotel_id,
    is_active: data.is_active,
    pricing_source: (data.pricing_source as 'manual' | 'pms') || 'manual',
    price_per_person: Number(data.price_per_person) || 0,
    currency: data.currency || 'EUR',
    breakfast_types: Array.isArray(data.breakfast_types)
      ? (data.breakfast_types as unknown as BreakfastType[])
      : [],
    default_included: !!data.default_included,
  };
}

/** Enregistre (upsert) la configuration petit-déjeuner d'un hôtel. */
export async function saveBreakfastConfig(config: BreakfastConfig): Promise<boolean> {
  const payload = {
    hotel_id: config.hotel_id,
    is_active: config.is_active,
    pricing_source: config.pricing_source,
    price_per_person: config.price_per_person,
    currency: config.currency,
    breakfast_types: config.breakfast_types as unknown as never,
    default_included: config.default_included,
  };

  const { data: existing } = await supabase
    .from('hotel_breakfast_configs')
    .select('id')
    .eq('hotel_id', config.hotel_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('hotel_breakfast_configs')
      .update(payload)
      .eq('id', existing.id);
    if (error) {
      console.error('[breakfast] update config error:', error);
      return false;
    }
  } else {
    const { error } = await supabase.from('hotel_breakfast_configs').insert(payload);
    if (error) {
      console.error('[breakfast] insert config error:', error);
      return false;
    }
  }
  return true;
}

/** Charge les déclarations petit-déjeuner du jour pour un hôtel. */
export async function loadBreakfastLogs(
  hotelId: string,
  logDate: string = todayDate()
): Promise<BreakfastLog[]> {
  const { data, error } = await supabase
    .from('breakfast_logs')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('log_date', logDate);

  if (error) {
    console.error('[breakfast] load logs error:', error);
    return [];
  }
  return (data || []) as unknown as BreakfastLog[];
}

interface UpsertLogParams {
  hotelId: string;
  roomNumber: string;
  peopleCount: number;
  breakfastType: string | null;
  unitPrice: number;
  included: boolean;
  items?: BreakfastLogItem[];
  loggedBy?: string | null;
  logDate?: string;
}

/** Crée ou met à jour la déclaration petit-déjeuner d'une chambre (1 par jour). */
export async function upsertBreakfastLog(params: UpsertLogParams): Promise<boolean> {
  const {
    hotelId,
    roomNumber,
    peopleCount,
    breakfastType,
    unitPrice,
    included,
    items = [],
    loggedBy = null,
    logDate = todayDate(),
  } = params;

  const cleanItems = items.filter((i) => i.qty > 0);
  const total = included
    ? 0
    : Number(cleanItems.reduce((s, i) => s + i.qty * i.price, 0).toFixed(2));

  const payload = {
    hotel_id: hotelId,
    room_number: roomNumber,
    log_date: logDate,
    people_count: peopleCount,
    breakfast_type: breakfastType,
    unit_price: unitPrice,
    total_amount: total,
    included,
    items: cleanItems as unknown as never,
    source: 'manual',
    logged_by: loggedBy,
    pms_status: 'pending',
  };

  const { error } = await supabase
    .from('breakfast_logs')
    .upsert(payload, { onConflict: 'hotel_id,room_number,log_date' });

  if (error) {
    console.error('[breakfast] upsert log error:', error);
    return false;
  }
  return true;
}

/** Supprime la déclaration petit-déjeuner d'une chambre pour la journée. */
export async function deleteBreakfastLog(
  hotelId: string,
  roomNumber: string,
  logDate: string = todayDate()
): Promise<boolean> {
  const { error } = await supabase
    .from('breakfast_logs')
    .delete()
    .eq('hotel_id', hotelId)
    .eq('room_number', roomNumber)
    .eq('log_date', logDate);

  if (error) {
    console.error('[breakfast] delete log error:', error);
    return false;
  }
  return true;
}

/**
 * Envoie les petits-déjeuners facturés du jour au PMS pour facturation directe.
 * Cible la fonction edge `breakfast-pms-sync` (Apaleo / Mews).
 * Si `roomNumber` est fourni, n'envoie que cette chambre.
 */
export async function sendBreakfastsToPms(
  hotelId: string,
  logDate: string = todayDate(),
  roomNumber?: string,
): Promise<{ ok: boolean; sent: number; failed: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke('breakfast-pms-sync', {
    body: { hotel_id: hotelId, log_date: logDate, room_number: roomNumber },
  });
  if (error) {
    console.error('[breakfast] pms sync error:', error);
    return { ok: false, sent: 0, failed: 0, error: error.message };
  }
  return { ok: true, sent: data?.sent ?? 0, failed: data?.failed ?? 0 };
}

/** Indique si un hôtel a une configuration PMS active (Apaleo/Mews). */
export async function hasActivePmsConfig(hotelId: string): Promise<boolean> {
  const { data } = await supabase
    .from('hotel_pms_configs')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .in('pms_type', ['apaleo', 'mews'])
    .maybeSingle();
  return !!data;
}

