/**
 * Attribution des gouvernantes (côté établissement / inspections).
 * Permet de choisir parmi les gouvernantes approuvées pour l'hôtel et de leur
 * attribuer des chambres à inspecter, par étage, par femme de chambre ou par
 * type de chambre.
 *
 * Distribution :
 *  - si une seule gouvernante est sélectionnée, elle reçoit toute la sélection ;
 *  - si plusieurs gouvernantes sont sélectionnées, la sélection est répartie
 *    équitablement entre elles (round-robin équilibré).
 *
 * Les attributions sont enregistrées dans `daily_governess_assignments` pour le jour.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCheck, ClipboardCheck, Trash2, Layers, Users, BedDouble } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

interface Governess {
  id: string;
  name: string;
  email?: string;
}

interface DailyAssignment {
  id: string;
  governess_profile_id: string | null;
  governess_name: string;
  assignment_type: string;
  assigned_floors: number[] | null;
  assigned_housekeepers: string[] | null;
  assigned_rooms: string[] | null;
  notes: string | null;
}

type Mode = 'floor' | 'housekeeper' | 'roomtype';

const todayDate = () => new Date().toISOString().split('T')[0];

/** Répartit équitablement une liste d'éléments entre n seaux (round-robin). */
function balancedSplit<T>(items: T[], n: number): T[][] {
  const buckets: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => buckets[i % n].push(item));
  return buckets;
}

