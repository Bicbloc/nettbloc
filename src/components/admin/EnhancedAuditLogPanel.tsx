import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
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
  admin_company?: string;
  action: string;
  target_user_id?: string;
  target_email?: string;
  target_company?: string;
  details?: any;
  created_at: string;
}

interface ActivityLogEntry {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  hotel_code?: string;
  activity_type: string;
  entity_type: string;
  entity_id: string;
  actor_name?: string;
  actor_type: string;
  details?: any;
  timestamp: string;
  created_at?: string;
}

interface DailyLogEntry {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  hotel_code?: string;
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
  'housekeeper_connected': { label: 'Connexion', icon: User, color: 'bg-blue-100 text-blue-700' },
  'terminate_session': { label: 'Session terminée', icon: LogOut, color: 'bg-orange-100 text-orange-700' },
};

const PAGE_SIZE = 50;

export function EnhancedAuditLogPanel() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [logType, setLogType] = useState<'audit' | 'activity' | 'daily'>('audit');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date()
  });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCounts, setTotalCounts] = useState({ audit: 0, activity: 0, daily: 0 });
  const { toast } = useToast();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

  // Reload when date range changes
  useEffect(() => {
    setCurrentPage(1);
    loadLogs();
  }, [dateRange]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Load audit logs from enriched view (eliminates N+1 queries)
      const { data: auditData, count: auditCount } = await supabase
        .from('audit_logs_enriched')
        .select('*', { count: 'exact' })
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      setAuditLogs(auditData || []);

      // Load activities from enriched view
      const { data: activityData, count: activityCount } = await supabase
        .from('activities_enriched')
        .select('*', { count: 'exact' })
        .gte('timestamp', dateRange.from.toISOString())
        .lte('timestamp', dateRange.to.toISOString())
        .order('timestamp', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      setActivities(activityData || []);

      // Load daily logs from enriched view
      const { data: dailyData, count: dailyCount } = await supabase
        .from('daily_logs_enriched')
        .select('*', { count: 'exact' })
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      setDailyLogs(dailyData || []);

      setTotalCounts({
        audit: auditCount || 0,
        activity: activityCount || 0,
        daily: dailyCount || 0
      });

    } catch (error) {
      console.error('Error loading logs:', error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les journaux." });
    } finally {
      setLoading(false);
    }
  }, [dateRange, currentPage, toast]);

  const filteredLogs = useMemo(() => {
    let logs: any[] = [];
    
    if (logType === 'audit') logs = auditLogs;
    else if (logType === 'activity') logs = activities;
    else logs = dailyLogs;

    return logs.filter(log => {
      // Action filter
      if (actionFilter !== 'all') {
        const action = log.action || log.activity_type || log.action_type;
        if (action !== actionFilter) return false;
      }

      // Search filter (debounced)
      if (debouncedSearchTerm) {
        const search = debouncedSearchTerm.toLowerCase();
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
  }, [logType, auditLogs, activities, dailyLogs, actionFilter, debouncedSearchTerm]);

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

  const totalPages = Math.ceil(
    (logType === 'audit' ? totalCounts.audit : logType === 'activity' ? totalCounts.activity : totalCounts.daily) / PAGE_SIZE
  );

  const stats = useMemo(() => ({
    total: logType === 'audit' ? totalCounts.audit : logType === 'activity' ? totalCounts.activity : totalCounts.daily,
    today: filteredLogs.filter(l => {
      const date = new Date(l.created_at || l.timestamp);
      return format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    }).length,
    actions: uniqueActions.length
  }), [filteredLogs, uniqueActions, logType, totalCounts]);

  const renderSkeletonRows = () => (
    Array.from({ length: 10 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
      </TableRow>
    ))
  );

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
            <Button onClick={loadLogs} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Log Type Tabs */}
        <Tabs value={logType} onValueChange={(v: any) => { setLogType(v); setCurrentPage(1); }} className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="audit">
              <Shield className="h-4 w-4 mr-2" />
              Actions Admin ({totalCounts.audit})
            </TabsTrigger>
            <TabsTrigger value="activity">
              <ActivityIcon className="h-4 w-4 mr-2" />
              Activités Système ({totalCounts.activity})
            </TabsTrigger>
            <TabsTrigger value="daily">
              <Clock className="h-4 w-4 mr-2" />
              Logs Journaliers ({totalCounts.daily})
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
              {loading ? renderSkeletonRows() : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucune entrée trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/50">
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
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {log.actor_name || '-'}
                          </div>
                        </TableCell>
                      </>
                    )}
                    
                    {logType === 'daily' && (
                      <>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Hotel className="h-3 w-3 text-muted-foreground" />
                            {log.hotel_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {log.description}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.room_number || '-'}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                  if (page > totalPages) return null;
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de l'entrée</DialogTitle>
            <DialogDescription>
              Informations complètes sur cette action
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date/Heure</p>
                  <p className="text-sm">
                    {format(new Date(selectedLog.created_at || selectedLog.timestamp), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  {getActionBadge(selectedLog.action || selectedLog.activity_type || selectedLog.action_type)}
                </div>
                {selectedLog.admin_email && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Administrateur</p>
                    <p className="text-sm">{selectedLog.admin_email}</p>
                  </div>
                )}
                {selectedLog.target_email && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Utilisateur cible</p>
                    <p className="text-sm">{selectedLog.target_email}</p>
                  </div>
                )}
                {selectedLog.hotel_name && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Établissement</p>
                    <p className="text-sm">{selectedLog.hotel_name}</p>
                  </div>
                )}
                {selectedLog.actor_name && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Acteur</p>
                    <p className="text-sm">{selectedLog.actor_name}</p>
                  </div>
                )}
                {selectedLog.room_number && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Chambre</p>
                    <p className="text-sm">{selectedLog.room_number}</p>
                  </div>
                )}
              </div>
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Détails</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
