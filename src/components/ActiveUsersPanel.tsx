import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Wifi, Bed, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useHousekeeping } from '@/contexts/HousekeepingContext';

interface ActiveSession {
  id: string;
  user_name: string;
  user_type: string;
  login_time: string;
  last_activity: string;
  is_active: boolean;
  hotel_id?: string;
}

interface HousekeeperConnection {
  name: string;
  accessCode: string;
  loginTime: Date;
  rooms: string[];
  isOnline: boolean;
}

export function ActiveUsersPanel() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [housekeeperConnections, setHousekeeperConnections] = useState<HousekeeperConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const { housekeeperNames, housekeepers, getHousekeeperRooms } = useHousekeeping();

  useEffect(() => {
    fetchActiveSessions();
    updateHousekeeperConnections();
    
    // Set up real-time subscription for sessions
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
    const activityInterval = setInterval(() => {
      updateActivity();
      updateHousekeeperConnections();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(activityInterval);
    };
  }, [housekeeperNames, housekeepers]);

  const updateHousekeeperConnections = () => {
    // Éliminer les doublons dans les noms de femmes de chambre
    const uniqueHousekeeperNames = [...new Set(housekeeperNames)].filter(name => name && name.trim());
    
    const connections: HousekeeperConnection[] = uniqueHousekeeperNames.map((name, index) => {
      const housekeeper = housekeepers.find(h => h.name === name);
      const accessCode = housekeeper?.access_code || '';
      const rooms = getHousekeeperRooms(name).map(room => room.number);
      
      // Vérifier s'il y a une session active pour cette femme de chambre
      const activeSession = sessions.find(s => 
        s.user_name === name && s.user_type === 'housekeeper' && s.is_active
      );
      
      return {
        name,
        accessCode,
        loginTime: activeSession ? new Date(activeSession.login_time) : new Date(),
        rooms,
        isOnline: !!activeSession
      };
    });
    
    setHousekeeperConnections(connections);
  };

  const fetchActiveSessions = async () => {
    try {
      // Récupérer seulement les sessions de l'hôtel actuel
      const hotelId = storageService.getHotelId();
      if (!hotelId) {
        setSessions([]);
        return;
      }

      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .eq('hotel_id', hotelId)
        .order('last_activity', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        setSessions([]);
        return;
      }

      setSessions(data || []);
    } catch (error) {
      console.error('Error in fetchActiveSessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const updateActivity = async () => {
    try {
      const currentUser = localStorage.getItem('userEmail');
      if (currentUser) {
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('user_name', currentUser)
          .eq('is_active', true);
      }
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { 
        addSuffix: true, 
        locale: fr 
      });
    } catch (error) {
      return 'Temps inconnu';
    }
  };

  const adminSessions = sessions.filter(s => s.user_type === 'admin');
  const housekeeperSessions = sessions.filter(s => s.user_type === 'housekeeper');

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Chargement...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Panel Administrateurs */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Administrateurs connectés ({adminSessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {adminSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun administrateur connecté
              </p>
            ) : (
              adminSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium">{session.user_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getTimeAgo(session.last_activity)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panel Femmes de chambre */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Femmes de chambre ({housekeeperConnections.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {housekeeperConnections.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune femme de chambre configurée
              </p>
            ) : (
              housekeeperConnections.map((connection, index) => (
                <div
                  key={`${connection.name}-${index}`}
                  className="p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        connection.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                      }`} />
                      <span className="font-medium">{connection.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Bed className="h-3 w-3 mr-1" />
                      {connection.rooms.length}
                    </Badge>
                  </div>
                  
                  {connection.isOnline && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      Connectée {getTimeAgo(connection.loginTime.toISOString())}
                    </div>
                  )}
                  
                  {connection.rooms.length > 0 && (
                    <div className="mt-2 text-xs">
                      <span className="text-muted-foreground">Chambres assignées: </span>
                      <span className="font-mono">{connection.rooms.join(', ')}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}