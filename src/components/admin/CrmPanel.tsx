import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, Download, Users, FileText, Euro, Building2, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CrmDetailDrawer } from './CrmDetailDrawer';

interface CrmRow {
  hotelId: string;
  userId: string | null;
  name: string;
  hotel_code: string;
  email: string;
  phone: string;
  owner_email: string;
  company_name: string;
  subscription_type: string;
  invoice_count: number;
  total_spent: number; // cents
  staff_count: number;
  rooms_count: number;
}

const fmtEur = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

export function CrmPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CrmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [hotelsRes, profilesRes, invoicesRes, hkRes, subRes, govRes, techRes, roomsRes] = await Promise.all([
        supabase.from('hotels').select('id, name, hotel_code, email, phone, user_id'),
        supabase.from('profiles').select('id, email, company_name, subscription_type'),
        supabase.from('invoices').select('hotel_id, user_id, amount_ttc, status'),
        supabase.from('housekeepers').select('hotel_id, is_active'),
        supabase.from('sub_accounts').select('hotel_id, is_active'),
        (supabase as any).from('governess_profiles').select('hotel_id, is_active'),
        (supabase as any).from('technician_profiles').select('hotel_id, is_active'),
        supabase.from('rooms').select('hotel_id'),
      ]);
      if (hotelsRes.error) throw hotelsRes.error;

      const profById = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const invoices = invoicesRes.data || [];
      const countActive = (arr: any[] | null, hid: string) =>
        (arr || []).filter(x => x.hotel_id === hid && x.is_active).length;

      const enriched: CrmRow[] = (hotelsRes.data || []).map(h => {
        const prof: any = profById.get(h.user_id) || {};
        const hInvoices = invoices.filter(i => i.hotel_id === h.id || i.user_id === h.user_id);
        const paid = hInvoices.filter(i => i.status === 'paid');
        return {
          hotelId: h.id,
          name: h.name,
          hotel_code: h.hotel_code || '',
          email: h.email || '',
          phone: h.phone || '',
          owner_email: prof.email || '—',
          company_name: prof.company_name || '—',
          subscription_type: prof.subscription_type || 'trial',
          invoice_count: hInvoices.length,
          total_spent: paid.reduce((s, i) => s + (i.amount_ttc || 0), 0),
          staff_count:
            countActive(hkRes.data, h.id) +
            countActive(subRes.data, h.id) +
            countActive(govRes.data, h.id) +
            countActive(techRes.data, h.id),
          rooms_count: (roomsRes.data || []).filter(r => r.hotel_id === h.id).length,
        };
      }).sort((a, b) => b.total_spent - a.total_spent);

      setRows(enriched);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.hotel_code.toLowerCase().includes(q) ||
      r.owner_email.toLowerCase().includes(q) ||
      r.company_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    hotels: filtered.length,
    revenue: filtered.reduce((s, r) => s + r.total_spent, 0),
    invoices: filtered.reduce((s, r) => s + r.invoice_count, 0),
    staff: filtered.reduce((s, r) => s + r.staff_count, 0),
  }), [filtered]);

  const exportCsv = () => {
    const header = 'Hôtel,Code,Email,Téléphone,Propriétaire,Société,Plan,Factures,Total dépensé (€),Personnel,Chambres\n';
    const body = filtered.map(r =>
      `"${r.name}","${r.hotel_code}","${r.email}","${r.phone}","${r.owner_email}","${r.company_name}","${r.subscription_type}",${r.invoice_count},${(r.total_spent / 100).toFixed(2)},${r.staff_count},${r.rooms_count}`
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `crm-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Hôtels" value={String(totals.hotels)} />
        <StatCard icon={Euro} label="Chiffre encaissé" value={fmtEur(totals.revenue)} />
        <StatCard icon={FileText} label="Factures" value={String(totals.invoices)} />
        <StatCard icon={Users} label="Personnel total" value={String(totals.staff)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> CRM Clients</CardTitle>
              <CardDescription>Données de contact et activité par établissement</CardDescription>
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
                  <TableHead>Hôtel</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Propriétaire</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-center">Factures</TableHead>
                  <TableHead className="text-right">Total dépensé</TableHead>
                  <TableHead className="text-center">Personnel</TableHead>
                  <TableHead className="text-center">Chambres</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filtered.map(r => (
                      <TableRow key={r.hotelId}>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <Badge variant="outline" className="mt-1">{r.hotel_code || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{r.email || '—'}</div>
                          <div className="text-muted-foreground">{r.phone || '—'}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{r.owner_email}</div>
                          <div className="text-muted-foreground">{r.company_name}</div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{r.subscription_type}</Badge></TableCell>
                        <TableCell className="text-center">{r.invoice_count}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtEur(r.total_spent)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={r.staff_count > 0 ? 'default' : 'secondary'}>{r.staff_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{r.rooms_count}</TableCell>
                      </TableRow>
                    ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun client trouvé</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CrmPanel;
