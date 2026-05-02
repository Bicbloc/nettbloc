import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotel } from '@/contexts/HotelContext';
import { useEquipment, type Equipment, type EquipmentCondition } from '@/hooks/use-equipment';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit, AlertTriangle, ArrowLeft, Building2, Sofa, Package, Layers } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { RoomIssuesOverlay } from '@/components/equipment/RoomIssuesOverlay';

const CONDITIONS: { value: EquipmentCondition; label: string; color: string }[] = [
  { value: 'new', label: 'Neuf', color: 'bg-emerald-500' },
  { value: 'good', label: 'Bon', color: 'bg-green-500' },
  { value: 'worn', label: 'Usé', color: 'bg-amber-500' },
  { value: 'broken', label: 'HS', color: 'bg-red-500' },
  { value: 'missing', label: 'Manquant', color: 'bg-red-700' },
  { value: 'to_replace', label: 'À remplacer', color: 'bg-orange-500' },
];

export default function Equipment() {
  const navigate = useNavigate();
  const { hotelId } = useHotel();

  const eq = useEquipment(hotelId);
  const [rooms, setRooms] = useState<{ id: string; room_number: string; floor: number | null; room_type: string | null }[]>([]);

  // dialog state
  const [equipDialog, setEquipDialog] = useState<{ open: boolean; data?: Partial<Equipment>; locationType?: 'room' | 'space'; locationId?: string }>({ open: false });
  const [issueDialog, setIssueDialog] = useState<{ open: boolean; equipmentId?: string; roomId?: string; spaceId?: string }>({ open: false });
  const [spaceDialog, setSpaceDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [buildingDialog, setBuildingDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [bulkDialog, setBulkDialog] = useState(false);

  useEffect(() => {
    if (!hotelId) return;
    supabase.from('hotel_rooms_registry')
      .select('id, room_number, floor, room_type')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .order('room_number')
      .then(({ data }) => setRooms(data || []));
  }, [hotelId]);

  const issuesByRoom = useMemo(() => {
    const m: Record<string, number> = {};
    eq.issues.forEach(i => { if (i.room_registry_id) m[i.room_registry_id] = (m[i.room_registry_id] || 0) + 1; });
    return m;
  }, [eq.issues]);

  if (!hotelId) {
    return (
      <div className="container mx-auto p-6">
        <p>Sélectionnez un hôtel pour gérer les équipements.</p>
      </div>
    );
  }

  // ----- Save handlers -----
  const saveEquipment = async (form: Partial<Equipment>) => {
    try {
      await eq.upsertEquipment({
        ...form,
        hotel_id: hotelId,
        name: form.name || 'Sans nom',
        room_registry_id: equipDialog.locationType === 'room' ? equipDialog.locationId : null,
        common_space_id: equipDialog.locationType === 'space' ? equipDialog.locationId : null,
      } as any);
      toast({ title: 'Équipement enregistré' });
      setEquipDialog({ open: false });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const saveIssue = async (form: any) => {
    try {
      await eq.createIssue({
        hotel_id: hotelId,
        equipment_id: issueDialog.equipmentId || null,
        room_registry_id: issueDialog.roomId || null,
        common_space_id: issueDialog.spaceId || null,
        title: form.title,
        description: form.description,
        issue_type: form.issue_type,
        reported_by_name: form.reported_by_name || null,
      } as any);
      toast({ title: 'Problème signalé' });
      setIssueDialog({ open: false });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const saveBuilding = async (form: any) => {
    try {
      const payload = { ...form, hotel_id: hotelId };
      const { error } = form.id
        ? await supabase.from('buildings').update(payload).eq('id', form.id)
        : await supabase.from('buildings').insert(payload);
      if (error) throw error;
      toast({ title: 'Bâtiment enregistré' });
      setBuildingDialog({ open: false });
      eq.refresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const saveBulkEquipment = async (form: any, targetRoomIds: string[]) => {
    try {
      if (targetRoomIds.length === 0) {
        toast({ title: 'Aucune chambre sélectionnée', variant: 'destructive' });
        return;
      }
      const payload = targetRoomIds.map(rid => ({
        hotel_id: hotelId!,
        room_registry_id: rid,
        common_space_id: null,
        name: form.name || 'Sans nom',
        brand: form.brand || null,
        model: form.model || null,
        reference: form.reference || null,
        purchase_date: form.purchase_date || null,
        warranty_end_date: form.warranty_end_date || null,
        purchase_price: form.purchase_price || null,
        supplier: form.supplier || null,
        condition: form.condition || 'good',
        quantity: form.quantity || 1,
        notes: form.notes || null,
      }));
      const { error } = await supabase.from('equipments').insert(payload);
      if (error) throw error;
      toast({ title: `${payload.length} équipement(s) ajouté(s)` });
      setBulkDialog(false);
      eq.refresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const saveSpace = async (form: any) => {
    try {
      const payload = { ...form, hotel_id: hotelId, floor: form.floor ? Number(form.floor) : null, area_sqm: form.area_sqm ? Number(form.area_sqm) : null };
      const { error } = form.id
        ? await supabase.from('common_spaces').update(payload).eq('id', form.id)
        : await supabase.from('common_spaces').insert(payload);
      if (error) throw error;
      toast({ title: 'Espace enregistré' });
      setSpaceDialog({ open: false });
      eq.refresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        <h1 className="text-2xl font-bold">Équipements & caractéristiques</h1>
      </div>

      <Tabs defaultValue="rooms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rooms"><Sofa className="h-4 w-4 mr-1" />Chambres</TabsTrigger>
          <TabsTrigger value="spaces"><Building2 className="h-4 w-4 mr-1" />Espaces communs</TabsTrigger>
          <TabsTrigger value="buildings">Bâtiments</TabsTrigger>
          <TabsTrigger value="issues"><AlertTriangle className="h-4 w-4 mr-1" />Problèmes ({eq.issues.length})</TabsTrigger>
        </TabsList>

        {/* ------------------------- ROOMS ------------------------- */}
        <TabsContent value="rooms" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setBulkDialog(true)} disabled={rooms.length === 0}>
              <Layers className="h-4 w-4 mr-1" />Ajouter en masse
            </Button>
          </div>
          {rooms.length === 0 && (
            <Card><CardContent className="p-4 text-sm text-muted-foreground">
              Aucune chambre dans le registre. Ajoutez-en depuis « Registre des chambres ».
            </CardContent></Card>
          )}
          {rooms.map(room => {
            const items = eq.equipmentsForRoom(room.id);
            const roomIssues = eq.issuesForRoom(room.id);
            const ch = eq.characteristicsForRoom(room.id);
            return (
              <Card key={room.id} className="relative">
                {roomIssues.length > 0 && (
                  <RoomIssuesOverlay
                    issues={roomIssues}
                    roomNumber={room.room_number}
                    onResolve={(id) => eq.resolveIssue(id)}
                  />
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Chambre {room.room_number}
                    {room.floor !== null && <Badge variant="outline">Étage {room.floor}</Badge>}
                    {ch?.bed_type && <Badge variant="secondary">{ch.bed_type} {ch.bed_dimensions}</Badge>}
                    {ch?.view_type && <Badge variant="secondary">Vue {ch.view_type}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {items.map(it => {
                      const cond = CONDITIONS.find(c => c.value === it.condition);
                      return (
                        <div key={it.id} className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs bg-card">
                          <span className={`h-2 w-2 rounded-full ${cond?.color || 'bg-gray-400'}`} />
                          <span className="font-medium">{it.name}</span>
                          {it.brand && <span className="text-muted-foreground">· {it.brand}</span>}
                          {it.quantity > 1 && <span className="text-muted-foreground">×{it.quantity}</span>}
                          <button onClick={() => setEquipDialog({ open: true, data: it, locationType: 'room', locationId: room.id })} className="ml-1 text-muted-foreground hover:text-foreground"><Edit className="h-3 w-3" /></button>
                          <button onClick={() => { if (confirm('Supprimer ?')) eq.deleteEquipment(it.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                    {items.length === 0 && <span className="text-xs text-muted-foreground">Aucun équipement</span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setEquipDialog({ open: true, locationType: 'room', locationId: room.id })}>
                      <Plus className="h-3 w-3 mr-1" />Équipement
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIssueDialog({ open: true, roomId: room.id })}>
                      <AlertTriangle className="h-3 w-3 mr-1" />Signaler
                    </Button>
                    <CharacteristicsButton hotelId={hotelId} roomId={room.id} current={ch} onSave={(c) => eq.upsertCharacteristics(c)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ------------------------- SPACES ------------------------- */}
        <TabsContent value="spaces" className="space-y-3">
          <Button size="sm" onClick={() => setSpaceDialog({ open: true, data: {} })}><Plus className="h-4 w-4 mr-1" />Nouvel espace</Button>
          {eq.spaces.length === 0 && <p className="text-sm text-muted-foreground">Aucun espace commun défini.</p>}
          {eq.spaces.map(space => {
            const items = eq.equipmentsForSpace(space.id);
            const spaceIssues = eq.issuesForSpace(space.id);
            return (
              <Card key={space.id} className="relative">
                {spaceIssues.length > 0 && (
                  <RoomIssuesOverlay issues={spaceIssues} roomNumber={space.name} onResolve={(id) => eq.resolveIssue(id)} />
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {space.name}
                    <Badge variant="outline">{space.space_type}</Badge>
                    {space.floor !== null && <Badge variant="outline">Étage {space.floor}</Badge>}
                    {space.area_sqm && <Badge variant="secondary">{space.area_sqm} m²</Badge>}
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSpaceDialog({ open: true, data: space })}><Edit className="h-3 w-3" /></Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {items.map(it => {
                      const cond = CONDITIONS.find(c => c.value === it.condition);
                      return (
                        <div key={it.id} className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs bg-card">
                          <span className={`h-2 w-2 rounded-full ${cond?.color || 'bg-gray-400'}`} />
                          <span className="font-medium">{it.name}</span>
                          {it.brand && <span className="text-muted-foreground">· {it.brand}</span>}
                          <button onClick={() => setEquipDialog({ open: true, data: it, locationType: 'space', locationId: space.id })}><Edit className="h-3 w-3" /></button>
                          <button onClick={() => { if (confirm('Supprimer ?')) eq.deleteEquipment(it.id); }}><Trash2 className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEquipDialog({ open: true, locationType: 'space', locationId: space.id })}>
                      <Plus className="h-3 w-3 mr-1" />Équipement
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIssueDialog({ open: true, spaceId: space.id })}>
                      <AlertTriangle className="h-3 w-3 mr-1" />Signaler
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ------------------------- BUILDINGS ------------------------- */}
        <TabsContent value="buildings" className="space-y-3">
          <Button size="sm" onClick={() => setBuildingDialog({ open: true, data: {} })}><Plus className="h-4 w-4 mr-1" />Nouveau bâtiment</Button>
          {eq.buildings.map(b => (
            <Card key={b.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{b.name}</p>
                  {b.description && <p className="text-xs text-muted-foreground">{b.description}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setBuildingDialog({ open: true, data: b })}><Edit className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ------------------------- ISSUES ------------------------- */}
        <TabsContent value="issues" className="space-y-2">
          {eq.issues.length === 0 && <p className="text-sm text-muted-foreground">Aucun problème en cours 🎉</p>}
          {eq.issues.map(issue => {
            const room = rooms.find(r => r.id === issue.room_registry_id);
            const space = eq.spaces.find(s => s.id === issue.common_space_id);
            const equip = eq.equipments.find(e => e.id === issue.equipment_id);
            return (
              <Card key={issue.id}>
                <CardContent className="p-3 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{issue.issue_type}</Badge>
                      <span className="font-medium">{issue.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {room && `Chambre ${room.room_number}`}{space && space.name}
                      {equip && ` · ${equip.name}`}
                      {' · '}{new Date(issue.reported_at).toLocaleDateString()}
                    </p>
                    {issue.description && <p className="text-sm mt-1">{issue.description}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => eq.resolveIssue(issue.id)}>Résoudre</Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Equipment dialog */}
      <EquipmentFormDialog
        open={equipDialog.open}
        onClose={() => setEquipDialog({ open: false })}
        initial={equipDialog.data}
        categories={eq.categories}
        onSave={saveEquipment}
      />

      {/* Issue dialog */}
      <IssueFormDialog
        open={issueDialog.open}
        onClose={() => setIssueDialog({ open: false })}
        equipments={eq.equipments.filter(e =>
          (issueDialog.roomId && e.room_registry_id === issueDialog.roomId) ||
          (issueDialog.spaceId && e.common_space_id === issueDialog.spaceId)
        )}
        onSave={saveIssue}
        onPickEquipment={(id) => setIssueDialog(d => ({ ...d, equipmentId: id }))}
      />

      {/* Space dialog */}
      <SpaceFormDialog
        open={spaceDialog.open}
        onClose={() => setSpaceDialog({ open: false })}
        initial={spaceDialog.data}
        buildings={eq.buildings}
        onSave={saveSpace}
      />

      {/* Building dialog */}
      <BuildingFormDialog
        open={buildingDialog.open}
        onClose={() => setBuildingDialog({ open: false })}
        initial={buildingDialog.data}
        onSave={saveBuilding}
      />
    </div>
  );
}

// ============== Sub components ==============

function EquipmentFormDialog({ open, onClose, initial, categories, onSave }: any) {
  const [form, setForm] = useState<any>(initial || {});
  useEffect(() => { setForm(initial || { condition: 'good', quantity: 1 }); }, [initial, open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{form.id ? 'Modifier' : 'Nouvel'} équipement</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nom *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Marque</Label><Input value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
          <div><Label>Modèle</Label><Input value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
          <div><Label>Référence</Label><Input value={form.reference || ''} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
          <div><Label>N° de série</Label><Input value={form.serial_number || ''} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
          <div><Label>Date d'achat</Label><Input type="date" value={form.purchase_date || ''} onChange={e => setForm({ ...form, purchase_date: e.target.value || null })} /></div>
          <div><Label>Fin de garantie</Label><Input type="date" value={form.warranty_end_date || ''} onChange={e => setForm({ ...form, warranty_end_date: e.target.value || null })} /></div>
          <div><Label>Prix d'achat</Label><Input type="number" step="0.01" value={form.purchase_price ?? ''} onChange={e => setForm({ ...form, purchase_price: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>Fournisseur</Label><Input value={form.supplier || ''} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
          <div><Label>Quantité</Label><Input type="number" min="1" value={form.quantity ?? 1} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
          <div><Label>État</Label>
            <Select value={form.condition || 'good'} onValueChange={v => setForm({ ...form, condition: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Photo (URL)</Label><Input value={form.photo_url || ''} onChange={e => setForm({ ...form, photo_url: e.target.value })} /></div>
          <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(form)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueFormDialog({ open, onClose, equipments, onSave, onPickEquipment }: any) {
  const [form, setForm] = useState<any>({ issue_type: 'to_repair' });
  useEffect(() => { if (open) setForm({ issue_type: 'to_repair' }); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Signaler un problème</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Type</Label>
            <Select value={form.issue_type} onValueChange={v => setForm({ ...form, issue_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="to_repair">À réparer</SelectItem>
                <SelectItem value="to_replace">À remplacer</SelectItem>
                <SelectItem value="missing">Manquant</SelectItem>
                <SelectItem value="damaged">Endommagé</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {equipments.length > 0 && (
            <div><Label>Équipement concerné (optionnel)</Label>
              <Select onValueChange={(v) => onPickEquipment(v)}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {equipments.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Titre *</Label><Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Signalé par</Label><Input value={form.reported_by_name || ''} onChange={e => setForm({ ...form, reported_by_name: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(form)} disabled={!form.title}>Signaler</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpaceFormDialog({ open, onClose, initial, buildings, onSave }: any) {
  const [form, setForm] = useState<any>(initial || {});
  useEffect(() => { setForm(initial || { space_type: 'lobby' }); }, [initial, open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{form.id ? 'Modifier' : 'Nouvel'} espace</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nom *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Type</Label>
            <Select value={form.space_type || 'other'} onValueChange={v => setForm({ ...form, space_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['lobby','reception','restaurant','bar','spa','gym','pool','corridor','parking','meeting_room','laundry','storage','kitchen','staff_area','garden','other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {buildings.length > 0 && (
            <div><Label>Bâtiment</Label>
              <Select value={form.building_id || ''} onValueChange={v => setForm({ ...form, building_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {buildings.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Étage</Label><Input type="number" value={form.floor ?? ''} onChange={e => setForm({ ...form, floor: e.target.value })} /></div>
            <div><Label>Surface (m²)</Label><Input type="number" step="0.1" value={form.area_sqm ?? ''} onChange={e => setForm({ ...form, area_sqm: e.target.value })} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuildingFormDialog({ open, onClose, initial, onSave }: any) {
  const [form, setForm] = useState<any>(initial || {});
  useEffect(() => { setForm(initial || {}); }, [initial, open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{form.id ? 'Modifier' : 'Nouveau'} bâtiment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nom *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CharacteristicsButton({ hotelId, roomId, current, onSave }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(current || {});
  useEffect(() => { setForm(current || { amenities: [] }); }, [current, open]);
  const [amenityInput, setAmenityInput] = useState('');

  const save = async () => {
    try {
      await onSave({
        ...form,
        hotel_id: hotelId,
        room_registry_id: roomId,
        amenities: form.amenities || [],
        custom_fields: form.custom_fields || {},
        bed_count: form.bed_count ? Number(form.bed_count) : 1,
        room_area_sqm: form.room_area_sqm ? Number(form.room_area_sqm) : null,
      });
      toast({ title: 'Caractéristiques enregistrées' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Package className="h-3 w-3 mr-1" />Caractéristiques</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Caractéristiques de la chambre</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Type de lit</Label><Input placeholder="King, Queen, Twin..." value={form.bed_type || ''} onChange={e => setForm({ ...form, bed_type: e.target.value })} /></div>
          <div><Label>Dimensions lit</Label><Input placeholder="180×200" value={form.bed_dimensions || ''} onChange={e => setForm({ ...form, bed_dimensions: e.target.value })} /></div>
          <div><Label>Nombre de lits</Label><Input type="number" value={form.bed_count ?? 1} onChange={e => setForm({ ...form, bed_count: e.target.value })} /></div>
          <div><Label>Type SDB</Label><Input value={form.bathroom_type || ''} onChange={e => setForm({ ...form, bathroom_type: e.target.value })} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={!!form.has_bathtub} onChange={e => setForm({ ...form, has_bathtub: e.target.checked })} /><Label>Baignoire</Label></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={!!form.has_shower} onChange={e => setForm({ ...form, has_shower: e.target.checked })} /><Label>Douche</Label></div>
          <div><Label>Bureau (dimensions)</Label><Input value={form.desk_dimensions || ''} onChange={e => setForm({ ...form, desk_dimensions: e.target.value })} /></div>
          <div><Label>Surface (m²)</Label><Input type="number" step="0.1" value={form.room_area_sqm ?? ''} onChange={e => setForm({ ...form, room_area_sqm: e.target.value })} /></div>
          <div className="col-span-2"><Label>Vue</Label><Input placeholder="Mer, Jardin, Ville..." value={form.view_type || ''} onChange={e => setForm({ ...form, view_type: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>Amenities</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {(form.amenities || []).map((a: string, i: number) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {a}
                  <button onClick={() => setForm({ ...form, amenities: form.amenities.filter((_: any, j: number) => j !== i) })}>×</button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input placeholder="Wifi, Mini-bar, Coffre..." value={amenityInput} onChange={e => setAmenityInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && amenityInput.trim()) { setForm({ ...form, amenities: [...(form.amenities || []), amenityInput.trim()] }); setAmenityInput(''); } }} />
              <Button size="sm" onClick={() => { if (amenityInput.trim()) { setForm({ ...form, amenities: [...(form.amenities || []), amenityInput.trim()] }); setAmenityInput(''); } }}>+</Button>
            </div>
          </div>
          <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={save}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
