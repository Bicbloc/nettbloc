/**
 * Étape "Gouvernantes" du flux de redistribution.
 * Permet de sélectionner les gouvernantes disponibles et de leur attribuer les
 * chambres à inspecter par femme de chambre, par étage, par type de chambre ou
 * par type de nettoyage. Plusieurs gouvernantes => répartition équitable.
 *
 * Le composant expose une méthode `apply()` (via ref) qui enregistre les
 * attributions du jour dans `daily_governess_assignments`.
 */
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState,
} from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, Users, BedDouble, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
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

export interface GovStepHandle {
  apply: () => Promise<boolean>;
  getConfig: () => GovStepConfig;
}

interface Governess { id: string; name: string; }
interface RoomRow { room_number: string; floor: number | null; room_type: string | null; cleaning_type: string | null; }

const todayDate = () => new Date().toISOString().split('T')[0];

function balancedSplit<T>(items: T[], n: number): T[][] {
  const buckets: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => buckets[i % n].push(item));
  return buckets;
}

const normalizeGovName = (name: string) => name.trim().toLocaleLowerCase();

const cleaningLabel = (t: string) => {
  const v = t.toLowerCase();
  if (v === 'full' || v === 'a_blanc' || v === 'à blanc') return 'À blanc';
  if (v === 'quick' || v === 'recouche') return 'Recouche';
  return t;
};

interface Props {
  hotelId: string;
  initialConfig?: GovStepConfig | null;
  onConfigChange?: (config: GovStepConfig) => void;
}

