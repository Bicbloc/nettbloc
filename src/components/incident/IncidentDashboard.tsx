import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Calendar,
  Users
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { useIncidentDefaults } from "@/hooks/use-incident-defaults";

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
  // Initialiser les données par défaut si nécessaire
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

      return { total, byStatus, byPriority, incidents: data };
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
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nouveaux</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.byStatus.new || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En cours</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats?.byStatus.in_progress || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Résolus</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.byStatus.resolved || 0}</div>
          </CardContent>
        </Card>
      </div>

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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#8884d8" name="Total" />
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#8884d8" name="Total" />
                  <Bar dataKey="new" fill={COLORS.new} name="Nouveau" />
                  <Bar dataKey="resolved" fill={COLORS.resolved} name="Résolu" />
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