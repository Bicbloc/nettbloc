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
import { Search, RefreshCw, LogIn, Users, Building, Download } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

interface EstablishmentRow {
  hotel_id: string;
  hotel_name: string;
  hotel_code: string;
  owner_email: string | null;
  last_login: string | null;
  active_sessions: number;
  housekeepers_count: number;
  governesses_count: number;
  technicians_count: number;
  subaccounts_count: number;
}

interface DailyConn { day: string; user_type: string; connections: number; }

const RANGES = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
];

const TYPE_LABELS: Record<string, string> = {
  establishment: 'Établissement',
  housekeeper: 'Femme de chambre',
  governess: 'Gouvernante',
  technician: 'Technicien',
  unknown: 'Autre',
};

const TYPE_COLORS: Record<string, string> = {
  establishment: 'hsl(160 84% 39%)',
  housekeeper: 'hsl(262 83% 58%)',
  governess: 'hsl(38 92% 50%)',
  technician: 'hsl(217 91% 60%)',
  unknown: 'hsl(var(--muted-foreground))',
};

export function ConnectionsPanel() {
  const [rows, setRows] = useState<EstablishmentRow[]>([]);
  const [daily, setDaily] = useState<DailyConn[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: estData, error: e1 }, { data: dailyData, error: e2 }] = await Promise.all([
        supabase.rpc('admin_get_establishment_connections'),
        supabase.rpc('admin_get_connections_daily', { p_days: Number(days) }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setRows((estData as EstablishmentRow[]) || []);
      setDaily((dailyData as DailyConn[]) || []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  // Pivot daily data: one entry per day with a key per user_type
  const chartData = useMemo(() => {
    const byDay: Record<string, any> = {};
    const types = new Set<string>();
    daily.forEach(d => {
      const key = format(new Date(d.day), 'dd/MM', { locale: fr });
      byDay[key] = byDay[key] || { day: key };
      byDay[key][d.user_type] = Number(d.connections);
      types.add(d.user_type);
    });
    return { data: Object.values(byDay), types: Array.from(types) };
  }, [daily]);

  const filtered = useMemo(() => rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.hotel_name?.toLowerCase().includes(s)
      || r.hotel_code?.toLowerCase().includes(s)
      || r.owner_email?.toLowerCase().includes(s);
  }), [rows, search]);

  const totals = useMemo(() => ({
    establishments: rows.length,
    activeSessions: rows.reduce((s, r) => s + Number(r.active_sessions || 0), 0),
    staff: rows.reduce((s, r) => s + Number(r.housekeepers_count || 0) + Number(r.governesses_count || 0) + Number(r.technicians_count || 0) + Number(r.subaccounts_count || 0), 0),
    totalConnections: daily.reduce((s, d) => s + Number(d.connections || 0), 0),
  }), [rows, daily]);

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  const exportCsv = () => {
    const csv = [
      ['Établissement', 'Code', 'Email', 'Dernière connexion', 'Sessions actives', 'FdC', 'Gouvernantes', 'Techniciens', 'Sous-comptes'].join(','),
      ...filtered.map(r => [
        r.hotel_name, r.hotel_code, r.owner_email || '-',
        r.last_login ? format(new Date(r.last_login), 'yyyy-MM-dd HH:mm') : '-',
        r.active_sessions, r.housekeepers_count, r.governesses_count, r.technicians_count, r.subaccounts_count,
      ].join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `connexions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building} label="Établissements" value={fmt(totals.establishments)} />
        <StatCard icon={LogIn} label="Sessions actives" value={fmt(totals.activeSessions)} />
        <StatCard icon={Users} label="Personnel total" value={fmt(totals.staff)} />
        <StatCard icon={LogIn} label="Connexions (période)" value={fmt(totals.totalConnections)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <LogIn className="h-4 w-4" /> Historique des connexions
              </CardTitle>
              <CardDescription>Connexions par jour et par type d'utilisateur</CardDescription>
            </div>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-[300px]">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Aucune connexion enregistrée sur la période
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend formatter={(v) => TYPE_LABELS[v] || v} />
                {chartData.types.map(t => (
                  <Area
                    key={t}
                    type="monotone"
                    dataKey={t}
                    name={t}
                    stackId="1"
                    stroke={TYPE_COLORS[t] || TYPE_COLORS.unknown}
                    fill={TYPE_COLORS[t] || TYPE_COLORS.unknown}
                    fillOpacity={0.3}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Connexions & personnel par établissement</CardTitle>
              <CardDescription>{filtered.length} établissement(s)</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
              <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Actualiser</Button>
            </div>
          </div>
          <div className="relative mt-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Rechercher (nom, code, email)..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead className="text-right">Sessions actives</TableHead>
                  <TableHead className="text-right">FdC</TableHead>
                  <TableHead className="text-right">Gouv.</TableHead>
                  <TableHead className="text-right">Tech.</TableHead>
                  <TableHead className="text-right">Sous-comptes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun établissement</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.hotel_id}>
                    <TableCell>
                      <div className="font-medium">{r.hotel_name}</div>
                      <div className="text-xs text-muted-foreground">{r.hotel_code} · {r.owner_email || '—'}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.last_login ? format(new Date(r.last_login), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(r.active_sessions) > 0
                        ? <Badge variant="default">{r.active_sessions}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-right">{fmt(Number(r.housekeepers_count))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.governesses_count))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.technicians_count))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.subaccounts_count))}</TableCell>
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

export default ConnectionsPanel;
