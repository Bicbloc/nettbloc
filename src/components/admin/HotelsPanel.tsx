import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Hotel, Search, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface HotelRow {
  id: string;
  name: string;
  hotel_code: string;
  user_email: string;
  housekeepers_count: number;
  active_sessions: number;
  rooms_count: number;
  created_at: string;
}

export function HotelsPanel() {
  const { toast } = useToast();
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      // Single batched approach: load all base data, then enrich client-side
      const [hotelsRes, profilesRes, hkRes, sessionsRes, roomsRes] = await Promise.all([
        supabase.from('hotels').select('id, name, hotel_code, created_at, user_id'),
        supabase.from('profiles').select('id, email'),
        supabase.from('housekeepers').select('id, hotel_id, is_active'),
        supabase.from('user_sessions').select('id, hotel_id, is_active'),
        supabase.from('rooms').select('id, hotel_id'),
      ]);

      if (hotelsRes.error) throw hotelsRes.error;

      const profilesById = new Map((profilesRes.data || []).map(p => [p.id, p.email]));
      const enriched: HotelRow[] = (hotelsRes.data || []).map(h => ({
        id: h.id,
        name: h.name,
        hotel_code: h.hotel_code || '',
        user_email: profilesById.get(h.user_id) || '—',
        housekeepers_count: (hkRes.data || []).filter(x => x.hotel_id === h.id && x.is_active).length,
        active_sessions: (sessionsRes.data || []).filter(x => x.hotel_id === h.id && x.is_active).length,
        rooms_count: (roomsRes.data || []).filter(x => x.hotel_id === h.id).length,
        created_at: h.created_at,
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setHotels(enriched);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return hotels;
    return hotels.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.hotel_code.toLowerCase().includes(q) ||
      h.user_email.toLowerCase().includes(q)
    );
  }, [hotels, search]);

  const exportCsv = () => {
    const header = 'Nom,Code,Propriétaire,Femmes de chambre,Sessions actives,Chambres,Créé le\n';
    const rows = filtered.map(h =>
      `"${h.name}","${h.hotel_code}","${h.user_email}",${h.housekeepers_count},${h.active_sessions},${h.rooms_count},"${h.created_at}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `hotels-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Hotel className="h-5 w-5" /> Établissements</CardTitle>
            <CardDescription>{hotels.length} hôtel(s) au total</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-64" />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Propriétaire</TableHead>
                <TableHead className="text-center">Chambres</TableHead>
                <TableHead className="text-center">FdC</TableHead>
                <TableHead className="text-center">Sessions</TableHead>
                <TableHead>Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(h => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell><Badge variant="outline">{h.hotel_code || '—'}</Badge></TableCell>
                  <TableCell className="text-sm">{h.user_email}</TableCell>
                  <TableCell className="text-center">{h.rooms_count}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={h.housekeepers_count > 0 ? 'default' : 'secondary'}>{h.housekeepers_count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={h.active_sessions > 0 ? 'default' : 'secondary'}>{h.active_sessions}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(h.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun hôtel trouvé</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default HotelsPanel;
