import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Hotel as HotelIcon, Users, Bed, Activity, Mail, Calendar, Pencil, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Props {
  hotelId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

interface Detail {
  hotel: any;
  owner: any;
  rooms: any[];
  housekeepers: any[];
  governesses: any[];
  technicians: any[];
  sessions: any[];
}

export function HotelDetailDrawer({ hotelId, onClose, onUpdated }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const saveHotel = async () => {
    if (!hotelId) return;
    setSaving(true);
    const { error } = await supabase
      .from('hotels')
      .update({ name: editName.trim(), phone: editPhone.trim() || null })
      .eq('id', hotelId);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }
    setData(d => d ? { ...d, hotel: { ...d.hotel, name: editName.trim(), phone: editPhone.trim() || null } } : d);
    setEditing(false);
    toast({ title: 'Enregistré', description: 'Informations de l\'hôtel mises à jour.' });
    onUpdated?.();
  };


  useEffect(() => {
    if (!hotelId) { setData(null); return; }
    setLoading(true);
    (async () => {
      const hotelRes = await supabase.from('hotels').select('*').eq('id', hotelId).maybeSingle();
      const roomsRes = await supabase.from('rooms').select('id, room_number, status, floor').eq('hotel_id', hotelId).order('room_number');
      const hkRes = await supabase.from('housekeepers').select('id, name, email, is_active, created_at').eq('hotel_id', hotelId);
      const govRes = await (supabase as any).from('governess_profiles').select('id, name, email, is_active').eq('hotel_id', hotelId);
      const techRes = await (supabase as any).from('technician_profiles').select('id, name, email, is_active').eq('hotel_id', hotelId);
      const sessionsRes = await supabase.from('user_sessions').select('id, user_name, user_type, login_time, last_activity, is_active').eq('hotel_id', hotelId).order('last_activity', { ascending: false }).limit(50);

      let owner: any = null;
      if (hotelRes.data?.user_id) {
        const { data: o } = await supabase.from('profiles').select('email, company_name, subscription_type, trial_end_date').eq('id', hotelRes.data.user_id).maybeSingle();
        owner = o;
      }

      setData({
        hotel: hotelRes.data,
        owner,
        rooms: (roomsRes.data as any[]) || [],
        housekeepers: (hkRes.data as any[]) || [],
        governesses: (govRes.data as any[]) || [],
        technicians: (techRes.data as any[]) || [],
        sessions: (sessionsRes.data as any[]) || [],
      });
      setLoading(false);
    })();
  }, [hotelId]);

  return (
    <Sheet open={!!hotelId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading || !data ? (
          <div className="space-y-4 py-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <HotelIcon className="h-5 w-5 text-primary" />
                {data.hotel?.name || 'Hôtel'}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">Code {data.hotel?.hotel_code || '—'}</Badge>
                <span className="text-xs">
                  Créé le {data.hotel?.created_at && format(new Date(data.hotel.created_at), 'dd/MM/yyyy', { locale: fr })}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              {/* Owner */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" />Propriétaire</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Email :</span> {data.owner?.email || '—'}</div>
                  <div><span className="text-muted-foreground">Société :</span> {data.owner?.company_name || '—'}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Plan :</span>
                    <Badge variant="secondary">{data.owner?.subscription_type || 'trial'}</Badge>
                  </div>
                  {data.owner?.trial_end_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs">Essai jusqu'au {format(new Date(data.owner.trial_end_date), 'dd/MM/yyyy', { locale: fr })}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                <StatCard icon={Bed} label="Chambres" value={data.rooms.length} />
                <StatCard icon={Users} label="FdC" value={data.housekeepers.filter(h => h.is_active).length} />
                <StatCard icon={Users} label="Gouv." value={data.governesses.filter(g => g.is_active).length} />
                <StatCard icon={Activity} label="Sessions" value={data.sessions.filter(s => s.is_active).length} />
              </div>

              <Tabs defaultValue="rooms">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="rooms">Chambres ({data.rooms.length})</TabsTrigger>
                  <TabsTrigger value="staff">Personnel</TabsTrigger>
                  <TabsTrigger value="sessions">Sessions</TabsTrigger>
                </TabsList>

                <TabsContent value="rooms">
                  <div className="border rounded max-h-80 overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>N°</TableHead><TableHead>Étage</TableHead><TableHead>Statut</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {data.rooms.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono">{r.room_number}</TableCell>
                            <TableCell>{r.floor ?? '—'}</TableCell>
                            <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                        {data.rooms.length === 0 && (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Aucune chambre</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="staff" className="space-y-3">
                  <StaffSection title="Femmes de chambre" items={data.housekeepers} />
                  <StaffSection title="Gouvernantes" items={data.governesses} />
                  <StaffSection title="Techniciens" items={data.technicians} />
                </TabsContent>

                <TabsContent value="sessions">
                  <div className="border rounded max-h-80 overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Utilisateur</TableHead><TableHead>Type</TableHead><TableHead>Dernière activité</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {data.sessions.map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="text-sm">{s.user_name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{s.user_type}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(s.last_activity), 'dd/MM HH:mm', { locale: fr })}
                              {s.is_active && <Badge variant="default" className="ml-2 text-[10px]">actif</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                        {data.sessions.length === 0 && (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Aucune session</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatCard({ icon: Icon, label, value }: any) {
  return (
    <div className="border rounded-lg p-2 text-center">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

function StaffSection({ title, items }: { title: string; items: any[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1">{title} ({items.length})</div>
      <div className="border rounded divide-y">
        {items.map(p => (
          <div key={p.id} className="p-2 flex items-center justify-between text-sm">
            <div>
              <div>{p.name}</div>
              {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
            </div>
            <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">
              {p.is_active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HotelDetailDrawer;
