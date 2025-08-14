import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Users, Hotel, Activity, Shield, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalHotels: number;
  activeSessions: number;
  passwordResets24h: number;
  newSignups24h: number;
  userGrowth: Array<{ date: string; users: number; hotels: number }>;
  sessionActivity: Array<{ hour: string; sessions: number }>;
  subscriptionDistribution: Array<{ type: string; count: number; value: number }>;
  topHotels: Array<{ name: string; housekeepers: number; sessions: number }>;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalHotels: 0,
    activeSessions: 0,
    passwordResets24h: 0,
    newSignups24h: 0,
    userGrowth: [],
    sessionActivity: [],
    subscriptionDistribution: [],
    topHotels: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load basic stats
      const [usersResult, hotelsResult, sessionsResult, resetResult] = await Promise.all([
        supabase.from('profiles').select('id, created_at, subscription_type'),
        supabase.from('hotels').select('id, name, created_at'),
        supabase.from('user_sessions').select('id, login_time, is_active'),
        supabase.from('password_reset_logs').select('id, requested_at').gte('requested_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      const users = usersResult.data || [];
      const hotels = hotelsResult.data || [];
      const sessions = sessionsResult.data || [];
      const resets = resetResult.data || [];

      // Calculate basic metrics
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const newSignups24h = users.filter(u => new Date(u.created_at) > yesterday).length;
      const activeSessions = sessions.filter(s => s.is_active).length;

      // Generate user growth data (last 7 days)
      const userGrowth = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const userCount = users.filter(u => new Date(u.created_at) <= date).length;
        const hotelCount = hotels.filter(h => new Date(h.created_at) <= date).length;
        
        userGrowth.push({
          date: date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
          users: userCount,
          hotels: hotelCount
        });
      }

      // Generate session activity (last 24 hours by hour)
      const sessionActivity = [];
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourStart = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours());
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
        
        const sessionCount = sessions.filter(s => {
          const loginTime = new Date(s.login_time);
          return loginTime >= hourStart && loginTime < hourEnd;
        }).length;
        
        sessionActivity.push({
          hour: hour.getHours().toString().padStart(2, '0') + 'h',
          sessions: sessionCount
        });
      }

      // Calculate subscription distribution
      const subscriptionCounts = users.reduce((acc, user) => {
        const type = user.subscription_type || 'free';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const subscriptionDistribution = Object.entries(subscriptionCounts).map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        value: count
      }));

      // Load top hotels with housekeeper counts
      const { data: topHotelsData } = await supabase
        .from('hotels')
        .select(`
          name,
          housekeepers:housekeepers(count),
          user_sessions(count)
        `)
        .limit(5);

      const topHotels = (topHotelsData || []).map((hotel: any) => ({
        name: hotel.name,
        housekeepers: hotel.housekeepers?.[0]?.count || 0,
        sessions: hotel.user_sessions?.[0]?.count || 0
      }));

      setStats({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.subscription_type !== 'free').length,
        totalHotels: hotels.length,
        activeSessions,
        passwordResets24h: resets.length,
        newSignups24h,
        userGrowth,
        sessionActivity,
        subscriptionDistribution,
        topHotels
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.newSignups24h} en 24h
              {stats.newSignups24h > 0 && <TrendingUp className="h-3 w-3 inline ml-1 text-green-500" />}
            </p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hôtels</CardTitle>
            <Hotel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHotels}</div>
            <p className="text-xs text-muted-foreground">
              Établissements actifs
            </p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions Actives</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSessions}</div>
            <p className="text-xs text-muted-foreground">
              Utilisateurs connectés
            </p>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Réinitialisations</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.passwordResets24h}</div>
            <p className="text-xs text-muted-foreground">
              Mot de passe en 24h
              {stats.passwordResets24h > 5 && <AlertTriangle className="h-3 w-3 inline ml-1 text-amber-500" />}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="card-modern">
          <CardHeader>
            <CardTitle>Croissance (7 derniers jours)</CardTitle>
            <CardDescription>
              Évolution des utilisateurs et hôtels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Utilisateurs"
                />
                <Line 
                  type="monotone" 
                  dataKey="hotels" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  name="Hôtels"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader>
            <CardTitle>Activité des Sessions</CardTitle>
            <CardDescription>
              Connexions par heure (24h)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.sessionActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="sessions" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader>
            <CardTitle>Répartition des Abonnements</CardTitle>
            <CardDescription>
              Types d'abonnements actifs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.subscriptionDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ type, count }) => `${type}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.subscriptionDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-modern">
          <CardHeader>
            <CardTitle>Top Hôtels</CardTitle>
            <CardDescription>
              Par nombre de femmes de chambre
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topHotels.map((hotel, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{hotel.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hotel.sessions} sessions actives
                  </p>
                </div>
                <Badge variant="secondary">
                  {hotel.housekeepers} femmes de chambre
                </Badge>
              </div>
            ))}
            {stats.topHotels.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune donnée disponible
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
