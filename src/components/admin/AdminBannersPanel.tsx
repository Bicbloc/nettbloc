import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, Megaphone, Calendar, Users, Globe } from 'lucide-react';
import { EU_COUNTRIES } from '@/constants/euCountries';

type BannerType = 'info' | 'maintenance' | 'promotion' | 'urgent';
type Scope = 'all' | 'countries' | 'plans' | 'hotels';

interface Banner {
  id: string;
  title: string;
  message: string;
  message_en: string | null;
  banner_type: BannerType;
  action_label: string | null;
  action_label_en: string | null;
  action_url: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  is_dismissible: boolean;
  target_scope: Scope;
  target_countries: string[] | null;
  target_plans: string[] | null;
  target_hotel_ids: string[] | null;
  created_at: string;
}

interface HotelOption { id: string; name: string; hotel_code: string | null; }

const PLANS = ['free', 'trial', 'premium'];

const TYPE_BADGES: Record<BannerType, string> = {
  info: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-amber-100 text-amber-800',
  promotion: 'bg-emerald-100 text-emerald-800',
  urgent: 'bg-red-100 text-red-800',
};

const emptyForm = {
  title: '',
  message: '',
  message_en: '',
  banner_type: 'info' as BannerType,
  action_label: '',
  action_label_en: '',
  action_url: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
  is_dismissible: true,
  target_scope: 'all' as Scope,
  target_countries: [] as string[],
  target_plans: [] as string[],
  target_hotel_ids: [] as string[],
};

export const AdminBannersPanel: React.FC = () => {
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_banners')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setBanners(data as any);
    setLoading(false);
  };

  const loadHotels = async () => {
    const { data } = await supabase
      .from('hotels')
      .select('id, name, hotel_code')
      .order('name');
    if (data) setHotels(data as any);
  };

  useEffect(() => { load(); loadHotels(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      title: b.title,
      message: b.message,
      message_en: b.message_en || '',
      banner_type: b.banner_type,
      action_label: b.action_label || '',
      action_label_en: b.action_label_en || '',
      action_url: b.action_url || '',
      starts_at: b.starts_at ? b.starts_at.slice(0, 16) : '',
      ends_at: b.ends_at ? b.ends_at.slice(0, 16) : '',
      is_active: b.is_active,
      is_dismissible: b.is_dismissible,
      target_scope: b.target_scope,
      target_countries: b.target_countries || [],
      target_plans: b.target_plans || [],
      target_hotel_ids: b.target_hotel_ids || [],
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Titre et message sont obligatoires.' });
      return;
    }

    const payload: any = {
      title: form.title.trim(),
      message: form.message.trim(),
      message_en: form.message_en.trim() || null,
      banner_type: form.banner_type,
      action_label: form.action_label.trim() || null,
      action_label_en: form.action_label_en.trim() || null,
      action_url: form.action_url.trim() || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
      is_dismissible: form.is_dismissible,
      target_scope: form.target_scope,
      target_countries: form.target_scope === 'countries' ? form.target_countries : null,
      target_plans: form.target_scope === 'plans' ? form.target_plans : null,
      target_hotel_ids: form.target_scope === 'hotels' ? form.target_hotel_ids : null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('admin_banners').update(payload).eq('id', editing.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id;
      ({ error } = await supabase.from('admin_banners').insert(payload));
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }
    toast({ title: editing ? 'Bannière mise à jour' : 'Bannière créée' });
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer définitivement cette bannière ?')) return;
    const { error } = await supabase.from('admin_banners').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }
    toast({ title: 'Bannière supprimée' });
    load();
  };

  const toggleActive = async (b: Banner) => {
    const { error } = await supabase.from('admin_banners').update({ is_active: !b.is_active }).eq('id', b.id);
    if (!error) load();
  };

  const toggleArrayValue = (key: 'target_countries' | 'target_plans' | 'target_hotel_ids', value: string) => {
    setForm((prev) => {
      const arr = prev[key];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Bannières d'annonce</CardTitle>
          <CardDescription>Affichez des messages aux clients (maintenance, promotion, info, urgence).</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nouvelle bannière</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier la bannière' : 'Nouvelle bannière'}</DialogTitle>
              <DialogDescription>Le message sera affiché aux clients ciblés.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.banner_type} onValueChange={(v) => setForm({ ...form, banner_type: v as BannerType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                      <SelectItem value="urgent">Urgence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />Active</label>
                  <label className="flex items-center gap-2"><Switch checked={form.is_dismissible} onCheckedChange={(v) => setForm({ ...form, is_dismissible: v })} />Dismissible</label>
                </div>
              </div>

              <div>
                <Label>Titre</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Message (FR)</Label>
                <Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <div>
                <Label>Message (EN) — optionnel</Label>
                <Textarea rows={3} value={form.message_en} onChange={(e) => setForm({ ...form, message_en: e.target.value })} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Libellé bouton (FR)</Label>
                  <Input value={form.action_label} onChange={(e) => setForm({ ...form, action_label: e.target.value })} />
                </div>
                <div>
                  <Label>Libellé bouton (EN)</Label>
                  <Input value={form.action_label_en} onChange={(e) => setForm({ ...form, action_label_en: e.target.value })} />
                </div>
                <div>
                  <Label>URL</Label>
                  <Input type="url" value={form.action_url} onChange={(e) => setForm({ ...form, action_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Début (planification)</Label>
                  <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <Label>Fin (optionnel)</Label>
                  <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Cible</Label>
                <Select value={form.target_scope} onValueChange={(v) => setForm({ ...form, target_scope: v as Scope })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les clients</SelectItem>
                    <SelectItem value="countries">Par pays</SelectItem>
                    <SelectItem value="plans">Par plan</SelectItem>
                    <SelectItem value="hotels">Hôtels spécifiques</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.target_scope === 'countries' && (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto grid grid-cols-3 gap-1 text-sm">
                  {EU_COUNTRIES.map((c) => (
                    <label key={c.code} className="flex items-center gap-2">
                      <input type="checkbox" checked={form.target_countries.includes(c.code)} onChange={() => toggleArrayValue('target_countries', c.code)} />
                      {c.code} – {c.nameFr}
                    </label>
                  ))}
                </div>
              )}

              {form.target_scope === 'plans' && (
                <div className="border rounded-md p-3 flex gap-4 text-sm">
                  {PLANS.map((p) => (
                    <label key={p} className="flex items-center gap-2">
                      <input type="checkbox" checked={form.target_plans.includes(p)} onChange={() => toggleArrayValue('target_plans', p)} />
                      {p}
                    </label>
                  ))}
                </div>
              )}

              {form.target_scope === 'hotels' && (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-1 text-sm">
                  {hotels.map((h) => (
                    <label key={h.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={form.target_hotel_ids.includes(h.id)} onChange={() => toggleArrayValue('target_hotel_ids', h.id)} />
                      {h.hotel_code ? `[${h.hotel_code}] ` : ''}{h.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={save}>{editing ? 'Enregistrer' : 'Créer'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : banners.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune bannière. Cliquez sur « Nouvelle bannière » pour en créer une.</p>
        ) : (
          <div className="space-y-2">
            {banners.map((b) => (
              <div key={b.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className={TYPE_BADGES[b.banner_type]}>{b.banner_type}</Badge>
                    {b.is_active ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{b.target_scope}</Badge>
                    {b.ends_at && <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" />jusqu'au {new Date(b.ends_at).toLocaleDateString()}</Badge>}
                  </div>
                  <p className="font-medium">{b.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{b.message}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(b)}>{b.is_active ? 'Désactiver' : 'Activer'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminBannersPanel;
