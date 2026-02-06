import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Target,
  Zap,
  Timer,
  Award
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";
import { useIncidentDefaults } from "@/hooks/use-incident-defaults";
import { cn } from "@/lib/utils";

interface IncidentDashboardProps {
  hotelId: string;
}

const COLORS = {
  new: "#ef4444",
  in_progress: "#f59e0b",
  resolved: "#22c55e",
  pending: "#6b7280"
};

const PRIORITY_COLORS = {
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#ef4444",
  urgent: "#dc2626"
};

export function IncidentDashboard({ hotelId }: IncidentDashboardProps) {
  useIncidentDefaults(hotelId);
  
  const { data: stats } = useQuery({
    queryKey: ["incident-stats", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("hotel_id", hotelId);
      
      if (error) throw error;

      const total = data.length;
      const byStatus = {
        new: data.filter(i => i.status === "new").length,
        in_progress: data.filter(i => i.status === "in_progress").length,
        resolved: data.filter(i => i.status === "resolved").length,
      };
      const byPriority = {
        low: data.filter(i => i.priority === "low").length,
        medium: data.filter(i => i.priority === "medium").length,
        high: data.filter(i => i.priority === "high").length,
        urgent: data.filter(i => i.priority === "urgent").length,
      };

      // Calculate resolution metrics
      const resolvedIncidents = data.filter(i => i.status === "resolved" && i.resolved_at);
      const avgResolutionTime = resolvedIncidents.length > 0
        ? resolvedIncidents.reduce((acc, i) => {
            const hours = differenceInHours(new Date(i.resolved_at), new Date(i.created_at));
            return acc + hours;
          }, 0) / resolvedIncidents.length
        : 0;

      const resolutionRate = total > 0 ? (byStatus.resolved / total) * 100 : 0;

      // Top reported items
      const itemCounts: Record<string, number> = {};
      data.forEach(i => {
        if (i.item_id) {
          itemCounts[i.item_id] = (itemCounts[i.item_id] || 0) + 1;
        }
      });

      // Top reporters
      const reporterCounts: Record<string, { count: number; type: string }> = {};
      data.forEach(i => {
        const key = i.reported_by_name;
        if (!reporterCounts[key]) {
          reporterCounts[key] = { count: 0, type: i.reported_by_type };
        }
        reporterCounts[key].count += 1;
      });

      const topReporters = Object.entries(reporterCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, data]) => ({ name, ...data }));

      return { 
        total, 
        byStatus, 
        byPriority, 
        incidents: data,
        avgResolutionTime: Math.round(avgResolutionTime),
        resolutionRate: Math.round(resolutionRate),
        topReporters
      };
    },
  });

  const { data: dailyStats } = useQuery({
    queryKey: ["incident-daily-stats", hotelId],
    queryFn: async () => {
      const last30Days = eachDayOfInterval({
        start: subMonths(new Date(), 1),
        end: new Date()
      });

      const { data, error } = await supabase
        .from("incidents")
        .select("created_at, status")
        .eq("hotel_id", hotelId)
        .gte("created_at", subMonths(new Date(), 1).toISOString());
      
      if (error) throw error;

      return last30Days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayIncidents = data.filter(i => 
          format(new Date(i.created_at), "yyyy-MM-dd") === dayStr
        );
        
        return {
          date: format(day, "dd MMM", { locale: fr }),
          total: dayIncidents.length,
          new: dayIncidents.filter(i => i.status === "new").length,
          in_progress: dayIncidents.filter(i => i.status === "in_progress").length,
          resolved: dayIncidents.filter(i => i.status === "resolved").length,
        };
      });
    },
  });

  const { data: monthlyStats } = useQuery({
    queryKey: ["incident-monthly-stats", hotelId],
    queryFn: async () => {
      const last12Months = Array.from({ length: 12 }, (_, i) => subMonths(new Date(), i)).reverse();

      const { data, error } = await supabase
        .from("incidents")
        .select("created_at, status")
        .eq("hotel_id", hotelId)
        .gte("created_at", subMonths(new Date(), 12).toISOString());
      
      if (error) throw error;

      return last12Months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthIncidents = data.filter(i => {
          const incidentDate = new Date(i.created_at);
          return incidentDate >= monthStart && incidentDate <= monthEnd;
        });
        
        return {
          month: format(month, "MMM yyyy", { locale: fr }),
          total: monthIncidents.length,
          new: monthIncidents.filter(i => i.status === "new").length,
          resolved: monthIncidents.filter(i => i.status === "resolved").length,
        };
      });
    },
  });

  const statusData = stats ? [
    { name: "Nouveau", value: stats.byStatus.new, color: COLORS.new },
    { name: "En cours", value: stats.byStatus.in_progress, color: COLORS.in_progress },
    { name: "Résolu", value: stats.byStatus.resolved, color: COLORS.resolved },
  ] : [];

  const priorityData = stats ? [
    { name: "Faible", value: stats.byPriority.low, color: PRIORITY_COLORS.low },
    { name: "Moyen", value: stats.byPriority.medium, color: PRIORITY_COLORS.medium },
    { name: "Élevé", value: stats.byPriority.high, color: PRIORITY_COLORS.high },
    { name: "Urgent", value: stats.byPriority.urgent, color: PRIORITY_COLORS.urgent },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Enhanced KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total incidents</CardTitle>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tous statuts confondus
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À traiter</CardTitle>
            <Zap className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">
              {(stats?.byStatus.new || 0) + (stats?.byStatus.in_progress || 0)}
            </div>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {stats?.byStatus.new || 0} nouveaux
              </Badge>
              <Badge variant="outline" className="text-xs">
                {stats?.byStatus.in_progress || 0} en cours
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de résolution</CardTitle>
            <Target className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">
              {stats?.resolutionRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.byStatus.resolved || 0} résolus sur {stats?.total || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temps moyen</CardTitle>
            <Timer className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">
              {stats?.avgResolutionTime || 0}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Délai de résolution moyen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Reporters */}
      {stats?.topReporters && stats.topReporters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-5 w-5 text-primary" />
              Top signalements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.topReporters.map((reporter, index) => (
                <div 
                  key={reporter.name}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg",
                    "bg-muted/50 border",
                    index === 0 && "border-primary bg-primary/5"
                  )}
                >
                  <span className="text-lg font-bold text-muted-foreground">
                    #{index + 1}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{reporter.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {reporter.count} incidents • {
                        reporter.type === 'housekeeper' ? 'Femme de chambre' : 
                        reporter.type === 'technician' ? 'Technicien' :
                        reporter.type === 'governess' ? 'Gouvernante' :
                        'Admin'
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Par jour</TabsTrigger>
          <TabsTrigger value="monthly">Par mois</TabsTrigger>
          <TabsTrigger value="status">Par statut</TabsTrigger>
          <TabsTrigger value="priority">Par priorité</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incidents des 30 derniers jours</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" name="Total" strokeWidth={2} />
                  <Line type="monotone" dataKey="new" stroke={COLORS.new} name="Nouveau" />
                  <Line type="monotone" dataKey="in_progress" stroke={COLORS.in_progress} name="En cours" />
                  <Line type="monotone" dataKey="resolved" stroke={COLORS.resolved} name="Résolu" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incidents des 12 derniers mois</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" fill="hsl(var(--primary))" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="new" fill={COLORS.new} name="Nouveau" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" fill={COLORS.resolved} name="Résolu" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Répartition par statut</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="priority" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Répartition par priorité</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