export function GovernessAssignmentManager({ hotelId }: { hotelId: string }) {
  const [governesses, setGovernesses] = useState<Governess[]>([]);
  const [floors, setFloors] = useState<number[]>([]);
  const [housekeepers, setHousekeepers] = useState<string[]>([]);
  const [roomTypes, setRoomTypes] = useState<{ type: string; rooms: string[] }[]>([]);
  const [assignments, setAssignments] = useState<DailyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedGovernesses, setSelectedGovernesses] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('floor');
  const [pickedFloors, setPickedFloors] = useState<number[]>([]);
  const [pickedHousekeepers, setPickedHousekeepers] = useState<string[]>([]);
  const [pickedRoomTypes, setPickedRoomTypes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [gov, reg, asg, dga] = await Promise.all([
      supabase.from('governess_access_requests')
        .select('governess_profile_id, status, governess_profiles(id, name, email)')
        .eq('hotel_id', hotelId)
        .eq('status', 'approved'),
      supabase.from('rooms').select('floor, room_number, room_type').eq('hotel_id', hotelId),
      supabase.from('assignments').select('housekeeper_name').eq('hotel_id', hotelId),
      supabase.from('daily_governess_assignments')
        .select('id, governess_profile_id, governess_name, assignment_type, assigned_floors, assigned_housekeepers, assigned_rooms, notes')
        .eq('hotel_id', hotelId)
        .eq('assignment_date', todayDate()),
    ]);

    const govList: Governess[] = ((gov.data as any[]) || []).map((g) => ({
      id: g.governess_profile_id,
      name: g.governess_profiles?.name || 'Gouvernante',
      email: g.governess_profiles?.email,
    }));
    setGovernesses(govList);

    const regRows = (reg.data as any[]) || [];

    const floorSet = [...new Set(
      regRows
        .map((r) => Number(r.floor))
        .filter((n) => !Number.isNaN(n))
    )].sort((a, b) => a - b);
    setFloors(floorSet);

    // Regrouper les chambres par type de chambre
    const typeMap: Record<string, string[]> = {};
    regRows.forEach((r) => {
      const t = (r.room_type || '').trim();
      const num = (r.room_number || '').trim();
      if (!t || !num) return;
      if (!typeMap[t]) typeMap[t] = [];
      typeMap[t].push(num);
    });
    setRoomTypes(
      Object.entries(typeMap)
        .map(([type, rooms]) => ({ type, rooms }))
        .sort((a, b) => a.type.localeCompare(b.type))
    );

    const hkSet = [...new Set(
      ((asg.data as any[]) || [])
        .map((a) => (a.housekeeper_name || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
    setHousekeepers(hkSet);

    setAssignments((dga.data as DailyAssignment[]) || []);
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { load(); }, [load]);

  useRealtimeSync({
    hotelId,
    tables: ['daily_governess_assignments', 'assignments'],
    onUpdate: load,
  });

  const assignedGovernessIds = useMemo(
    () => new Set(assignments.map((a) => a.governess_profile_id)),
    [assignments]
  );

  const toggleGoverness = (id: string) =>
    setSelectedGovernesses((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleFloor = (f: number) =>
    setPickedFloors((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));
  const toggleHousekeeper = (h: string) =>
    setPickedHousekeepers((p) => (p.includes(h) ? p.filter((x) => x !== h) : [...p, h]));
  const toggleRoomType = (t: string) =>
    setPickedRoomTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const resetForm = () => {
    setSelectedGovernesses([]);
    setPickedFloors([]);
    setPickedHousekeepers([]);
    setPickedRoomTypes([]);
  };

  const upsertForGoverness = async (
    gov: Governess,
    addFloors: number[],
    addHousekeepers: string[],
    addRooms: string[],
    userId: string | null,
  ) => {
    const existing = assignments.find((a) => a.governess_profile_id === gov.id);

    const mergedFloors = [...new Set([...(existing?.assigned_floors || []), ...addFloors])].sort((a, b) => a - b);
    const mergedHousekeepers = [...new Set([...(existing?.assigned_housekeepers || []), ...addHousekeepers])];
    const mergedRooms = [...new Set([...(existing?.assigned_rooms || []), ...addRooms])];

    const typesUsed = [
      mergedFloors.length > 0,
      mergedHousekeepers.length > 0,
      mergedRooms.length > 0,
    ].filter(Boolean).length;
    const newType =
      typesUsed > 1
        ? 'mixed'
        : mergedRooms.length > 0
          ? 'rooms'
          : mergedHousekeepers.length > 0
            ? 'housekeeper'
            : 'floor';

    if (existing) {
      return supabase
        .from('daily_governess_assignments')
        .update({
          assignment_type: newType,
          assigned_floors: mergedFloors,
          assigned_housekeepers: mergedHousekeepers,
          assigned_rooms: mergedRooms,
        })
        .eq('id', existing.id);
    }
    return supabase.from('daily_governess_assignments').insert({
      hotel_id: hotelId,
      assignment_date: todayDate(),
      governess_profile_id: gov.id,
      governess_name: gov.name,
      assignment_type: newType,
      assigned_floors: mergedFloors,
      assigned_housekeepers: mergedHousekeepers,
      assigned_rooms: mergedRooms,
      created_by: userId,
    });
  };

  const handleAssign = async () => {
    if (selectedGovernesses.length === 0) {
      toast.error('Choisissez au moins une gouvernante.');
      return;
    }
    if (mode === 'floor' && pickedFloors.length === 0) {
      toast.error('Sélectionnez au moins un étage.');
      return;
    }
    if (mode === 'housekeeper' && pickedHousekeepers.length === 0) {
      toast.error('Sélectionnez au moins une femme de chambre.');
      return;
    }
    if (mode === 'roomtype' && pickedRoomTypes.length === 0) {
      toast.error('Sélectionnez au moins un type de chambre.');
      return;
    }

    const selectedGovs = governesses.filter((g) => selectedGovernesses.includes(g.id));
    if (selectedGovs.length === 0) return;

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    const n = selectedGovs.length;

    // Construire les seaux par gouvernante selon le mode et la répartition équitable.
    let buckets: { floors: number[]; housekeepers: string[]; rooms: string[] }[] =
      selectedGovs.map(() => ({ floors: [], housekeepers: [], rooms: [] }));

    if (mode === 'floor') {
      balancedSplit(pickedFloors, n).forEach((b, i) => { buckets[i].floors = b; });
    } else if (mode === 'housekeeper') {
      balancedSplit(pickedHousekeepers, n).forEach((b, i) => { buckets[i].housekeepers = b; });
    } else {
      // Par type de chambre : on répartit les chambres réelles équitablement.
      const rooms = roomTypes
        .filter((rt) => pickedRoomTypes.includes(rt.type))
        .flatMap((rt) => rt.rooms);
      balancedSplit(rooms, n).forEach((b, i) => { buckets[i].rooms = b; });
    }

    let hadError = false;
    for (let i = 0; i < selectedGovs.length; i++) {
      const b = buckets[i];
      if (b.floors.length === 0 && b.housekeepers.length === 0 && b.rooms.length === 0) continue;
      const { error } = await upsertForGoverness(selectedGovs[i], b.floors, b.housekeepers, b.rooms, userId);
      if (error) {
        console.error('[governess] assign error:', error);
        hadError = true;
      }
    }

    setSaving(false);
    if (hadError) {
      toast.error("Échec de l'attribution");
      return;
    }
    toast.success(
      n > 1
        ? `Chambres réparties équitablement entre ${n} gouvernantes`
        : `Chambres à inspecter attribuées à ${selectedGovs[0].name}`
    );
    resetForm();
    load();
  };

  const handleRemove = async (id: string, name: string) => {
    const { error } = await supabase.from('daily_governess_assignments').delete().eq('id', id);
    if (error) {
      toast.error('Échec de la suppression');
      return;
    }
    toast.success(`Attribution retirée (${name})`);
    load();
  };

  const scopeLabel = (a: DailyAssignment) => {
    const parts: string[] = [];
    const fl = a.assigned_floors || [];
    if (fl.length) parts.push(`Étages : ${fl.map((f) => (f === 0 ? 'RDC' : f)).join(', ')}`);
    const hk = a.assigned_housekeepers || [];
    if (hk.length) parts.push(`Femmes de chambre : ${hk.join(', ')}`);
    const rm = a.assigned_rooms || [];
    if (rm.length) parts.push(`Chambres : ${rm.join(', ')}`);
    return parts.join(' • ') || 'Aucune attribution';
  };

  const typeLabel = (t: string) => {
    switch (t) {
      case 'floor': return 'Étage';
      case 'housekeeper': return 'Femme de chambre';
      case 'rooms': return 'Type de chambre';
      case 'mixed': return 'Mixte';
      default: return t;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Gouvernantes du jour</CardTitle>
        </div>
        <CardDescription>
          Sélectionnez les gouvernantes disponibles et attribuez-leur les chambres à
          inspecter par étage, par femme de chambre ou par type de chambre. Avec plusieurs
          gouvernantes, la sélection est répartie équitablement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Choix des gouvernantes (multi) */}
        <div className="space-y-2">
          <Label>Gouvernantes disponibles</Label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : governesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune gouvernante approuvée.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {governesses.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGoverness(g.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    selectedGovernesses.includes(g.id)
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Checkbox checked={selectedGovernesses.includes(g.id)} className="pointer-events-none" />
                  {g.name}
                  {assignedGovernessIds.has(g.id) ? (
                    <span className="text-xs text-muted-foreground">• assignée</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mode d'attribution */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="floor" className="gap-1">
              <Layers className="h-4 w-4" /> Par étage
            </TabsTrigger>
            <TabsTrigger value="housekeeper" className="gap-1">
              <Users className="h-4 w-4" /> Femme de ch.
            </TabsTrigger>
            <TabsTrigger value="roomtype" className="gap-1">
              <BedDouble className="h-4 w-4" /> Type de ch.
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'floor' ? (
          floors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun étage détecté dans les chambres.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {floors.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFloor(f)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    pickedFloors.includes(f)
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'hover:bg-muted'
                  }`}
                >
                  {f === 0 ? 'RDC' : `Étage ${f}`}
                </button>
              ))}
            </div>
          )
        ) : mode === 'housekeeper' ? (
          housekeepers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune femme de chambre assignée pour le moment.</p>
          ) : (
            <ScrollArea className="max-h-40">
              <div className="space-y-2 pr-2">
                {housekeepers.map((h) => (
                  <label key={h} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={pickedHousekeepers.includes(h)}
                      onCheckedChange={() => toggleHousekeeper(h)}
                    />
                    {h}
                  </label>
                ))}
              </div>
            </ScrollArea>
          )
        ) : (
          roomTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun type de chambre détecté.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roomTypes.map((rt) => (
                <button
                  key={rt.type}
                  type="button"
                  onClick={() => toggleRoomType(rt.type)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    pickedRoomTypes.includes(rt.type)
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'hover:bg-muted'
                  }`}
                >
                  {rt.type}
                  <Badge variant="outline" className="text-xs">{rt.rooms.length}</Badge>
                </button>
              ))}
            </div>
          )
        )}

        <Button
          onClick={handleAssign}
          disabled={saving || selectedGovernesses.length === 0}
          className="gap-2"
        >
          <UserCheck className="h-4 w-4" />
          {saving
            ? 'Attribution…'
            : selectedGovernesses.length > 1
              ? 'Répartir équitablement'
              : 'Attribuer les chambres à inspecter'}
        </Button>

        {/* Attributions du jour */}
        {assignments.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Attributions du jour</p>
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{typeLabel(a.assignment_type)}</Badge>
                    <span className="font-medium">{a.governess_name}</span>
                  </div>
                  <span className="text-muted-foreground text-xs mt-0.5">{scopeLabel(a)}</span>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => handleRemove(a.id, a.governess_name)}
                  title="Retirer l'attribution"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
