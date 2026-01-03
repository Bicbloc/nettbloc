import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Monitor, Search, LogOut, Eye, Trash2, Filter, 
  Clock, User, MapPin, RefreshCw 
} from 'lucide-react';

interface SessionDetails {
  id: string;
  user_id?: string;
  user_name: string;
  user_email?: string;
  user_type: string;
  hotel_id?: string;
  hotel_name?: string;
  login_time: string;
  last_activity: string;
  is_active: boolean;
  session_token?: string;
  housekeeper_id?: string;
}

export function SessionsManagementPanel() {
  const [sessions, setSessions] = useState<SessionDetails[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'admin' | 'housekeeper'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSession, setSelectedSession] = useState<SessionDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSessions();
    
    // Real-time subscription
    const channel = supabase
      .channel('admin-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sessions'
        },
        () => {
          loadSessions();
        }
      )
      .subscribe();

    // Auto-refresh every minute
    const interval = setInterval(loadSessions, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [sessions, searchTerm, filterType, filterStatus]);

  const loadSessions = async () => {
    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .order('last_activity', { ascending: false })
        .limit(500);

      if (sessionsError) throw sessionsError;

      // Enrichir avec les noms d'hôtels et emails
      const enrichedSessions = await Promise.all(
        (sessionsData || []).map(async (session) => {
          let hotelName = 'N/A';
          let userEmail = '';

          // Récupérer le nom de l'hôtel
          if (session.hotel_id) {
            const { data: hotelData } = await supabase
              .from('hotels')
              .select('name')
              .eq('id', session.hotel_id)
              .single();
            
            if (hotelData) {
              hotelName = hotelData.name;
            }
          }

          // Récupérer l'email de l'utilisateur si c'est un admin
          if (session.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', session.user_id)
              .single();
            
            if (profileData) {
              userEmail = profileData.email;
            }
          }

          return {
            ...session,
            hotel_name: hotelName,
            user_email: userEmail
          };
        })
      );

      setSessions(enrichedSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les sessions."
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...sessions];

    // Filter by search term (inclut email)
    if (searchTerm) {
      filtered = filtered.filter(session =>
        session.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.hotel_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by user type
    if (filterType !== 'all') {
      filtered = filtered.filter(session => session.user_type === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(session => 
        filterStatus === 'active' ? session.is_active : !session.is_active
      );
    }

    setFilteredSessions(filtered);
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          last_activity: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action: 'terminate_session',
        p_details: { session_id: sessionId }
      });

      toast({
        title: "Session terminée",
        description: "La session a été terminée avec succès."
      });

      loadSessions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de terminer la session: ${error.message}`
      });
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action: 'delete_session',
        p_details: { session_id: sessionId }
      });

      toast({
        title: "Session supprimée",
        description: "La session a été supprimée avec succès."
      });

      loadSessions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de supprimer la session: ${error.message}`
      });
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

  const getSessionDuration = (loginTime: string, lastActivity: string) => {
    try {
      const start = new Date(loginTime);
      const end = new Date(lastActivity);
      const diff = end.getTime() - start.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}min`;
    } catch (error) {
      return 'N/A';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Gestion des Sessions
            </CardTitle>
            <CardDescription>
              {filteredSessions.length} session(s) • {sessions.filter(s => s.is_active).length} active(s)
            </CardDescription>
          </div>
          <Button onClick={loadSessions} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, hôtel ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="admin">Administrateurs</SelectItem>
              <SelectItem value="housekeeper">Femmes de chambre</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actives</SelectItem>
              <SelectItem value="inactive">Inactives</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sessions Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Hôtel</TableHead>
                <TableHead>Connexion</TableHead>
                <TableHead>Dernière activité</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Aucune session trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {session.user_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {session.user_email || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.user_type === 'admin' ? 'default' : 'secondary'}>
                        {session.user_type === 'admin' ? 'Admin' : 'Femme de chambre'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {session.hotel_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(session.login_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeAgo(session.last_activity)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getSessionDuration(session.login_time, session.last_activity)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={session.is_active ? 'default' : 'outline'}
                        className={session.is_active ? 'bg-green-500' : ''}
                      >
                        {session.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSession(session);
                            setShowDetails(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {session.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => terminateSession(session.id)}
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        )}
                        {!session.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSession(session.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Session Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la session</DialogTitle>
            <DialogDescription>
              Informations complètes sur cette session utilisateur
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">ID de session</Label>
                  <p className="text-sm font-mono mt-1">{selectedSession.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Utilisateur</Label>
                  <p className="text-sm mt-1">{selectedSession.user_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="text-sm mt-1">{selectedSession.user_email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                  <Badge variant={selectedSession.user_type === 'admin' ? 'default' : 'secondary'} className="mt-1">
                    {selectedSession.user_type === 'admin' ? 'Administrateur' : 'Femme de chambre'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Statut</Label>
                  <Badge 
                    variant={selectedSession.is_active ? 'default' : 'outline'}
                    className={`mt-1 ${selectedSession.is_active ? 'bg-green-500' : ''}`}
                  >
                    {selectedSession.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Hôtel</Label>
                  <p className="text-sm mt-1">{selectedSession.hotel_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">ID Hôtel</Label>
                  <p className="text-sm font-mono mt-1">{selectedSession.hotel_id || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Heure de connexion</Label>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedSession.login_time), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Dernière activité</Label>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedSession.last_activity), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Durée de session</Label>
                  <p className="text-sm mt-1">
                    {getSessionDuration(selectedSession.login_time, selectedSession.last_activity)}
                  </p>
                </div>
                {selectedSession.session_token && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Token</Label>
                    <p className="text-sm font-mono mt-1 truncate">{selectedSession.session_token}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedSession?.is_active && (
              <Button
                variant="destructive"
                onClick={() => {
                  terminateSession(selectedSession.id);
                  setShowDetails(false);
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Terminer la session
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}