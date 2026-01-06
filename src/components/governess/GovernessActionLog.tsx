import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Clock, Loader2, RefreshCw, User, Home, Check, Play, 
  MessageSquare, Eye, AlertTriangle, Trash2
} from 'lucide-react';

interface GovernessActionLogProps {
  hotelId: string;
}

interface ActionLog {
  id: string;
  action_type: string;
  description: string;
  room_number: string | null;
  actor_name: string | null;
  actor_type: string | null;
  created_at: string;
  details: Record<string, any> | null;
}

const actionIcons: Record<string, React.ComponentType<any>> = {
  'cleaning-start': Play,
  'cleaning-end': Check,
  'room-status': Home,
  'assignment': User,
  'unassignment': Trash2,
  'note-update': MessageSquare,
  'room-inspection': Eye,
  'remark': AlertTriangle
};

const actionColors: Record<string, string> = {
  'cleaning-start': 'bg-blue-100 text-blue-700',
  'cleaning-end': 'bg-green-100 text-green-700',
  'room-status': 'bg-purple-100 text-purple-700',
  'assignment': 'bg-amber-100 text-amber-700',
  'unassignment': 'bg-orange-100 text-orange-700',
  'note-update': 'bg-pink-100 text-pink-700',
  'room-inspection': 'bg-emerald-100 text-emerald-700',
  'remark': 'bg-red-100 text-red-700'
};

export const GovernessActionLog: React.FC<GovernessActionLogProps> = ({ hotelId }) => {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_action_logs')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('log_date', today)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Cast details properly
      const typedLogs: ActionLog[] = (data || []).map(log => ({
        ...log,
        details: log.details as Record<string, any> | null
      }));
      
      setLogs(typedLogs);

    } catch (error) {
      console.error('Erreur chargement logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useRealtimeSync({
    hotelId,
    tables: ['daily_action_logs'],
    onUpdate: loadLogs
  });

  const getActionLabel = (type: string): string => {
    switch (type) {
      case 'cleaning-start': return 'Début nettoyage';
      case 'cleaning-end': return 'Fin nettoyage';
      case 'room-status': return 'Statut chambre';
      case 'assignment': return 'Assignation';
      case 'unassignment': return 'Désassignation';
      case 'note-update': return 'Commentaire';
      case 'room-inspection': return 'Inspection';
      case 'remark': return 'Remarque';
      default: return type;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm', { locale: fr });
    } catch {
      return '--:--';
    }
  };

  // Grouper par heure
  const groupedLogs = logs.reduce((acc, log) => {
    const hour = format(new Date(log.created_at), 'HH:00', { locale: fr });
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(log);
    return acc;
  }, {} as Record<string, ActionLog[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Journal du jour</h3>
          <Badge variant="outline">{logs.length} action(s)</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {logs.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Aucune activité</h3>
          <p className="text-muted-foreground">
            Les actions des femmes de chambre apparaîtront ici
          </p>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-6 pr-4">
            {Object.entries(groupedLogs).map(([hour, hourLogs]) => (
              <div key={hour} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-muted px-2 py-1 rounded text-xs font-medium">
                    {hour}
                  </div>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-2 ml-4">
                  {hourLogs.map(log => {
                    const Icon = actionIcons[log.action_type] || Clock;
                    const colorClass = actionColors[log.action_type] || 'bg-gray-100 text-gray-700';

                    return (
                      <Card key={log.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${colorClass}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-sm truncate">
                                  {log.description}
                                </p>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatTime(log.created_at)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {getActionLabel(log.action_type)}
                                </Badge>
                                
                                {log.actor_name && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <User className="h-3 w-3" />
                                    {log.actor_name}
                                  </Badge>
                                )}
                                
                                {log.room_number && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Home className="h-3 w-3" />
                                    {log.room_number}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
