import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  FileText, Search, Eye, RefreshCw, Activity as ActivityIcon,
  User, Shield, Database, Trash2, UserPlus, LogOut
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

export function AuditLogPanel() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [logType, setLogType] = useState<'audit' | 'activity'>('audit');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();

    // Real-time subscription for audit logs
    const auditChannel = supabase
      .channel('admin-audit')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_audit_log'
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    // Real-time subscription for activities
    const activityChannel = supabase
      .channel('activities')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities'
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(auditChannel);
      supabase.removeChannel(activityChannel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [auditLogs, activities, searchTerm, logType]);

  const loadLogs = async () => {
    try {
      // Load audit logs
      const { data: auditData, error: auditError } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (auditError) throw auditError;

      // Enrich with user emails
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

          return {
            ...log,
            admin_email: adminProfile?.email,
            target_email: targetEmail
          };
        })
      );

      setAuditLogs(enrichedAudit);

      // Load activities
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (activityError) throw activityError;

      // Enrich with hotel names
      const enrichedActivities = await Promise.all(
        (activityData || []).map(async (activity) => {
          const { data: hotelData } = await supabase
            .from('hotels')
            .select('name')
            .eq('id', activity.hotel_id)
            .single();

          return {
            ...activity,
            hotel_name: hotelData?.name || 'Inconnu'
          };
        })
      );

      setActivities(enrichedActivities);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les journaux."
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const logs = logType === 'audit' ? auditLogs : activities;
    
    if (!searchTerm) {
      setFilteredLogs(logs);
      return;
    }

    const filtered = logs.filter(log => {
      const searchLower = searchTerm.toLowerCase();
      if (logType === 'audit') {
        const auditLog = log as AuditLogEntry;
        return (
          auditLog.action.toLowerCase().includes(searchLower) ||
          auditLog.admin_email?.toLowerCase().includes(searchLower) ||
          auditLog.target_email?.toLowerCase().includes(searchLower) ||
          JSON.stringify(auditLog.details).toLowerCase().includes(searchLower)
        );
      } else {
        const activityLog = log as ActivityLogEntry;
        return (
          activityLog.activity_type.toLowerCase().includes(searchLower) ||
          activityLog.entity_type.toLowerCase().includes(searchLower) ||
          activityLog.actor_name?.toLowerCase().includes(searchLower) ||
          activityLog.hotel_name?.toLowerCase().includes(searchLower)
        );
      }
    });

    setFilteredLogs(filtered);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create_user':
      case 'housekeeper_connected':
        return <UserPlus className="h-4 w-4" />;
      case 'suspend_user':
      case 'unsuspend_user':
        return <Shield className="h-4 w-4" />;
      case 'delete_session':
      case 'terminate_session':
        return <LogOut className="h-4 w-4" />;
      case 'change_subscription':
        return <Database className="h-4 w-4" />;
      default:
        return <ActivityIcon className="h-4 w-4" />;
    }
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      'create_user': 'Création utilisateur',
      'suspend_user': 'Suspension utilisateur',
      'unsuspend_user': 'Réactivation utilisateur',
      'delete_session': 'Suppression session',
      'terminate_session': 'Fin de session',
      'change_subscription': 'Changement abonnement',
      'extend_trial': 'Extension essai',
      'housekeeper_connected': 'Connexion femme de chambre',
      'room_assigned': 'Assignation chambre',
      'cleaning-start': 'Début nettoyage',
      'cleaning-end': 'Fin nettoyage',
      'room_status_changed': 'Changement statut chambre'
    };
    return labels[action] || action;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Journal des Actions
            </CardTitle>
            <CardDescription>
              {filteredLogs.length} entrée(s) • Traçabilité complète
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={logType} onValueChange={(value: any) => setLogType(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="audit">Actions Admin</SelectItem>
                <SelectItem value="activity">Activités Système</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadLogs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans les journaux..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Heure</TableHead>
                {logType === 'audit' ? (
                  <>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Cible</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Hôtel</TableHead>
                    <TableHead>Type d'activité</TableHead>
                    <TableHead>Acteur</TableHead>
                  </>
                )}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucune entrée trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  if (logType === 'audit') {
                    const auditLog = log as AuditLogEntry;
                    return (
                      <TableRow key={auditLog.id}>
                        <TableCell className="text-sm">
                          {format(new Date(auditLog.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{auditLog.admin_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {getActionIcon(auditLog.action)}
                            {getActionLabel(auditLog.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {auditLog.target_email || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLog(auditLog);
                              setShowDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  } else {
                    const activityLog = log as ActivityLogEntry;
                    return (
                      <TableRow key={activityLog.id}>
                        <TableCell className="text-sm">
                          {format(new Date(activityLog.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {activityLog.hotel_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {getActionIcon(activityLog.activity_type)}
                            {getActionLabel(activityLog.activity_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {activityLog.actor_name || 'Système'}
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {activityLog.actor_type}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLog(activityLog);
                              setShowDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }
                })
              )}
            </TableBody>
          </Table>
        </div>
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
              <pre className="bg-secondary p-4 rounded-lg text-xs overflow-auto max-h-96">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}