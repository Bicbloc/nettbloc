import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, RefreshCw, Eye, Calendar, Filter, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SessionHistory {
  id: string;
  user_name: string;
  user_type: string;
  hotel_id: string;
  hotel_name?: string;
  login_time: string;
  last_activity: string;
  is_active: boolean;
  session_token?: string;
}

interface ActivityLog {
  id: string;
  activity_type: string;
  entity_type: string;
  actor_name: string;
  timestamp: string;
  details: any;
}

export function SessionHistoryPanel() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionHistory[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionHistory | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [sessionToReactivate, setSessionToReactivate] = useState<SessionHistory | null>(null);
  const [reactivateDuration, setReactivateDuration] = useState<number>(24);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [sessions, statusFilter, userTypeFilter, dateFilter, searchQuery]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      // Charger toutes les sessions (actives + archivées)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .order('last_activity', { ascending: false })
        .limit(500);

      if (sessionsError) throw sessionsError;

      // Enrichir avec les noms d'hôtels
      const enrichedSessions = await Promise.all(
        (sessionsData || []).map(async (session) => {
          if (session.hotel_id) {
            const { data: hotelData } = await supabase
              .from('hotels')
              .select('name')
              .eq('id', session.hotel_id)
              .single();

            return {
              ...session,
              hotel_name: hotelData?.name || 'Hôtel inconnu',
            };
          }
          return { ...session, hotel_name: 'Aucun hôtel' };
        })
      );

      setSessions(enrichedSessions);
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger l\'historique des sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...sessions];

    // Filtre par statut
    if (statusFilter === 'active') {
      filtered = filtered.filter((s) => s.is_active);
    } else if (statusFilter === 'expired') {
      filtered = filtered.filter((s) => !s.is_active);
    }

    // Filtre par type d'utilisateur
    if (userTypeFilter !== 'all') {
      filtered = filtered.filter((s) => s.user_type === userTypeFilter);
    }

    // Filtre par date
    if (dateFilter) {
      filtered = filtered.filter((s) => {
        const sessionDate = format(new Date(s.login_time), 'yyyy-MM-dd');
        return sessionDate === dateFilter;
      });
    }

    // Recherche textuelle
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.user_name.toLowerCase().includes(query) ||
          s.hotel_name?.toLowerCase().includes(query)
      );
    }

    setFilteredSessions(filtered);
  };

  const loadActivityLogs = async (hotelId: string, sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Erreur chargement logs:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les logs d\'activité',
        variant: 'destructive',
      });
    }
  };

  const handleReactivateSession = async () => {
    if (!sessionToReactivate) return;

    try {
      const newExpiryDate = new Date();
      newExpiryDate.setHours(newExpiryDate.getHours() + reactivateDuration);

      const { error } = await supabase
        .from('user_sessions')
        .update({
          is_active: true,
          last_activity: new Date().toISOString(),
        })
        .eq('id', sessionToReactivate.id);

      if (error) throw error;

      // Log l'action
      await supabase.rpc('log_admin_action', {
        p_action: 'reactivate_session',
        p_target_user_id: null,
        p_details: {
          session_id: sessionToReactivate.id,
          user_name: sessionToReactivate.user_name,
          duration_hours: reactivateDuration,
        },
      });

      toast({
        title: '✅ Session réactivée',
        description: `La session de ${sessionToReactivate.user_name} a été réactivée pour ${reactivateDuration}h`,
      });

      setReactivateDialogOpen(false);
      setSessionToReactivate(null);
      loadSessions();
    } catch (error) {
      console.error('Erreur réactivation session:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de réactiver la session',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (session: SessionHistory) => {
    if (session.is_active) {
      return <Badge className="bg-green-500">Active</Badge>;
    }
    return <Badge variant="secondary">Expirée</Badge>;
  };

  const getUserTypeBadge = (type: string) => {
    if (type === 'admin') {
      return <Badge variant="default">Admin</Badge>;
    }
    return <Badge variant="outline">Femme de chambre</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Historique des Sessions
            </CardTitle>
            <CardDescription>
              Consultez et réactivez les sessions expirées
            </CardDescription>
          </div>
          <Button onClick={loadSessions} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtres */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Statut</Label>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="active">Actives</SelectItem>
                <SelectItem value="expired">Expirées</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Type d'utilisateur</Label>
            <Select value={userTypeFilter} onValueChange={(v: any) => setUserTypeFilter(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="housekeeper">Femme de chambre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div>
            <Label>Recherche</Label>
            <Input
              placeholder="Nom, hôtel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {sessions.filter((s) => s.is_active).length}
              </div>
              <p className="text-sm text-muted-foreground">Sessions actives</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-600">
                {sessions.filter((s) => !s.is_active).length}
              </div>
              <p className="text-sm text-muted-foreground">Sessions expirées</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {sessions.length}
              </div>
              <p className="text-sm text-muted-foreground">Total sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Table des sessions */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Chargement...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune session trouvée
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Hôtel</TableHead>
                  <TableHead>Connexion</TableHead>
                  <TableHead>Dernière activité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      {session.user_name}
                    </TableCell>
                    <TableCell>{getUserTypeBadge(session.user_type)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {session.hotel_name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(session.login_time), 'dd/MM/yyyy HH:mm', {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(session.last_activity), 'dd/MM/yyyy HH:mm', {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell>{getStatusBadge(session)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSession(session);
                              if (session.hotel_id) {
                                loadActivityLogs(session.hotel_id, session.id);
                              }
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Logs d'activité - {selectedSession?.user_name}
                            </DialogTitle>
                            <DialogDescription>
                              Historique des actions effectuées pendant cette session
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-2">
                            {activityLogs.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                Aucun log disponible
                              </p>
                            ) : (
                              activityLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="border rounded p-3 text-sm space-y-1"
                                >
                                  <div className="flex justify-between">
                                    <Badge variant="outline">{log.activity_type}</Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm', {
                                        locale: fr,
                                      })}
                                    </span>
                                  </div>
                                  <p className="font-medium">{log.actor_name}</p>
                                  <p className="text-muted-foreground">
                                    {log.entity_type}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      {!session.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSessionToReactivate(session);
                            setReactivateDialogOpen(true);
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog de réactivation */}
      <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réactiver la session</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Souhaitez-vous réactiver la session de{' '}
                <strong>{sessionToReactivate?.user_name}</strong> ?
              </p>
              <div className="space-y-2">
                <Label>Durée de réactivation (heures)</Label>
                <Select
                  value={reactivateDuration.toString()}
                  onValueChange={(v) => setReactivateDuration(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 heure</SelectItem>
                    <SelectItem value="4">4 heures</SelectItem>
                    <SelectItem value="8">8 heures</SelectItem>
                    <SelectItem value="24">24 heures</SelectItem>
                    <SelectItem value="72">3 jours</SelectItem>
                    <SelectItem value="168">7 jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivateSession}>
              Réactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
