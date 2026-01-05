import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  FileText, Search, Eye, RefreshCw, Activity as ActivityIcon,
  User, Shield, Database, UserPlus, LogOut, Calendar as CalendarIcon,
  Download, Filter, Clock, Hotel, Trash2, CreditCard, AlertTriangle
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  admin_user_id: string;
  admin_email?: string;
  action: string;
  target_user_id?: string;
  target_email?: string;
  details?: any;
  created_at: string;
}

interface ActivityLogEntry {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  activity_type: string;
  entity_type: string;
  entity_id: string;
  actor_name?: string;
  actor_type: string;
  details?: any;
  timestamp: string;
}

interface DailyLogEntry {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  action_type: string;
  description: string;
  room_number?: string;
  actor_name?: string;
  actor_type?: string;
  log_date: string;
  created_at: string;
  details?: any;
}

const ACTION_CONFIGS: Record<string, { label: string; icon: any; color: string }> = {
  'create_user': { label: 'Création utilisateur', icon: UserPlus, color: 'bg-green-100 text-green-700' },
  'suspend_user': { label: 'Suspension', icon: Shield, color: 'bg-red-100 text-red-700' },
  'unsuspend_user': { label: 'Réactivation', icon: Shield, color: 'bg-green-100 text-green-700' },
  'change_subscription': { label: 'Changement plan', icon: CreditCard, color: 'bg-blue-100 text-blue-700' },
  'change_subscription_type': { label: 'Changement abonnement', icon: CreditCard, color: 'bg-blue-100 text-blue-700' },
  'extend_trial': { label: 'Extension essai', icon: CalendarIcon, color: 'bg-purple-100 text-purple-700' },
  'force_logout': { label: 'Déconnexion forcée', icon: LogOut, color: 'bg-orange-100 text-orange-700' },
  'delete_session': { label: 'Session supprimée', icon: Trash2, color: 'bg-red-100 text-red-700' },
  'change_role': { label: 'Changement rôle', icon: Shield, color: 'bg-amber-100 text-amber-700' },
  'room_assigned': { label: 'Assignation', icon: Hotel, color: 'bg-blue-100 text-blue-700' },
  'cleaning-start': { label: 'Début nettoyage', icon: ActivityIcon, color: 'bg-yellow-100 text-yellow-700' },
  'cleaning-end': { label: 'Fin nettoyage', icon: ActivityIcon, color: 'bg-green-100 text-green-700' },
  'incident_created': { label: 'Incident créé', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
};

export function EnhancedAuditLogPanel() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [logType, setLogType] = useState<'audit' | 'activity' | 'daily'>('audit');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date()
  });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();

    const auditChannel = supabase
      .channel('admin-audit-enhanced')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_audit_log' }, loadLogs)
      .subscribe();

    const activityChannel = supabase
      .channel('activities-enhanced')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, loadLogs)
      .subscribe();

    return () => {
      supabase.removeChannel(auditChannel);
      supabase.removeChannel(activityChannel);
    };
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      // Load audit logs with enrichment
      const { data: auditData } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      const enrichedAudit = await Promise.all(
        (auditData || []).map(async (log) => {
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', log.admin_user_id)
            .single();

          let targetEmail = null;
          if (log.target_user_id) {
            const { data: targetProfile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', log.target_user_id)
              .single();
            targetEmail = targetProfile?.email;
          }

          return { ...log, admin_email: adminProfile?.email, target_email: targetEmail };
        })
      );
      setAuditLogs(enrichedAudit);

      // Load activities
      const { data: activityData } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      const enrichedActivities = await Promise.all(
        (activityData || []).map(async (activity) => {
          const { data: hotelData } = await supabase
            .from('hotels')
            .select('name')
            .eq('id', activity.hotel_id)
            .single();
          return { ...activity, hotel_name: hotelData?.name || 'Inconnu' };
        })
      );
      setActivities(enrichedActivities);

      // Load daily action logs
      const { data: dailyData } = await supabase
        .from('daily_action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      const enrichedDaily = await Promise.all(
        (dailyData || []).map(async (log) => {
          const { data: hotelData } = await supabase
            .from('hotels')
            .select('name')
            .eq('id', log.hotel_id)
            .single();
          return { ...log, hotel_name: hotelData?.name || 'Inconnu' };
        })
      );
      setDailyLogs(enrichedDaily);

    } catch (error) {
      console.error('Error loading logs:', error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les journaux." });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    let logs: any[] = [];
    
    if (logType === 'audit') logs = auditLogs;
    else if (logType === 'activity') logs = activities;
    else logs = dailyLogs;

    return logs.filter(log => {
      // Date filter
      const logDate = new Date(log.created_at || log.timestamp);
      if (!isWithinInterval(logDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) {
        return false;
      }

      // Action filter
      if (actionFilter !== 'all') {
        const action = log.action || log.activity_type || log.action_type;
        if (action !== actionFilter) return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const searchFields = [
          log.admin_email, log.target_email, log.action,
          log.actor_name, log.hotel_name, log.activity_type,
          log.description, log.room_number, log.action_type
        ].filter(Boolean);
        
        if (!searchFields.some(field => field?.toLowerCase().includes(search))) {
          return false;
        }
      }

      return true;
    });
  }, [logType, auditLogs, activities, dailyLogs, dateRange, actionFilter, searchTerm]);

  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    auditLogs.forEach(l => l.action && actions.add(l.action));
    activities.forEach(l => l.activity_type && actions.add(l.activity_type));
    dailyLogs.forEach(l => l.action_type && actions.add(l.action_type));
    return Array.from(actions);
  }, [auditLogs, activities, dailyLogs]);

  const getActionBadge = (action: string) => {
    const config = ACTION_CONFIGS[action] || { label: action, icon: ActivityIcon, color: 'bg-gray-100 text-gray-700' };
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const exportLogs = () => {
    const csv = [
      ['Date', 'Type', 'Action', 'Acteur', 'Cible', 'Détails'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.created_at || log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        logType,
        log.action || log.activity_type || log.action_type,
        log.admin_email || log.actor_name || '-',
        log.target_email || log.hotel_name || '-',
        JSON.stringify(log.details || {}).replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${logType}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const stats = useMemo(() => ({
    total: filteredLogs.length,
    today: filteredLogs.filter(l => {
      const date = new Date(l.created_at || l.timestamp);
      return format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    }).length,
    actions: uniqueActions.length
  }), [filteredLogs, uniqueActions]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Journal des Actions Avancé
            </CardTitle>
            <CardDescription>
              {stats.total} entrée(s) • {stats.today} aujourd'hui • {stats.actions} types d'actions
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportLogs} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
            <Button onClick={loadLogs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Log Type Tabs */}
        <Tabs value={logType} onValueChange={(v: any) => setLogType(v)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="audit">
              <Shield className="h-4 w-4 mr-2" />
              Actions Admin ({auditLogs.length})
            </TabsTrigger>
            <TabsTrigger value="activity">
              <ActivityIcon className="h-4 w-4 mr-2" />
              Activités Système ({activities.length})
            </TabsTrigger>
            <TabsTrigger value="daily">
              <Clock className="h-4 w-4 mr-2" />
              Logs Journaliers ({dailyLogs.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>
                  {ACTION_CONFIGS[action]?.label || action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px]">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={fr}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Quick Date Filters */}
        <div className="flex gap-2 mb-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setDateRange({ from: new Date(), to: new Date() })}
          >
            Aujourd'hui
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
          >
            7 derniers jours
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
          >
            30 derniers jours
          </Button>
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Heure</TableHead>
                <TableHead>Action</TableHead>
                {logType === 'audit' && (
                  <>
                    <TableHead>Admin</TableHead>
                    <TableHead>Cible</TableHead>
                  </>
                )}
                {logType === 'activity' && (
                  <>
                    <TableHead>Hôtel</TableHead>
                    <TableHead>Acteur</TableHead>
                  </>
                )}
                {logType === 'daily' && (
                  <>
                    <TableHead>Hôtel</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Chambre</TableHead>
                  </>
                )}
                <TableHead className="text-right">Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Chargement...</TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucune entrée trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(log.created_at || log.timestamp), 'dd/MM HH:mm:ss', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action || log.activity_type || log.action_type)}
                    </TableCell>
                    
                    {logType === 'audit' && (
                      <>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {log.admin_email || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{log.target_email || '-'}</TableCell>
                      </>
                    )}
                    
                    {logType === 'activity' && (
                      <>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Hotel className="h-3 w-3 text-muted-foreground" />
                            {log.hotel_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.actor_name || 'Système'}
                          <Badge variant="secondary" className="ml-2 text-xs">{log.actor_type}</Badge>
                        </TableCell>
                      </>
                    )}
                    
                    {logType === 'daily' && (
                      <>
                        <TableCell className="text-sm">{log.hotel_name}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{log.description}</TableCell>
                        <TableCell>
                          {log.room_number && <Badge variant="outline">{log.room_number}</Badge>}
                        </TableCell>
                      </>
                    )}
                    
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setShowDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de l'entrée</DialogTitle>
            <DialogDescription>Informations complètes</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