export const GovernessRedistributionStep = forwardRef<GovStepHandle, Props>(
  ({ hotelId, initialConfig, onConfigChange }, ref) => {
    const [governesses, setGovernesses] = useState<Governess[]>([]);
    const [rooms, setRooms] = useState<RoomRow[]>([]);
    const [housekeepers, setHousekeepers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Gouvernantes et femmes de chambre : toujours désélectionnées au départ,
    // l'utilisateur doit faire son choix (champs obligatoires).
    const [selectedGovernesses, setSelectedGovernesses] = useState<string[]>([]);
    const [mode, setMode] = useState<GovMode>(initialConfig?.mode || 'housekeeper');
    const [pickedFloors, setPickedFloors] = useState<number[]>(initialConfig?.pickedFloors || []);
    const [pickedHousekeepers, setPickedHousekeepers] = useState<string[]>([]);
    const [pickedRoomTypes, setPickedRoomTypes] = useState<string[]>(initialConfig?.pickedRoomTypes || []);
    const [pickedCleaningTypes, setPickedCleaningTypes] = useState<string[]>(initialConfig?.pickedCleaningTypes || []);

    const load = useCallback(async () => {
      setLoading(true);
      const [gov, reg, asg] = await Promise.all([
        supabase.from('governess_access_requests')
          .select('governess_profile_id, status, governess_profiles(id, name)')
          .eq('hotel_id', hotelId)
          .eq('status', 'approved'),
        supabase.from('rooms').select('room_number, floor, room_type, cleaning_type').eq('hotel_id', hotelId),
        supabase.from('assignments').select('housekeeper_name').eq('hotel_id', hotelId),
      ]);

      setGovernesses(((gov.data as any[]) || []).map((g) => ({
        id: g.governess_profile_id,
        name: g.governess_profiles?.name || 'Gouvernante',
      })));
      setRooms(((reg.data as any[]) || []) as RoomRow[]);
      setHousekeepers([...new Set(
        ((asg.data as any[]) || []).map((a) => (a.housekeeper_name || '').trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b)));
      setLoading(false);
    }, [hotelId]);

    useEffect(() => { load(); }, [load]);

    const floors = useMemo(
      () => [...new Set(rooms.map((r) => Number(r.floor)).filter((n) => !Number.isNaN(n)))].sort((a, b) => a - b),
      [rooms]
    );
    const roomTypes = useMemo(() => {
      const map: Record<string, string[]> = {};
      rooms.forEach((r) => {
        const t = (r.room_type || '').trim();
        const num = (r.room_number || '').trim();
        if (!t || !num) return;
        (map[t] ||= []).push(num);
      });
      return Object.entries(map).map(([type, list]) => ({ type, rooms: list })).sort((a, b) => a.type.localeCompare(b.type));
    }, [rooms]);
    const cleaningTypes = useMemo(() => {
      const map: Record<string, string[]> = {};
      rooms.forEach((r) => {
        const t = (r.cleaning_type || '').trim();
        const num = (r.room_number || '').trim();
        if (!t || !num || t === 'none') return;
        (map[t] ||= []).push(num);
      });
      return Object.entries(map).map(([type, list]) => ({ type, rooms: list })).sort((a, b) => a.type.localeCompare(b.type));
    }, [rooms]);

    // Remonter la config courante au parent
    useEffect(() => {
      onConfigChange?.({
        selectedGovernesses, mode, pickedFloors, pickedHousekeepers, pickedRoomTypes, pickedCleaningTypes,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGovernesses, mode, pickedFloors, pickedHousekeepers, pickedRoomTypes, pickedCleaningTypes]);

    const toggle = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, v: T) =>
      setter((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

    const apply = useCallback(async (): Promise<boolean> => {
      if (selectedGovernesses.length === 0) return true; // étape facultative
      const selectedGovs = Array.from(
        new Map(
          governesses
            .filter((g) => selectedGovernesses.includes(g.id))
            .map((g) => [normalizeGovName(g.name || 'Gouvernante'), { ...g, name: g.name.trim() || 'Gouvernante' }])
        ).values()
      );
      if (selectedGovs.length === 0) return true;
      const n = selectedGovs.length;

      const buckets = selectedGovs.map(() => ({ floors: [] as number[], housekeepers: [] as string[], rooms: [] as string[] }));

      if (mode === 'floor') {
        balancedSplit(pickedFloors, n).forEach((b, i) => { buckets[i].floors = b; });
      } else if (mode === 'housekeeper') {
        balancedSplit(pickedHousekeepers, n).forEach((b, i) => { buckets[i].housekeepers = b; });
      } else if (mode === 'roomtype') {
        const list = roomTypes.filter((rt) => pickedRoomTypes.includes(rt.type)).flatMap((rt) => rt.rooms);
        balancedSplit(list, n).forEach((b, i) => { buckets[i].rooms = b; });
      } else {
        const list = cleaningTypes.filter((ct) => pickedCleaningTypes.includes(ct.type)).flatMap((ct) => ct.rooms);
        balancedSplit(list, n).forEach((b, i) => { buckets[i].rooms = b; });
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { data: existingRows } = await supabase
        .from('daily_governess_assignments')
        .select('id, governess_profile_id, governess_name, assigned_floors, assigned_housekeepers, assigned_rooms, notes')
        .eq('hotel_id', hotelId)
        .eq('assignment_date', todayDate());

      const existingById = new Map(
        ((existingRows as any[]) || [])
          .filter((row) => row.governess_profile_id)
          .map((row) => [row.governess_profile_id, row])
      );
      const existingByName = new Map(
        ((existingRows as any[]) || []).map((row) => [normalizeGovName(row.governess_name || ''), row])
      );

      let ok = true;
      for (let i = 0; i < selectedGovs.length; i++) {
        const b = buckets[i];
        if (b.floors.length === 0 && b.housekeepers.length === 0 && b.rooms.length === 0) continue;
        const gov = selectedGovs[i];
        const governessName = gov.name.trim() || 'Gouvernante';
        const existing = existingById.get(gov.id) || existingByName.get(normalizeGovName(governessName));

        const mergedFloors = [...new Set([...(existing?.assigned_floors || []), ...b.floors])].sort((a, b) => a - b);
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
        if (res.error) { console.error('[gov step] error', res.error); ok = false; }
      }
      if (!ok) toast.error("Échec de l'attribution des gouvernantes");
      return ok;
    }, [selectedGovernesses, governesses, mode, pickedFloors, pickedHousekeepers, pickedRoomTypes, pickedCleaningTypes, roomTypes, cleaningTypes, hotelId]);

    useImperativeHandle(ref, () => ({
      apply,
      getConfig: () => ({ selectedGovernesses, mode, pickedFloors, pickedHousekeepers, pickedRoomTypes, pickedCleaningTypes }),
    }), [apply, selectedGovernesses, mode, pickedFloors, pickedHousekeepers, pickedRoomTypes, pickedCleaningTypes]);

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Gouvernantes disponibles</Label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : governesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune gouvernante approuvée. (Étape facultative)</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {governesses.map((g) => (
                <label
                  key={g.id}
                  onClick={() => toggle(setSelectedGovernesses, g.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    selectedGovernesses.includes(g.id) ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'
                  }`}
                >
                  <Checkbox checked={selectedGovernesses.includes(g.id)} className="pointer-events-none" />
                  {g.name}
                </label>
              ))}
            </div>
          )}
          {selectedGovernesses.length > 1 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Répartition équitable entre {selectedGovernesses.length} gouvernantes
            </p>
          )}
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as GovMode)}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="housekeeper" className="gap-1 text-xs"><Users className="h-3.5 w-3.5" /> Femme de ch.</TabsTrigger>
            <TabsTrigger value="floor" className="gap-1 text-xs"><Layers className="h-3.5 w-3.5" /> Étage</TabsTrigger>
            <TabsTrigger value="roomtype" className="gap-1 text-xs"><BedDouble className="h-3.5 w-3.5" /> Type ch.</TabsTrigger>
            <TabsTrigger value="cleaningtype" className="gap-1 text-xs"><Sparkles className="h-3.5 w-3.5" /> Nettoyage</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-3">
            {mode === 'floor' ? (
              floors.length === 0 ? <p className="text-sm text-muted-foreground">Aucun étage détecté.</p> : (
                <div className="flex flex-wrap gap-2">
                  {floors.map((f) => (
                    <button key={f} type="button" onClick={() => toggle(setPickedFloors, f)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${pickedFloors.includes(f) ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}>
                      {f === 0 ? 'RDC' : `Étage ${f}`}
                    </button>
                  ))}
                </div>
              )
            ) : mode === 'housekeeper' ? (
              housekeepers.length === 0 ? <p className="text-sm text-muted-foreground">Aucune femme de chambre assignée.</p> : (
                <ScrollArea className="max-h-40">
                  <div className="space-y-2 pr-2">
                    {housekeepers.map((h) => (
                      <label key={h} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={pickedHousekeepers.includes(h)} onCheckedChange={() => toggle(setPickedHousekeepers, h)} />
                        {h}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )
            ) : mode === 'roomtype' ? (
              roomTypes.length === 0 ? <p className="text-sm text-muted-foreground">Aucun type de chambre détecté.</p> : (
                <div className="flex flex-wrap gap-2">
                  {roomTypes.map((rt) => (
                    <button key={rt.type} type="button" onClick={() => toggle(setPickedRoomTypes, rt.type)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${pickedRoomTypes.includes(rt.type) ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}>
                      {rt.type}<Badge variant="outline" className="text-xs">{rt.rooms.length}</Badge>
                    </button>
                  ))}
                </div>
              )
            ) : (
              cleaningTypes.length === 0 ? <p className="text-sm text-muted-foreground">Aucun type de nettoyage détecté.</p> : (
                <div className="flex flex-wrap gap-2">
                  {cleaningTypes.map((ct) => (
                    <button key={ct.type} type="button" onClick={() => toggle(setPickedCleaningTypes, ct.type)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${pickedCleaningTypes.includes(ct.type) ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted'}`}>
                      {cleaningLabel(ct.type)}<Badge variant="outline" className="text-xs">{ct.rooms.length}</Badge>
                    </button>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
);

GovernessRedistributionStep.displayName = 'GovernessRedistributionStep';
