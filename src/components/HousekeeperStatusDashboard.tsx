import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, Wifi, WifiOff, Clock, CheckCircle, AlertCircle, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface HousekeeperStatus {
  id: string;
  name: string;
  email?: string;
  type: 'registered' | 'invited' | 'requested';
  status: 'connected' | 'disconnected' | 'pending' | 'never_connected';
  last_connection?: string;
  access_code?: string;
  invitation_sent_at?: string;
  request_status?: 'pending' | 'approved' | 'rejected';
  rooms_cleaned_today?: number;
  total_rooms_cleaned?: number;
}

interface HousekeeperStatusDashboardProps {
  hotelId: string;
}

export const HousekeeperStatusDashboard: React.FC<HousekeeperStatusDashboardProps> = ({
  hotelId
}) => {
  const [housekeepers, setHousekeepers] = useState<HousekeeperStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (hotelId) {
      fetchHousekeepersStatus();
    }
  }, [hotelId]);

  const fetchHousekeepersStatus = async () => {
    try {
      console.log('Fetching housekeeper status for hotel:', hotelId);
      
      const allHousekeepers: HousekeeperStatus[] = [];

      // 1. Get registered housekeepers with profiles
      const { data: profilesData } = await supabase
        .from('housekeeper_profiles')
        .select(`
          *,
          hotel_access_sessions!inner(
            hotel_id,
            is_active,
            started_at,
            rooms_cleaned_today
          )
        `)
        .eq('hotel_access_sessions.hotel_id', hotelId);

      if (profilesData) {
        profilesData.forEach(profile => {
          const activeSessions = profile.hotel_access_sessions.filter((s: any) => s.is_active);
          const lastSession = profile.hotel_access_sessions
            .sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];

          allHousekeepers.push({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            type: 'registered',
            status: activeSessions.length > 0 ? 'connected' : 'disconnected',
            last_connection: lastSession?.started_at,
            rooms_cleaned_today: lastSession?.rooms_cleaned_today || 0,
            total_rooms_cleaned: profile.total_rooms_cleaned
          });
        });
      }

      // 2. Get invited housekeepers from access codes
      const { data: invitationsData } = await supabase
        .from('housekeeper_access_codes')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .not('invited_name', 'is', null);

      if (invitationsData) {
        invitationsData.forEach(invitation => {
          if (!allHousekeepers.find(hk => hk.access_code === invitation.access_code)) {
            allHousekeepers.push({
              id: invitation.id,
              name: invitation.invited_name,
              email: invitation.invited_email,
              type: 'invited',
              status: invitation.used_at ? 'connected' : 'pending',
              access_code: invitation.access_code,
              invitation_sent_at: invitation.invitation_sent_at,
              last_connection: invitation.used_at
            });
          }
        });
      }

      // 3. Get pending access requests
      const { data: requestsData } = await supabase
        .from('housekeeper_access_requests')
        .select(`
          id,
          status,
          requested_at,
          housekeeper_profile_id
        `)
        .eq('hotel_id', hotelId)
        .eq('status', 'pending');

      // Get housekeeper profiles for requests
      if (requestsData && requestsData.length > 0) {
        const profileIds = requestsData.map(r => r.housekeeper_profile_id);
        const { data: requestProfilesData } = await supabase
          .from('housekeeper_profiles')
          .select('id, name, email')
          .in('id', profileIds);

        requestsData.forEach(request => {
          const profileData = requestProfilesData?.find(p => p.id === request.housekeeper_profile_id);
          if (profileData && !allHousekeepers.find(hk => hk.email === profileData.email)) {
            allHousekeepers.push({
              id: request.id,
              name: profileData.name || 'Nom inconnu',
              email: profileData.email,
              type: 'requested',
              status: 'pending',
              request_status: 'pending'
            });
          }
        });
      }

      setHousekeepers(allHousekeepers);
    } catch (error) {
      console.error('Error fetching housekeepers status:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le statut des femmes de chambre",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHousekeepers = housekeepers.filter(hk =>
    hk.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (hk.email && hk.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (hk.access_code && hk.access_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi className="h-4 w-4 text-green-500" />;
      case 'disconnected': return <WifiOff className="h-4 w-4 text-orange-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (housekeeper: HousekeeperStatus) => {
    if (housekeeper.status === 'connected') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Connectée</Badge>;
    }
    if (housekeeper.status === 'pending') {
      return <Badge variant="secondary">En attente</Badge>;
    }
    if (housekeeper.last_connection) {
      return <Badge variant="outline">
        Déconnectée {formatDistanceToNow(new Date(housekeeper.last_connection), { addSuffix: true, locale: fr })}
      </Badge>;
    }
    return <Badge variant="secondary">Jamais connectée</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'registered': return <UserCheck className="h-4 w-4 text-blue-500" />;
      case 'invited': return <Clock className="h-4 w-4 text-purple-500" />;
      case 'requested': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default: return <Users className="h-4 w-4 text-gray-500" />;
    }
  };

  const stats = {
    total: housekeepers.length,
    connected: housekeepers.filter(hk => hk.status === 'connected').length,
    pending: housekeepers.filter(hk => hk.status === 'pending').length,
    registered: housekeepers.filter(hk => hk.type === 'registered').length
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Statut des femmes de chambre
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchHousekeepersStatus}>
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.connected}</div>
              <div className="text-xs text-muted-foreground">Connectées</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">En attente</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.registered}</div>
              <div className="text-xs text-muted-foreground">Inscrites</div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email ou code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Housekeepers List */}
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-center text-muted-foreground">Chargement...</p>
            ) : filteredHousekeepers.length === 0 ? (
              <p className="text-center text-muted-foreground">
                Aucune femme de chambre trouvée
              </p>
            ) : (
              filteredHousekeepers.map(housekeeper => (
                <div
                  key={housekeeper.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div className="flex items-center space-x-3">
                    {getTypeIcon(housekeeper.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{housekeeper.name}</span>
                        {getStatusIcon(housekeeper.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {housekeeper.email && <span>{housekeeper.email}</span>}
                        {housekeeper.access_code && (
                          <span className="ml-2">• Code: {housekeeper.access_code}</span>
                        )}
                        {housekeeper.rooms_cleaned_today !== undefined && (
                          <span className="ml-2">• {housekeeper.rooms_cleaned_today} chambres aujourd'hui</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {getStatusBadge(housekeeper)}
                    <div className="text-xs text-muted-foreground mt-1">
                      {housekeeper.type === 'registered' && 'Compte enregistré'}
                      {housekeeper.type === 'invited' && 'Invitée'}
                      {housekeeper.type === 'requested' && 'Demande d\'accès'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
