import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserIcon, Plus, Key, Trash2, Clock, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Housekeeper {
  id: string;
  hotel_id: string | null;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface HousekeeperSession {
  id: string;
  user_name: string;
  login_time: string;
  last_activity: string;
  is_active: boolean;
  housekeeper_id?: string;
}

interface RoomProgress {
  total_rooms: number;
  completed_rooms: number;
  in_progress_rooms: number;
  remaining_rooms: number;
}

export const HousekeeperSetup = () => {
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [sessions, setSessions] = useState<HousekeeperSession[]>([]);
  const [roomProgress, setRoomProgress] = useState<Record<string, RoomProgress>>({});
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  
  const { housekeeperNames, setHousekeeperNames } = useHousekeeping();

  useEffect(() => {
    const savedHotelId = localStorage.getItem('selectedHotelId') || localStorage.getItem('hotelId');
    if (savedHotelId) {
      setSelectedHotelId(savedHotelId);
      loadHousekeepers(savedHotelId);
      loadSessions(savedHotelId);
    }
  }, []);

  // Actualiser les données toutes les 30 secondes
  useEffect(() => {
    if (!selectedHotelId) return;

    const interval = setInterval(() => {
      loadSessions(selectedHotelId);
      loadRoomProgress(selectedHotelId);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedHotelId]);

  const loadHousekeepers = async (hotelId: string) => {
    const housekeepersData = await SupabaseService.getHousekeepers(hotelId);
    setHousekeepers(housekeepersData as Housekeeper[]);
    
    const names = housekeepersData.filter(h => h.is_active).map(h => h.name);
    setHousekeeperNames(names);
  };

  const loadSessions = async (hotelId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('user_type', 'housekeeper')
        .order('last_activity', { ascending: false });

      if (error) {
        console.error('Erreur chargement sessions:', error);
        return;
      }

      setSessions(data as HousekeeperSession[]);
    } catch (error) {
      console.error('Erreur sessions:', error);
    }
  };

  const loadRoomProgress = async (hotelId: string) => {
    try {
      // Récupérer les mises à jour de statut des chambres pour calculer le progrès
      const { data, error } = await supabase
        .from('room_status_updates')
        .select('housekeeper_id, room_number, status, created_at')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement progrès:', error);
        return;
      }

      // Calculer le progrès par femme de chambre
      const progressByHousekeeper: Record<string, RoomProgress> = {};

      // Grouper par femme de chambre et chambre pour obtenir le dernier statut
      const latestStatusByRoom: Record<string, any> = {};
      
      data?.forEach(update => {
        const key = `${update.housekeeper_id}-${update.room_number}`;
        if (!latestStatusByRoom[key] || 
            new Date(update.created_at) > new Date(latestStatusByRoom[key].created_at)) {
          latestStatusByRoom[key] = update;
        }
      });

      // Calculer les statistiques par femme de chambre
      Object.values(latestStatusByRoom).forEach((update: any) => {
        const housekeeper_id = update.housekeeper_id;
        if (!progressByHousekeeper[housekeeper_id]) {
          progressByHousekeeper[housekeeper_id] = {
            total_rooms: 0,
            completed_rooms: 0,
            in_progress_rooms: 0,
            remaining_rooms: 0
          };
        }

        progressByHousekeeper[housekeeper_id].total_rooms++;

        if (update.status === 'clean' || update.status === 'completed') {
          progressByHousekeeper[housekeeper_id].completed_rooms++;
        } else if (update.status === 'in-progress' || update.status === 'cleaning') {
          progressByHousekeeper[housekeeper_id].in_progress_rooms++;
        } else {
          progressByHousekeeper[housekeeper_id].remaining_rooms++;
        }
      });

      setRoomProgress(progressByHousekeeper);
    } catch (error) {
      console.error('Erreur calcul progrès:', error);
    }
  };

  const handleCreateHousekeeper = async () => {
    if (!newHousekeeperName.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir un nom"
      });
      return;
    }

    if (!selectedHotelId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez d'abord sélectionner un hôtel"
      });
      return;
    }

    setIsLoading(true);
    const housekeeper = await SupabaseService.createHousekeeper(selectedHotelId, newHousekeeperName);
    
    if (housekeeper) {
      toast({
        title: "Femme de chambre créée",
        description: `"${newHousekeeperName}" a été créée avec le code ${housekeeper.access_code}`
      });
      setNewHousekeeperName('');
      await loadHousekeepers(selectedHotelId);
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la femme de chambre"
      });
    }
    setIsLoading(false);
  };

  const handleDeactivateHousekeeper = async (id: string, name: string) => {
    const success = await SupabaseService.deactivateHousekeeper(id);
    
    if (success) {
      toast({
        title: "Femme de chambre désactivée",
        description: `"${name}" a été désactivée`
      });
      await loadHousekeepers(selectedHotelId);
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de désactiver la femme de chambre"
      });
    }
  };

  const getSessionForHousekeeper = (housekeeperName: string) => {
    return sessions.find(session => 
      session.user_name === housekeeperName && session.is_active
    );
  };

  const getProgressForHousekeeper = (housekeeperId: string): RoomProgress => {
    return roomProgress[housekeeperId] || {
      total_rooms: 0,
      completed_rooms: 0,
      in_progress_rooms: 0,
      remaining_rooms: 0
    };
  };

  const getProgressPercentage = (progress: RoomProgress): number => {
    if (progress.total_rooms === 0) return 0;
    return Math.round((progress.completed_rooms / progress.total_rooms) * 100);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: fr });
    } catch {
      return 'Inconnu';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm', { locale: fr });
    } catch {
      return 'N/A';
    }
  };

  if (!selectedHotelId) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <UserIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Hôtel requis</h3>
          <p className="text-muted-foreground">
            Veuillez d'abord configurer un hôtel pour gérer les femmes de chambre
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulaire d'ajout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Ajouter une Femme de Chambre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="housekeeper-name">Nom et prénom</Label>
              <Input
                id="housekeeper-name"
                placeholder="Ex: Marie Dupont"
                value={newHousekeeperName}
                onChange={(e) => setNewHousekeeperName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateHousekeeper()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleCreateHousekeeper}
                disabled={isLoading || !newHousekeeperName.trim()}
                className="hover-scale"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isLoading ? 'Création...' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des femmes de chambre */}
      {housekeepers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Femmes de chambre ({housekeepers.filter(h => h.is_active).length} actives)
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadSessions(selectedHotelId);
                  loadRoomProgress(selectedHotelId);
                }}
                className="hover-scale"
              >
                <Activity className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Code d'accès</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Connexion</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead>Progrès</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {housekeepers.map((housekeeper) => {
                    const session = getSessionForHousekeeper(housekeeper.name);
                    const progress = getProgressForHousekeeper(housekeeper.id);
                    const progressPercentage = getProgressPercentage(progress);
                    
                    return (
                      <TableRow key={housekeeper.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                            {housekeeper.name}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1 font-mono text-sm">
                            <Key className="h-3 w-3 text-muted-foreground" />
                            {housekeeper.access_code}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={housekeeper.is_active ? "secondary" : "outline"}>
                              {housekeeper.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {session?.is_active && (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                                En ligne
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {session ? (
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {formatTime(session.login_time)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Non connecté</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          {session ? (
                            <span className="text-sm text-muted-foreground">
                              {formatTimeAgo(session.last_activity)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          {progress.total_rooms > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{progressPercentage}%</span>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  {progress.completed_rooms}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-yellow-500" />
                                  {progress.in_progress_rooms}
                                </span>
                                <span className="flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 text-gray-400" />
                                  {progress.remaining_rooms}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Aucune tâche</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          {housekeeper.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeactivateHousekeeper(housekeeper.id, housekeeper.name)}
                              className="hover-scale"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {housekeepers.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <UserIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune femme de chambre</h3>
            <p className="text-muted-foreground">
              Ajoutez des femmes de chambre pour commencer à gérer les tâches de nettoyage
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};