import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Hotel, Activity, Key, CreditCard, AlertCircle, Search, TrendingUp } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Stats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  trial_users: number;
  paid_users: number;
  total_hotels: number;
  active_sessions: number;
  total_housekeepers: number;
  open_tickets: number;
}

interface SearchHit {
  type: 'user' | 'hotel' | 'code';
  id: string;
  label: string;
  sub: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))', 'hsl(var(--destructive))'];

interface AdminDashboardProps {
  onNavigate: (section: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [stats, setStats] = useState<Stats>({
    total_users: 0, active_users: 0, suspended_users: 0,
    trial_users: 0, paid_users: 0,
    total_hotels: 0, active_sessions: 0, total_housekeepers: 0, open_tickets: 0,
  });
  const [signupSeries, setSignupSeries] = useState<{ date: string; users: number }[]>([]);
  const [planDist, setPlanDist] = useState<{ name: string; value: number }[]>([]);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchData, setSearchData] = useState<{
    users: any[]; hotels: any[]; codes: any[];
  }>({ users: [], hotels: [], codes: [] });

  useEffect(() => {
    (async () => {
      const [profilesRes, hotelsRes, sessionsRes, hkRes, codesRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('id, email, company_name, is_suspended, subscription_type, created_at'),
        supabase.from('hotels').select('id, name, hotel_code'),
        supabase.from('user_sessions').select('id, is_active').eq('is_active', true),
        supabase.from('housekeepers').select('id, is_active').eq('is_active', true),
        supabase.from('housekeeper_access_codes').select('id, access_code, is_active'),
        supabase.from('support_tickets').select('id, status').neq('status', 'closed'),
      ]);

      const profiles = profilesRes.data || [];
      const hotels = hotelsRes.data || [];
      const codes = codesRes.data || [];

      // KPIs
      const trial = profiles.filter(p => p.subscription_type === 'trial' || !p.subscription_type).length;
      const paid = profiles.filter(p => p.subscription_type && p.subscription_type !== 'trial' && p.subscription_type !== 'free').length;

      setStats({
        total_users: profiles.length,
        active_users: profiles.filter(p => !p.is_suspended).length,
        suspended_users: profiles.filter(p => p.is_suspended).length,
        trial_users: trial,
        paid_users: paid,
        total_hotels: hotels.length,
        active_sessions: (sessionsRes.data || []).length,
        total_housekeepers: (hkRes.data || []).length,
        open_tickets: (ticketsRes.data || []).length,
      });

      // 30-day signup series
      const days: { date: string; users: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = startOfDay(subDays(new Date(), i));
        days.push({ date: format(d, 'dd/MM', { locale: fr }), users: 0 });
      }
      profiles.forEach(p => {
        const d = startOfDay(new Date(p.created_at));
        const idx = days.findIndex(x => x.date === format(d, 'dd/MM', { locale: fr }));
        if (idx >= 0) days[idx].users++;
      });
      setSignupSeries(days);

      // Plan distribution
      const planMap = new Map<string, number>();
      profiles.forEach(p => {
        const t = p.subscription_type || 'trial';
        planMap.set(t, (planMap.get(t) || 0) + 1);
      });
      setPlanDist(Array.from(planMap.entries()).map(([name, value]) => ({ name, value })));

      setSearchData({ users: profiles, hotels, codes });
    })();
  }, []);

  // Global search across users, hotels, codes
  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (q.length < 2) { setHits([]); return; }
    const out: SearchHit[] = [];
    searchData.users.forEach(u => {
      if ((u.email || '').toLowerCase().includes(q) || (u.company_name || '').toLowerCase().includes(q)) {
        out.push({ type: 'user', id: u.id, label: u.email, sub: u.company_name || '—' });
      }
    });
    searchData.hotels.forEach(h => {
      if ((h.name || '').toLowerCase().includes(q) || (h.hotel_code || '').toLowerCase().includes(q)) {
        out.push({ type: 'hotel', id: h.id, label: h.name, sub: `Code ${h.hotel_code || '—'}` });
      }
    });
    searchData.codes.forEach(c => {
      if ((c.access_code || '').toLowerCase().includes(q)) {
        out.push({ type: 'code', id: c.id, label: c.access_code, sub: c.is_active ? 'Actif' : 'Inactif' });
      }
    });
    setHits(out.slice(0, 20));
  }, [search, searchData]);

  const Kpi = ({ icon: Icon, label, value, sub, tone, onClick }: any) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${tone || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Global search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un utilisateur, hôtel, code d'accès..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
          {hits.length > 0 && (
            <div className="mt-3 border rounded-md max-h-72 overflow-auto divide-y">
              {hits.map(h => (
                <button
                  key={`${h.type}-${h.id}`}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 text-left"
                  onClick={() => onNavigate(h.type === 'user' ? 'users' : h.type === 'hotel' ? 'hotels' : 'access-codes')}
                >
                  <div>
                    <div className="font-medium text-sm">{h.label}</div>
                    <div className="text-xs text-muted-foreground">{h.sub}</div>
                  </div>
                  <Badge variant="outline">{h.type === 'user' ? 'Utilisateur' : h.type === 'hotel' ? 'Hôtel' : 'Code'}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Utilisateurs" value={stats.total_users}
          sub={`${stats.active_users} actifs · ${stats.suspended_users} suspendus`}
          onClick={() => onNavigate('users')} />
        <Kpi icon={Hotel} label="Établissements" value={stats.total_hotels}
          sub="Hôtels enregistrés" onClick={() => onNavigate('hotels')} />
        <Kpi icon={Activity} label="Sessions actives" value={stats.active_sessions}
          sub="Connexions en cours" tone="text-emerald-500"
          onClick={() => onNavigate('sessions')} />
        <Kpi icon={Key} label="Femmes de chambre" value={stats.total_housekeepers}
          sub="Comptes actifs" tone="text-violet-500"
          onClick={() => onNavigate('access-codes')} />
        <Kpi icon={CreditCard} label="Abonnés payants" value={stats.paid_users}
          sub={`${stats.trial_users} en essai`} tone="text-emerald-500"
          onClick={() => onNavigate('plans')} />
        <Kpi icon={TrendingUp} label="Conversion" value={stats.total_users > 0 ? `${Math.round(stats.paid_users / stats.total_users * 100)}%` : '0%'}
          sub="Payants / total" />
        <Kpi icon={AlertCircle} label="Tickets ouverts" value={stats.open_tickets}
          sub="Support" tone={stats.open_tickets > 0 ? 'text-destructive' : 'text-muted-foreground'}
          onClick={() => onNavigate('tickets')} />
        <Kpi icon={Users} label="Suspendus" value={stats.suspended_users}
          sub="Comptes désactivés" tone={stats.suspended_users > 0 ? 'text-destructive' : 'text-muted-foreground'}
          onClick={() => onNavigate('users')} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Inscriptions sur 30 jours</CardTitle>
            <CardDescription>Nouveaux utilisateurs par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={signupSeries}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition des plans</CardTitle>
            <CardDescription>Type d'abonnement</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={planDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdminDashboard;
