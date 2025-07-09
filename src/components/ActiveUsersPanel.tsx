import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActiveSession {
  id: string;
  user_name: string;
  user_type: string;
  login_time: string;
  last_activity: string;
  is_active: boolean;
}

export function ActiveUsersPanel() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveSessions();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('active-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sessions'
        },
        () => {
          fetchActiveSessions();
        }
      )
      .subscribe();

    // Update activity every 30 seconds
    const activityInterval = setInterval(updateActivity, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(activityInterval);
    };
  }, []);

  const fetchActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .order('login_time', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateActivity = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_active', true);
      }
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const getStatusColor = (lastActivity: string) => {
    const diff = Date.now() - new Date(lastActivity).getTime();
    const minutes = diff / (1000 * 60);
    
    if (minutes < 5) return 'bg-green-500';
    if (minutes < 15) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getActivityText = (lastActivity: string) => {
    const diff = Date.now() - new Date(lastActivity).getTime();
    const minutes = diff / (1000 * 60);
    
    if (minutes < 1) return 'En ligne maintenant';
    return `Actif il y a ${Math.round(minutes)} min`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Utilisateurs connectés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Utilisateurs connectés ({sessions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">
            Aucun utilisateur connecté
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className={`w-3 h-3 rounded-full ${getStatusColor(session.last_activity)}`}
                  />
                  {getStatusColor(session.last_activity) === 'bg-green-500' && (
                    <div className="absolute -top-0.5 -right-0.5">
                      <Wifi className="h-2 w-2 text-green-500" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium">{session.user_name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Connecté {formatDistanceToNow(new Date(session.login_time), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge 
                  variant={session.user_type === 'admin' ? 'default' : 'secondary'}
                >
                  {session.user_type === 'admin' ? 'Admin' : 'Femme de chambre'}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {getActivityText(session.last_activity)}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}