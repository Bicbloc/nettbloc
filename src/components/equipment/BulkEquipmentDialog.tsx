import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layers, Loader2 } from 'lucide-react';
import { formatFloorLabel } from '@/utils/floorUtils';

interface BulkEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string | null;
}

type Mode = 'all' | 'floor' | 'type' | 'manual';

const CONDITIONS = ['new', 'good', 'worn', 'broken', 'missing', 'to_replace'] as const;

export function BulkEquipmentDialog({ open, onOpenChange, hotelId }: BulkEquipmentDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('all');
  const [selectedFloors, setSelectedFloors] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    brand: '',
    model: '',
    quantity: 1,
    condition: 'good' as typeof CONDITIONS[number],
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['bulk-equipment-rooms', hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_rooms_registry')
        .select('id, room_number, floor, room_type, space_category, is_active')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('room_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!hotelId && open,
  });

  const floors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => set.add(r.floor != null ? String(r.floor) : 'none'));
    return Array.from(set).sort();
  }, [rooms]);

  const types = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => r.room_type && set.add(r.room_type));
    return Array.from(set).sort();
  }, [rooms]);

  const targetRoomIds = useMemo(() => {
    if (mode === 'all') return rooms.map(r => r.id);
    if (mode === 'floor') {
      return rooms
        .filter(r => selectedFloors.has(r.floor != null ? String(r.floor) : 'none'))
        .map(r => r.id);
    }
    if (mode === 'type') {
      return rooms.filter(r => r.room_type && selectedTypes.has(r.room_type)).map(r => r.id);
    }
    return Array.from(selectedRoomIds);
  }, [mode, rooms, selectedFloors, selectedTypes, selectedRoomIds]);

  const toggle = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const reset = () => {
    setMode('all');
    setSelectedFloors(new Set());
    setSelectedTypes(new Set());
    setSelectedRoomIds(new Set());
    setForm({ name: '', brand: '', model: '', quantity: 1, condition: 'good' });
  };

  const handleSubmit = async () => {
    if (!hotelId) return;
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Nom requis', description: 'Indiquez le nom de l\'équipement.' });
      return;
    }
    if (targetRoomIds.length === 0) {
      toast({ variant: 'destructive', title: 'Aucune chambre ciblée', description: 'Sélectionnez au moins une chambre.' });
      return;
    }

    setSaving(true);
    try {
      const payload = targetRoomIds.map(rid => ({
        hotel_id: hotelId,
        room_registry_id: rid,
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        quantity: Number(form.quantity) || 1,
        condition: form.condition,
      }));
      const { error } = await supabase.from('equipments').insert(payload);
      if (error) throw error;
      toast({
        title: 'Équipement ajouté',
        description: `${payload.length} chambre(s) mises à jour.`,
      });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Ajouter un équipement en masse
          </DialogTitle>
          <DialogDescription>
            Choisissez les espaces cibles puis renseignez l'équipement à ajouter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cibles */}
          <div>
            <Label className="mb-2 block">Cibles</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="all">Tous</TabsTrigger>
                <TabsTrigger value="floor">Étage</TabsTrigger>
                <TabsTrigger value="type">Type</TabsTrigger>
                <TabsTrigger value="manual">Manuel</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="pt-3">
                <p className="text-sm text-muted-foreground">
                  Tous les espaces actifs ({rooms.length}) seront ciblés.
                </p>
              </TabsContent>

              <TabsContent value="floor" className="pt-3">
                <ScrollArea className="h-40 border rounded-md p-3">
                  <div className="space-y-2">
                    {floors.map(f => (
                      <label key={f} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedFloors.has(f)}
                          onCheckedChange={() => toggle(selectedFloors, f, setSelectedFloors)}
                        />
                        <span className="text-sm">
                          {f === 'none' ? 'Sans étage' : formatFloorLabel(Number(f))}
                        </span>
                        <Badge variant="secondary" className="ml-auto">
                          {rooms.filter(r => (r.floor != null ? String(r.floor) : 'none') === f).length}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="type" className="pt-3">
                <ScrollArea className="h-40 border rounded-md p-3">
                  <div className="space-y-2">
                    {types.length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucun type défini sur les espaces.</p>
                    )}
                    {types.map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedTypes.has(t)}
                          onCheckedChange={() => toggle(selectedTypes, t, setSelectedTypes)}
                        />
                        <span className="text-sm">{t}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {rooms.filter(r => r.room_type === t).length}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="manual" className="pt-3">
                <ScrollArea className="h-48 border rounded-md p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {rooms.map(r => (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedRoomIds.has(r.id)}
                          onCheckedChange={() => toggle(selectedRoomIds, r.id, setSelectedRoomIds)}
                        />
                        <span className="text-sm">{r.room_number}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <p className="text-xs text-muted-foreground mt-2">
              {targetRoomIds.length} espace(s) ciblé(s)
            </p>
          </div>

          {/* Formulaire équipement */}
          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Télévision" />
              </div>
              <div>
                <Label>Marque</Label>
                <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div>
                <Label>Modèle</Label>
                <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
              </div>
              <div>
                <Label>Quantité</Label>
                <Input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
              <div>
                <Label>État</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as typeof CONDITIONS[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={saving || targetRoomIds.length === 0}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Ajout...</> : `Ajouter à ${targetRoomIds.length} espace(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
