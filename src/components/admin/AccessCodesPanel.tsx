import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Key, Search, RefreshCw, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { ForceCodeGenerationButton } from '@/components/ForceCodeGenerationButton';

interface CodeRow {
  id: string;
  access_code: string;
  housekeeper_name: string;
  hotel_name: string;
  hotel_code: string;
  is_active: boolean;
  created_at: string;
  used_at: string | null;
}

export function AccessCodesPanel() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'used' | 'unused'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [codesRes, hotelsRes, hkRes] = await Promise.all([
        supabase.from('housekeeper_access_codes')
          .select('id, access_code, is_active, created_at, used_at, hotel_id, housekeeper_id')
          .order('created_at', { ascending: false }),
        supabase.from('hotels').select('id, name, hotel_code'),
        supabase.from('housekeepers').select('id, name'),
      ]);
      if (codesRes.error) throw codesRes.error;

      const hotelsById = new Map((hotelsRes.data || []).map(h => [h.id, h]));
      const hkById = new Map((hkRes.data || []).map(h => [h.id, h.name]));

      const enriched: CodeRow[] = (codesRes.data || []).map(c => {
        const h = hotelsById.get(c.hotel_id);
        return {
          id: c.id,
          access_code: c.access_code,
          housekeeper_name: c.housekeeper_id ? (hkById.get(c.housekeeper_id) || 'Non assigné') : 'Non assigné',
          hotel_name: h?.name || 'Inconnu',
          hotel_code: h?.hotel_code || '',
          is_active: c.is_active,
          created_at: c.created_at,
          used_at: c.used_at,
        };
      });
      setCodes(enriched);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return codes.filter(c => {
      if (filter === 'active' && !c.is_active) return false;
      if (filter === 'used' && !c.used_at) return false;
      if (filter === 'unused' && c.used_at) return false;
      if (!q) return true;
      return c.access_code.toLowerCase().includes(q) ||
        c.housekeeper_name.toLowerCase().includes(q) ||
        c.hotel_name.toLowerCase().includes(q);
    });
  }, [codes, search, filter]);

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Code copié' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Codes d'accès</CardTitle>
            <CardDescription>{codes.length} code(s) au total</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-64" />
            </div>
            <div className="flex gap-1">
              {(['all', 'active', 'used', 'unused'] as const).map(f => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
                  {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : f === 'used' ? 'Utilisés' : 'Non utilisés'}
                </Button>
              ))}
            </div>
            <ForceCodeGenerationButton onRefresh={load} />
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
                <TableHead>Code</TableHead>
                <TableHead>Femme de chambre</TableHead>
                <TableHead>Hôtel</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead>Utilisé</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-bold">{c.access_code}</TableCell>
                  <TableCell>{c.housekeeper_name}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.hotel_name}</div>
                    <div className="text-xs text-muted-foreground">{c.hotel_code}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Actif' : 'Inactif'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(c.created_at), 'dd/MM/yy HH:mm', { locale: fr })}</TableCell>
                  <TableCell className="text-sm">
                    {c.used_at
                      ? format(new Date(c.used_at), 'dd/MM/yy HH:mm', { locale: fr })
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => copy(c.access_code)}><Copy className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun code trouvé</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default AccessCodesPanel;
