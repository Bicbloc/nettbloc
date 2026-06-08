/**
 * Attribution des gouvernantes (côté établissement / inspections).
 * Permet de choisir parmi les gouvernantes approuvées pour l'hôtel et de leur
 * attribuer des chambres à inspecter, soit par étage, soit par femme de chambre.
 * Les attributions sont enregistrées dans `daily_governess_assignments` pour le jour.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCheck, ClipboardCheck, Trash2, Layers, Users } from 'lucide-react';
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

const todayDate = () => new Date().toISOString().split('T')[0];

export function GovernessAssignmentManager({ hotelId }: { hotelId: string }) {
  const [governesses, setGovernesses] = useState<Governess[]>([]);
  const [floors, setFloors] = useState<number[]>([]);
  const [housekeepers, setHousekeepers] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<DailyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedGoverness, setSelectedGoverness] = useState<string>('');
  const [mode, setMode] = useState<'floor' | 'housekeeper'>('floor');
  const [pickedFloors, setPickedFloors] = useState<number[]>([]);
  const [pickedHousekeepers, setPickedHousekeepers] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [gov, reg, asg, dga] = await Promise.all([
      supabase.from('governess_access_requests')
        .select('governess_profile_id, status, governess_profiles(id, name, email)')
        .eq('hotel_id', hotelId)
        .eq('status', 'approved'),
      supabase.from('rooms').select('floor').eq('hotel_id', hotelId),
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

    const floorSet = [...new Set(
      ((reg.data as any[]) || [])
        .map((r) => Number(r.floor))
        .filter((n) => !Number.isNaN(n))
    )].sort((a, b) => a - b);
    setFloors(floorSet);

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

  const toggleFloor = (f: number) =>
    setPickedFloors((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));
  const toggleHousekeeper = (h: string) =>
    setPickedHousekeepers((p) => (p.includes(h) ? p.filter((x) => x !== h) : [...p, h]));

  const resetForm = () => {
    setSelectedGoverness('');
    setPickedFloors([]);
    setPickedHousekeepers([]);
  };

  const handleAssign = async () => {
    if (!selectedGoverness) {
      toast.error('Choisissez une gouvernante.');
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
    const gov = governesses.find((g) => g.id === selectedGoverness);
    if (!gov) return;

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    // Une seule ligne par gouvernante et par jour (contrainte unique).
    // On fusionne donc la nouvelle sélection avec une éventuelle attribution existante.
    const existing = assignments.find((a) => a.governess_profile_id === gov.id);

    const mergedFloors =
      mode === 'floor'
        ? [...new Set([...(existing?.assigned_floors || []), ...pickedFloors])].sort((a, b) => a - b)
        : existing?.assigned_floors || [];
    const mergedHousekeepers =
      mode === 'housekeeper'
        ? [...new Set([...(existing?.assigned_housekeepers || []), ...pickedHousekeepers])]
        : existing?.assigned_housekeepers || [];

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('daily_governess_assignments')
        .update({
          // On conserve un type cohérent : si on ajoute par étage et qu'il y a aussi
          // des femmes de chambre (ou inverse), le type devient mixte.
          assignment_type:
            mergedFloors.length > 0 && mergedHousekeepers.length > 0 ? 'mixed' : mode,
          assigned_floors: mergedFloors,
          assigned_housekeepers: mergedHousekeepers,
        })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('daily_governess_assignments').insert({
        hotel_id: hotelId,
        assignment_date: todayDate(),
        governess_profile_id: gov.id,
        governess_name: gov.name,
        assignment_type: mode,
        assigned_floors: mode === 'floor' ? pickedFloors : [],
        assigned_housekeepers: mode === 'housekeeper' ? pickedHousekeepers : [],
        created_by: userData.user?.id ?? null,
      }));
    }
    setSaving(false);
    if (error) {
      console.error('[governess] assign error:', error);
      toast.error("Échec de l'attribution");
      return;
    }
    toast.success(`Chambres à inspecter attribuées à ${gov.name}`);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Gouvernantes du jour</CardTitle>
        </div>
        <CardDescription>
          Choisissez les gouvernantes disponibles et attribuez-leur les chambres à
          inspecter, par étage ou par femme de chambre.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Choix de la gouvernante */}
        <div className="space-y-2">
          <Label>Gouvernante</Label>
          <Select value={selectedGoverness} onValueChange={setSelectedGoverness}>
            <SelectTrigger>
              <SelectValue placeholder={
                loading ? 'Chargement…'
                  : governesses.length === 0 ? 'Aucune gouvernante approuvée'
                  : 'Sélectionner une gouvernante'
              } />
            </SelectTrigger>
            <SelectContent>
              {governesses.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                  {assignedGovernessIds.has(g.id) ? ' • déjà assignée' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mode d'attribution */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'floor' | 'housekeeper')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="floor" className="gap-1">
              <Layers className="h-4 w-4" /> Par étage
            </TabsTrigger>
            <TabsTrigger value="housekeeper" className="gap-1">
              <Users className="h-4 w-4" /> Par femme de chambre
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
        ) : (
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
        )}

        <Button onClick={handleAssign} disabled={saving || !selectedGoverness} className="gap-2">
          <UserCheck className="h-4 w-4" />
          {saving ? 'Attribution…' : 'Attribuer les chambres à inspecter'}
        </Button>

        {/* Attributions du jour */}
        {assignments.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Attributions du jour</p>
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{a.assignment_type === 'floor' ? 'Étage' : 'Femme de chambre'}</Badge>
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
