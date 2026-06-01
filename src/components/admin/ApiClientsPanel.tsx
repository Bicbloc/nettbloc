import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, RefreshCw, Cpu, Plug, Coins, Activity, Download } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

interface ApiClient {
  hotel_id: string;
  hotel_name: string;
  hotel_code: string;
  pms_type: string | null;
  pms_active: boolean | null;
  pms_last_sync: string | null;
  pms_last_status: string | null;
  pms_syncs: number;
  ai_calls: number;
  ai_tokens: number;
  ai_last_at: string | null;
}

interface DailyUsage { day: string; calls: number; tokens: number; }
interface FunctionUsage { function_name: string; calls: number; tokens: number; last_at: string | null; }

const RANGES = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
  { value: '365', label: '1 an' },
];

export function ApiClientsPanel() {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [search, setSearch] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'pms' | 'ai'>('all');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: clientsData, error: e1 }, { data: dailyData, error: e2 }] = await Promise.all([
        supabase.rpc('admin_get_api_clients', { p_days: Number(days) }),
        supabase.rpc('admin_get_ai_usage_daily', { p_days: Number(days) }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setClients((clientsData as ApiClient[]) || []);
      setDaily(((dailyData as DailyUsage[]) || []).map(d => ({
        ...d,
        day: format(new Date(d.day), 'dd/MM', { locale: fr }),
      })));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const filtered = useMemo(() => clients.filter(c => {
    if (usageFilter === 'pms' && !c.pms_type) return false;
    if (usageFilter === 'ai' && Number(c.ai_calls) === 0) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.hotel_name?.toLowerCase().includes(s) || c.hotel_code?.toLowerCase().includes(s);
    }
    return true;
  }), [clients, usageFilter, search]);

  const totals = useMemo(() => ({
    pmsClients: clients.filter(c => c.pms_type).length,
    aiClients: clients.filter(c => Number(c.ai_calls) > 0).length,
    tokens: clients.reduce((s, c) => s + Number(c.ai_tokens || 0), 0),
    calls: clients.reduce((s, c) => s + Number(c.ai_calls || 0), 0),
  }), [clients]);

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  const exportCsv = () => {
    const csv = [
      ['Établissement', 'Code', 'PMS', 'PMS actif', 'Dernière synchro', 'Synchros', 'Appels IA', 'Tokens IA', 'Dernier appel IA'].join(','),
      ...filtered.map(c => [
        c.hotel_name, c.hotel_code, c.pms_type || '-', c.pms_active ? 'oui' : 'non',
        c.pms_last_sync ? format(new Date(c.pms_last_sync), 'yyyy-MM-dd HH:mm') : '-',
        c.pms_syncs, c.ai_calls, c.ai_tokens,
        c.ai_last_at ? format(new Date(c.ai_last_at), 'yyyy-MM-dd HH:mm') : '-',
      ].join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients_api_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Plug} label="Clients PMS" value={fmt(totals.pmsClients)} />
        <StatCard icon={Cpu} label="Clients IA" value={fmt(totals.aiClients)} />
        <StatCard icon={Activity} label="Appels IA" value={fmt(totals.calls)} />
        <StatCard icon={Coins} label="Tokens consommés" value={fmt(totals.tokens)} />
      </div>

      {/* Daily usage chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Consommation IA quotidienne
          </CardTitle>
          <CardDescription>Appels et tokens par jour sur la période</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : daily.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Aucune donnée IA sur la période
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="calls" name="Appels" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="tokens" name="Tokens" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Clients table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Clients utilisant l'API & l'IA</CardTitle>
              <CardDescription>{filtered.length} établissement(s)</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={usageFilter} onValueChange={(v: any) => setUsageFilter(v)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pms">PMS seulement</SelectItem>
                  <SelectItem value="ai">IA seulement</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
              <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Actualiser</Button>
            </div>
          </div>
          <div className="relative mt-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Rechercher un établissement..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Établissement</TableHead>
                  <TableHead>PMS</TableHead>
                  <TableHead>Dernière synchro</TableHead>
                  <TableHead className="text-right">Synchros</TableHead>
                  <TableHead className="text-right">Appels IA</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead>Dernier appel IA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun client</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.hotel_id}>
                    <TableCell>
                      <div className="font-medium">{c.hotel_name}</div>
                      <div className="text-xs text-muted-foreground">{c.hotel_code}</div>
                    </TableCell>
                    <TableCell>
                      {c.pms_type ? (
                        <Badge variant={c.pms_active ? 'default' : 'secondary'} className="gap-1">
                          <Plug className="h-3 w-3" />{c.pms_type}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.pms_last_sync ? format(new Date(c.pms_last_sync), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{fmt(Number(c.pms_syncs))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(c.ai_calls))}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(c.ai_tokens))}</TableCell>
                    <TableCell className="text-xs">
                      {c.ai_last_at ? format(new Date(c.ai_last_at), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
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
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ApiClientsPanel;
