import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { FLOOR_OPTIONS, SPACE_TYPES } from '@/utils/floorUtils';
import { Wrench, Plus, Trash2 } from 'lucide-react';

const formSchema = z.object({
  space_category: z.string().default('room'),
  room_number: z.string().min(1, "Le nom/numéro est requis"),
  floor: z.string().optional(),
  room_type: z.string().optional(),
  building: z.string().optional(),
  zone: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RoomRegistry {
  id: string;
  room_number: string;
  floor: number | null;
  room_type: string | null;
  building: string | null;
  zone: string | null;
  space_category?: string | null;
}

interface EditRoomRegistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: RoomRegistry;
}

interface Characteristics {
  bed_type: string;
  bed_dimensions: string;
  bed_count: string;
  bathroom_type: string;
  has_bathtub: boolean;
  has_shower: boolean;
  desk_dimensions: string;
  room_area_sqm: string;
  view_type: string;
  amenities: string[];
  notes: string;
}

const DEFAULT_CHAR: Characteristics = {
  bed_type: '', bed_dimensions: '', bed_count: '', bathroom_type: '',
  has_bathtub: false, has_shower: false, desk_dimensions: '',
  room_area_sqm: '', view_type: '', amenities: [], notes: '',
};

export function EditRoomRegistryDialog({ open, onOpenChange, room }: EditRoomRegistryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [customFloor, setCustomFloor] = useState(false);
  const [characteristics, setCharacteristics] = useState<Characteristics>(DEFAULT_CHAR);
  const [newAmenity, setNewAmenity] = useState('');
  const [newEquip, setNewEquip] = useState({ name: '', brand: '', model: '', quantity: '1', condition: 'good' });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      space_category: room.space_category || 'room',
      room_number: room.room_number,
      floor: room.floor?.toString() || '',
      room_type: room.room_type || '',
      building: room.building || '',
      zone: room.zone || '',
    },
  });

  // Load characteristics
  const { data: charData } = useQuery({
    queryKey: ['room-characteristics', room.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('room_characteristics')
        .select('*')
        .eq('room_registry_id', room.id)
        .maybeSingle();
      return data;
    },
    enabled: open,
  });

  // Load equipments for this room
  const { data: equipments = [], refetch: refetchEquip } = useQuery({
    queryKey: ['room-equipments', room.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('equipments')
        .select('id, name, brand, model, condition, quantity')
        .eq('room_registry_id', room.id)
        .order('name');
      return data || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (charData) {
      setCharacteristics({
        bed_type: charData.bed_type || '',
        bed_dimensions: charData.bed_dimensions || '',
        bed_count: charData.bed_count?.toString() || '',
        bathroom_type: charData.bathroom_type || '',
        has_bathtub: !!charData.has_bathtub,
        has_shower: !!charData.has_shower,
        desk_dimensions: charData.desk_dimensions || '',
        room_area_sqm: charData.room_area_sqm?.toString() || '',
        view_type: charData.view_type || '',
        amenities: (charData.amenities as string[]) || [],
        notes: charData.notes || '',
      });
    } else {
      setCharacteristics(DEFAULT_CHAR);
    }
  }, [charData, open]);

  useEffect(() => {
    const floorStr = room.floor?.toString() || '';
    const isStandard = FLOOR_OPTIONS.some(o => o.value === floorStr);
    setCustomFloor(!isStandard && floorStr !== '');
    form.reset({
      space_category: room.space_category || 'room',
      room_number: room.room_number,
      floor: floorStr,
      room_type: room.room_type || '',
      building: room.building || '',
      zone: room.zone || '',
    });
  }, [room, form]);

  const category = form.watch('space_category');
  const isSpace = category === 'common' || category === 'technical';

  const updateRoomMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const { error } = await supabase
        .from('hotel_rooms_registry')
        .update({
          room_number: values.room_number,
          floor: values.floor ? parseInt(values.floor) : null,
          room_type: values.room_type || null,
          building: values.building || null,
          zone: values.zone || null,
          space_category: values.space_category,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', room.id);
      if (error) throw error;

      // Save characteristics (only for rooms)
      if (values.space_category === 'room') {
        const { data: existing } = await supabase
          .from('hotel_rooms_registry')
          .select('hotel_id')
          .eq('id', room.id)
          .single();
        if (existing?.hotel_id) {
          const charPayload: any = {
            hotel_id: existing.hotel_id,
            room_registry_id: room.id,
            bed_type: characteristics.bed_type || null,
            bed_dimensions: characteristics.bed_dimensions || null,
            bed_count: characteristics.bed_count ? Number(characteristics.bed_count) : null,
            bathroom_type: characteristics.bathroom_type || null,
            has_bathtub: characteristics.has_bathtub,
            has_shower: characteristics.has_shower,
            desk_dimensions: characteristics.desk_dimensions || null,
            room_area_sqm: characteristics.room_area_sqm ? Number(characteristics.room_area_sqm) : null,
            view_type: characteristics.view_type || null,
            amenities: characteristics.amenities,
            notes: characteristics.notes || null,
          };
          const { error: cErr } = await supabase
            .from('room_characteristics')
            .upsert(charPayload, { onConflict: 'room_registry_id' });
          if (cErr) throw cErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-registry'] });
      queryClient.invalidateQueries({ queryKey: ['room-characteristics', room.id] });
      toast({ title: "Espace modifié", description: "Les informations ont été mises à jour" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible de modifier", variant: "destructive" });
    },
  });

  const deleteEquipment = async (id: string) => {
    if (!confirm('Supprimer cet équipement ?')) return;
    const { error } = await supabase.from('equipments').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    refetchEquip();
    toast({ title: 'Équipement supprimé' });
  };

  const addAmenity = () => {
    const a = newAmenity.trim();
    if (a && !characteristics.amenities.includes(a)) {
      setCharacteristics({ ...characteristics, amenities: [...characteristics.amenities, a] });
      setNewAmenity('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'espace</DialogTitle>
          <DialogDescription>
            Modifier les informations de {room.room_number}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="characteristics" disabled={isSpace}>Caractéristiques</TabsTrigger>
            <TabsTrigger value="equipments">Équipements ({equipments.length})</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => updateRoomMutation.mutate(v))} className="space-y-4">
              <TabsContent value="general" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="space_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="room">🛏️ Chambre</SelectItem>
                          <SelectItem value="common">🏢 Espace commun</SelectItem>
                          <SelectItem value="technical">⚙️ Espace technique</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="room_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isSpace ? "Nom de l'espace *" : "Numéro de chambre *"}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isSpace ? (
                  <FormField
                    control={form.control}
                    name="room_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type d'espace</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            {SPACE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="room_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de chambre</FormLabel>
                        <FormControl><Input placeholder="Standard, Suite, Deluxe..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="floor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Étage</FormLabel>
                      {customFloor ? (
                        <div className="flex gap-2">
                          <FormControl><Input type="number" placeholder="-2, 0, 5..." {...field} /></FormControl>
                          <Button type="button" variant="outline" size="sm" onClick={() => setCustomFloor(false)}>Liste</Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {FLOOR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="sm" onClick={() => setCustomFloor(true)}>Autre</Button>
                        </div>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="building"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bâtiment</FormLabel>
                      <FormControl><Input placeholder="A, B, Principal..." {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zone</FormLabel>
                      <FormControl><Input placeholder="Nord, Sud, Est, Ouest..." {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="characteristics" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FormLabel>Surface (m²)</FormLabel>
                    <Input type="number" step="0.1" value={characteristics.room_area_sqm}
                      onChange={(e) => setCharacteristics({ ...characteristics, room_area_sqm: e.target.value })} />
                  </div>
                  <div>
                    <FormLabel>Vue</FormLabel>
                    <Input placeholder="Mer, jardin, ville..." value={characteristics.view_type}
                      onChange={(e) => setCharacteristics({ ...characteristics, view_type: e.target.value })} />
                  </div>
                  <div>
                    <FormLabel>Type de lit</FormLabel>
                    <Input placeholder="King, Queen, Twin..." value={characteristics.bed_type}
                      onChange={(e) => setCharacteristics({ ...characteristics, bed_type: e.target.value })} />
                  </div>
                  <div>
                    <FormLabel>Dimensions lit</FormLabel>
                    <Input placeholder="180x200" value={characteristics.bed_dimensions}
                      onChange={(e) => setCharacteristics({ ...characteristics, bed_dimensions: e.target.value })} />
                  </div>
                  <div>
                    <FormLabel>Nombre de lits</FormLabel>
                    <Input type="number" value={characteristics.bed_count}
                      onChange={(e) => setCharacteristics({ ...characteristics, bed_count: e.target.value })} />
                  </div>
                  <div>
                    <FormLabel>Type de SDB</FormLabel>
                    <Input placeholder="Privative, partagée..." value={characteristics.bathroom_type}
                      onChange={(e) => setCharacteristics({ ...characteristics, bathroom_type: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox checked={characteristics.has_bathtub}
                      onCheckedChange={(c) => setCharacteristics({ ...characteristics, has_bathtub: !!c })} />
                    <FormLabel className="!mt-0">Baignoire</FormLabel>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox checked={characteristics.has_shower}
                      onCheckedChange={(c) => setCharacteristics({ ...characteristics, has_shower: !!c })} />
                    <FormLabel className="!mt-0">Douche</FormLabel>
                  </div>
                  <div className="col-span-2">
                    <FormLabel>Dimensions bureau</FormLabel>
                    <Input placeholder="120x60" value={characteristics.desk_dimensions}
                      onChange={(e) => setCharacteristics({ ...characteristics, desk_dimensions: e.target.value })} />
                  </div>
                </div>

                <div>
                  <FormLabel>Amenities</FormLabel>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {characteristics.amenities.map(a => (
                      <Badge key={a} variant="secondary" className="gap-1">
                        {a}
                        <button type="button" onClick={() => setCharacteristics({ ...characteristics, amenities: characteristics.amenities.filter(x => x !== a) })}>
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Wifi, climatisation, minibar..." value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(); } }} />
                    <Button type="button" variant="outline" size="sm" onClick={addAmenity}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <FormLabel>Notes</FormLabel>
                  <Textarea rows={2} value={characteristics.notes}
                    onChange={(e) => setCharacteristics({ ...characteristics, notes: e.target.value })} />
                </div>
              </TabsContent>

              <TabsContent value="equipments" className="space-y-3 mt-4">
                <p className="text-sm text-muted-foreground">
                  Équipements liés à cet espace (marque, modèle, état)
                </p>
                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <p className="text-xs font-medium">Ajouter un équipement</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Nom *" value={newEquip.name}
                      onChange={(e) => setNewEquip({ ...newEquip, name: e.target.value })} />
                    <Input placeholder="Marque" value={newEquip.brand}
                      onChange={(e) => setNewEquip({ ...newEquip, brand: e.target.value })} />
                    <Input placeholder="Modèle / référence" value={newEquip.model}
                      onChange={(e) => setNewEquip({ ...newEquip, model: e.target.value })} />
                    <Input type="number" min="1" placeholder="Qté" value={newEquip.quantity}
                      onChange={(e) => setNewEquip({ ...newEquip, quantity: e.target.value })} />
                    <Select value={newEquip.condition} onValueChange={(v) => setNewEquip({ ...newEquip, condition: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Neuf</SelectItem>
                        <SelectItem value="good">Bon</SelectItem>
                        <SelectItem value="worn">Usé</SelectItem>
                        <SelectItem value="broken">HS</SelectItem>
                        <SelectItem value="missing">Manquant</SelectItem>
                        <SelectItem value="to_replace">À remplacer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" onClick={async () => {
                      if (!newEquip.name.trim()) {
                        toast({ title: 'Nom requis', variant: 'destructive' });
                        return;
                      }
                      const { data: reg } = await supabase
                        .from('hotel_rooms_registry').select('hotel_id').eq('id', room.id).single();
                      if (!reg?.hotel_id) return;
                      const { error } = await supabase.from('equipments').insert({
                        hotel_id: reg.hotel_id,
                        room_registry_id: room.id,
                        name: newEquip.name.trim(),
                        brand: newEquip.brand || null,
                        model: newEquip.model || null,
                        quantity: Number(newEquip.quantity) || 1,
                        condition: newEquip.condition,
                      } as any);
                      if (error) {
                        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                        return;
                      }
                      setNewEquip({ name: '', brand: '', model: '', quantity: '1', condition: 'good' });
                      refetchEquip();
                      toast({ title: 'Équipement ajouté' });
                    }}>
                      <Plus className="h-4 w-4 mr-1" />Ajouter
                    </Button>
                  </div>
                </div>
                {equipments.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
                    <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Aucun équipement enregistré
                  </div>
                ) : (
                  <div className="space-y-2">
                    {equipments.map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between border rounded-md p-2">
                        <div className="text-sm">
                          <span className="font-medium">{it.name}</span>
                          {it.brand && <span className="text-muted-foreground"> · {it.brand}</span>}
                          {it.model && <span className="text-muted-foreground"> {it.model}</span>}
                          {it.quantity > 1 && <Badge variant="outline" className="ml-2">×{it.quantity}</Badge>}
                          <Badge variant="secondary" className="ml-2 text-xs">{it.condition}</Badge>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => deleteEquipment(it.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                <Button type="submit" disabled={updateRoomMutation.isPending}>
                  {updateRoomMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
