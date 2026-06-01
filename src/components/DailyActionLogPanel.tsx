import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, X, Search, Filter, Clock, User, Bed, 
  PlayCircle, CheckCircle, UserPlus, UserMinus, MessageSquare, AlertTriangle,
  RefreshCw, Archive
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { realtimeManager } from '@/services/RealtimeManager';

interface ActionLog {
  id: string;
  action_type: string;
  actor_name: string | null;
  actor_type: string | null;
  room_number: string | null;
  description: string;
  details: Record<string, any>;
  created_at: string;
}

interface DailyActionLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  hotelId: string;
}

export const DailyActionLogPanel: React.FC<DailyActionLogPanelProps> = ({ 
  isOpen, 
  onClose, 
  hotelId 
}) => {
  const queryClient = useQueryClient();
  const [roomFilter, setRoomFilter] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');

  // Charger les logs du jour
  const { data: logs = [], refetch, isLoading } = useQuery({
    queryKey: ['daily-action-logs', hotelId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_action_logs')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('log_date', today)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as ActionLog[];
    },
    enabled: isOpen && !!hotelId,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!isOpen || !hotelId) return;

    const refreshLogs = () => {
      queryClient.invalidateQueries({ queryKey: ['daily-action-logs', hotelId] });
    };

    const roomStatusSubscriptionId = realtimeManager.subscribe('room_status_updates', refreshLogs);
    const notificationsSubscriptionId = realtimeManager.subscribe('notifications', refreshLogs);
    void realtimeManager.connect(hotelId);

    return () => {
      realtimeManager.unsubscribe(roomStatusSubscriptionId);
      realtimeManager.unsubscribe(notificationsSubscriptionId);
    };
  }, [hotelId, isOpen, queryClient]);

  // Liste unique des utilisateurs pour le filtre
  const uniqueUsers = useMemo(() => {
    const users = logs
      .map(log => log.actor_name)
      .filter((name): name is string => !!name);
    return Array.from(new Set(users));
  }, [logs]);

  // Appliquer les filtres
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filtre par numéro de chambre
      if (roomFilter && log.room_number && !log.room_number.toLowerCase().includes(roomFilter.toLowerCase())) {
        return false;
      }
      
      // Filtre par utilisateur
      if (userFilter !== 'all' && log.actor_name !== userFilter) {
        return false;
      }
      
      // Filtre par type d'action
      if (actionTypeFilter !== 'all' && log.action_type !== actionTypeFilter) {
        return false;
      }
      
      return true;
    });
  }, [logs, roomFilter, userFilter, actionTypeFilter]);

  const getActionIcon = (actionType: string) => {
    const iconClasses = "h-4 w-4";
    switch (actionType) {
      case 'cleaning_start':
        return <PlayCircle className={iconClasses} />;
      case 'cleaning_end':
        return <CheckCircle className={iconClasses} />;
      case 'assignment':
        return <UserPlus className={iconClasses} />;
      case 'unassignment':
        return <UserMinus className={iconClasses} />;
      case 'incident':
        return <AlertTriangle className={iconClasses} />;
      case 'pms_checkout':
      case 'pms_checkin':
        return <RefreshCw className={iconClasses} />;
      case 'comment':
      case 'room_remark':
        return <MessageSquare className={iconClasses} />;
      default:
        return <FileText className={iconClasses} />;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'cleaning_start':
        return '🔄 Début nettoyage';
      case 'cleaning_end':
        return '✅ Chambre propre';
      case 'assignment':
        return 'Assignation';
      case 'unassignment':
        return 'Désassignation';
      case 'incident':
        return '⚠️ Incident';
      case 'pms_checkout':
        return 'PMS · Client sorti';
      case 'pms_checkin':
        return 'PMS · Client arrivé';
      case 'comment':
        return 'Commentaire';
      case 'room_remark':
        return '💬 Remarque';
      default:
        return 'Action';
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'cleaning_start':
        return 'bg-blue-500/10 text-blue-500 border border-blue-200';
      case 'cleaning_end':
        return 'bg-green-500/10 text-green-600 border border-green-200';
      case 'assignment':
        return 'bg-primary/10 text-primary';
      case 'unassignment':
        return 'bg-orange-500/10 text-orange-500';
      case 'incident':
        return 'bg-destructive/10 text-destructive';
      case 'pms_checkout':
        return 'bg-orange-500/10 text-orange-600 border border-orange-200';
      case 'pms_checkin':
        return 'bg-emerald-500/10 text-emerald-600 border border-emerald-200';
      case 'comment':
      case 'room_remark':
        return 'bg-purple-500/10 text-purple-500 border border-purple-200';
      default:
        return 'bg-muted/10 text-muted-foreground';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm:ss', { locale: fr });
    } catch {
      return '--:--:--';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-4xl max-h-[85vh] bg-card border shadow-lg animate-scale-in">
        <CardHeader className="space-y-4 border-b pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Journal des Actions du Jour
              <Badge variant="secondary" className="ml-2">
                {filteredLogs.length} action{filteredLogs.length !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrer par N° chambre..."
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="h-9"
              />
            </div>
            
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Utilisateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                {uniqueUsers.map(user => (
                  <SelectItem key={user} value={user}>{user}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type d'action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                <SelectItem value="cleaning_start">🔄 Début nettoyage</SelectItem>
                <SelectItem value="cleaning_end">✅ Fin nettoyage</SelectItem>
                <SelectItem value="assignment">Assignation</SelectItem>
                <SelectItem value="unassignment">Désassignation</SelectItem>
                <SelectItem value="incident">⚠️ Incident</SelectItem>
                <SelectItem value="comment">Commentaire</SelectItem>
                <SelectItem value="room_remark">💬 Remarque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] w-full">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Aucune action enregistrée aujourd'hui</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Les actions apparaîtront ici au fur et à mesure
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className={`p-2 rounded-full shrink-0 ${getActionColor(log.action_type)}`}>
                      {getActionIcon(log.action_type)}
                    </div>
                    
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {log.description}
                        </p>
                        <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs font-mono">
                            {formatTime(log.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {log.actor_name && (
                          <Badge variant="outline" className="text-xs font-medium">
                            <User className="h-3 w-3 mr-1" />
                            {log.actor_name}
                          </Badge>
                        )}
                        {log.room_number && (
                          <Badge variant="outline" className="text-xs font-medium">
                            <Bed className="h-3 w-3 mr-1" />
                            CH {log.room_number}
                          </Badge>
                        )}
                        <Badge className={`text-xs ${getActionColor(log.action_type)}`}>
                          {getActionLabel(log.action_type)}
                        </Badge>
                      </div>
                      
                      {/* Afficher les détails supplémentaires (remarques, durée, etc.) */}
                      {log.details && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {log.details.remark && (
                            <div className="bg-muted/50 px-2 py-1 rounded mt-1 italic">
                              💬 "{log.details.remark}"
                            </div>
                          )}
                          {log.details.duration && (
                            <span className="text-xs">Durée: {log.details.duration} min</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
