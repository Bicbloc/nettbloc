/**
 * Logique partagée d'attribution des chambres aux gouvernantes pour inspection.
 * Utilisée à la fois par l'étape "Gouvernantes" du flux de redistribution et par
 * le bouton "Assignation en masse (selon config)" de la page Inspection.
 *
 * À partir d'une configuration enregistrée (mode + sélections) et d'une liste de
 * gouvernantes disponibles, on répartit équitablement les chambres et on
 * enregistre les attributions du jour dans `daily_governess_assignments`.
 */
import { supabase } from '@/integrations/supabase/client';

export type GovMode = 'housekeeper' | 'floor' | 'roomtype' | 'cleaningtype';

export interface GovStepConfig {
  selectedGovernesses: string[];
  mode: GovMode;
  pickedFloors: number[];
  pickedHousekeepers: string[];
  pickedRoomTypes: string[];
  pickedCleaningTypes: string[];
}

export interface GovLite {
  id: string;
  name: string;
}

export const configKey = (hotelId?: string | null) => `redistrib_config_${hotelId || 'default'}`;

export const loadSavedGovConfig = (hotelId?: string | null): GovStepConfig | null => {
  try {
    const raw = localStorage.getItem(configKey(hotelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { gov?: GovStepConfig };
    return parsed?.gov || null;
  } catch {
    return null;
  }
};

const todayDate = () => new Date().toISOString().split('T')[0];
const normalizeGovName = (name: string) => name.trim().toLocaleLowerCase();

function balancedSplit<T>(items: T[], n: number): T[][] {
  const buckets: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => buckets[i % n].push(item));
  return buckets;
}

interface RoomRow {
  room_number: string;
  floor: number | null;
  room_type: string | null;
  cleaning_type: string | null;
}

/**
 * Renvoie la liste des gouvernantes disponibles aujourd'hui (session active),
 * avec repli sur les gouvernantes approuvées si aucune session n'est ouverte.
 */
export async function getAvailableGovernesses(hotelId: string): Promise<GovLite[]> {
  const [sessions, approved] = await Promise.all([
    supabase
      .from('governess_hotel_sessions')
      .select('governess_profile_id, governess_profiles(id, name)')
      .eq('hotel_id', hotelId)
      .eq('is_active', true),
    supabase
      .from('governess_access_requests')
      .select('governess_profile_id, governess_profiles(id, name)')
      .eq('hotel_id', hotelId)
      .eq('status', 'approved'),
  ]);

  const mapRows = (rows: any[]): GovLite[] =>
    (rows || [])
      .filter((r) => r.governess_profile_id)
      .map((r) => ({
        id: r.governess_profile_id,
        name: (r.governess_profiles?.name || 'Gouvernante').trim() || 'Gouvernante',
      }));

  const active = mapRows((sessions.data as any[]) || []);
  const pool = active.length > 0 ? active : mapRows((approved.data as any[]) || []);

  // Dédupliquer par id
  return Array.from(new Map(pool.map((g) => [g.id, g])).values());
}

/**
 * Répartit les chambres entre les gouvernantes fournies selon la config et
 * enregistre les attributions du jour. Renvoie le nombre de gouvernantes
 * effectivement attribuées.
 */
export async function applyGovernessAssignment(
  hotelId: string,
  config: GovStepConfig,
  governesses: GovLite[],
): Promise<{ ok: boolean; assignedCount: number; error?: string }> {
  const govs = Array.from(
    new Map(
      governesses
        .filter((g) => g.id)
        .map((g) => [normalizeGovName(g.name || 'Gouvernante'), { ...g, name: g.name.trim() || 'Gouvernante' }]),
    ).values(),
  );
  if (govs.length === 0) return { ok: false, assignedCount: 0, error: 'Aucune gouvernante disponible' };

  const { data: roomsData } = await supabase
    .from('rooms')
    .select('room_number, floor, room_type, cleaning_type')
    .eq('hotel_id', hotelId);
  const rooms = ((roomsData as any[]) || []) as RoomRow[];

  const n = govs.length;
  const buckets = govs.map(() => ({ floors: [] as number[], housekeepers: [] as string[], rooms: [] as string[] }));

  if (config.mode === 'floor') {
    balancedSplit(config.pickedFloors, n).forEach((b, i) => { buckets[i].floors = b; });
  } else if (config.mode === 'housekeeper') {
    balancedSplit(config.pickedHousekeepers, n).forEach((b, i) => { buckets[i].housekeepers = b; });
  } else if (config.mode === 'roomtype') {
    const list = rooms
      .filter((r) => (r.room_type || '').trim() && config.pickedRoomTypes.includes((r.room_type || '').trim()))
      .map((r) => (r.room_number || '').trim())
      .filter(Boolean);
    balancedSplit(list, n).forEach((b, i) => { buckets[i].rooms = b; });
  } else {
    const list = rooms
      .filter((r) => (r.cleaning_type || '').trim() && config.pickedCleaningTypes.includes((r.cleaning_type || '').trim()))
      .map((r) => (r.room_number || '').trim())
      .filter(Boolean);
    balancedSplit(list, n).forEach((b, i) => { buckets[i].rooms = b; });
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const { data: existingRows } = await supabase
    .from('daily_governess_assignments')
    .select('id, governess_profile_id, governess_name, assigned_floors, assigned_housekeepers, assigned_rooms, notes, created_by')
    .eq('hotel_id', hotelId)
    .eq('assignment_date', todayDate());

  const existingById = new Map(
    ((existingRows as any[]) || []).filter((r) => r.governess_profile_id).map((r) => [r.governess_profile_id, r]),
  );
  const existingByName = new Map(
    ((existingRows as any[]) || []).map((r) => [normalizeGovName(r.governess_name || ''), r]),
  );

  let ok = true;
  let assignedCount = 0;
  for (let i = 0; i < govs.length; i++) {
    const b = buckets[i];
    if (b.floors.length === 0 && b.housekeepers.length === 0 && b.rooms.length === 0) continue;
    const gov = govs[i];
    const governessName = gov.name.trim() || 'Gouvernante';
    const existing = existingById.get(gov.id) || existingByName.get(normalizeGovName(governessName));

    const mergedFloors = [...new Set([...(existing?.assigned_floors || []), ...b.floors])].sort((a, c) => a - c);
    const mergedHk = [...new Set([...(existing?.assigned_housekeepers || []), ...b.housekeepers])];
    const mergedRooms = [...new Set([...(existing?.assigned_rooms || []), ...b.rooms])];
    const typesUsed = [mergedFloors.length > 0, mergedHk.length > 0, mergedRooms.length > 0].filter(Boolean).length;
    const newType = typesUsed > 1 ? 'mixed' : mergedRooms.length > 0 ? 'rooms' : mergedHk.length > 0 ? 'housekeeper' : 'floor';

    const payload = {
      hotel_id: hotelId,
      assignment_date: todayDate(),
      governess_profile_id: gov.id,
      governess_name: governessName,
      assignment_type: newType,
      assigned_floors: mergedFloors,
      assigned_housekeepers: mergedHk,
      assigned_rooms: mergedRooms,
      created_by: existing?.created_by || userId,
      notes: existing?.notes ?? null,
    };

    const res = await supabase
      .from('daily_governess_assignments')
      .upsert(payload, { onConflict: 'hotel_id,assignment_date,governess_name' });

    existingById.set(gov.id, { ...(existing || {}), ...payload });
    existingByName.set(normalizeGovName(governessName), { ...(existing || {}), ...payload });
    if (res.error) {
      console.error('[gov assignment] error', res.error);
      ok = false;
    } else {
      assignedCount++;
    }
  }

  return { ok, assignedCount, error: ok ? undefined : "Échec de l'attribution des gouvernantes" };
}
