import { useEffect } from 'react';
import { useHotelCore } from '@/hooks/useHotelCore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Users, Home, Activity, Upload, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const {
    hotel,
    rooms,
    assignments,
    activities,
    housekeepers,
    loading,
    error,
    createRooms,
    assignRooms,
    autoAssignRooms,
    updateRoomStatus,
    updateAssignmentStatus,
    processRoomData
  } = useHotelCore();

  const [newRoomNumbers, setNewRoomNumbers] = useState('');
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Chargement de votre hôtel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = {
    totalRooms: rooms.length,
    roomsToClean: rooms.filter(r => r.status === 'occupied' || r.status === 'cleaning').length,
    activeAssignments: assignments.filter(a => a.status !== 'completed').length,
    completedToday: assignments.filter(a => 
      a.status === 'completed' && 
      new Date(a.completed_at || '').toDateString() === new Date().toDateString()
    ).length
  };

  const handleCreateRooms = async () => {
    if (!newRoomNumbers.trim()) return;
    
    const roomNumbers = newRoomNumbers
      .split(',')
      .map(num => num.trim())
      .filter(num => num.length > 0);
    
    try {
      await createRooms(roomNumbers);
      setNewRoomNumbers('');
      toast({ title: 'Chambres créées', description: `${roomNumbers.length} chambres ajoutées` });
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de créer les chambres', variant: 'destructive' });
    }
  };

  const handleAutoAssign = async () => {
    if (housekeepers.length === 0) {
      toast({ title: 'Aucune femme de chambre', description: 'Ajoutez au moins une femme de chambre', variant: 'destructive' });
      return;
    }

    try {
      await autoAssignRooms(housekeepers);
      toast({ title: 'Attribution automatique', description: 'Chambres attribuées avec succès' });
    } catch (error) {
      toast({ title: 'Erreur', description: 'Échec de l\'attribution automatique', variant: 'destructive' });
    }
  };

  const handleManualAssign = async () => {
    if (selectedRooms.length === 0 || !newHousekeeperName.trim()) return;

    const assignments = selectedRooms.map(roomId => ({
      roomId,
      housekeeperName: newHousekeeperName.trim()
    }));

    try {
      await assignRooms(assignments);
      setSelectedRooms([]);
      setNewHousekeeperName('');
      toast({ title: 'Attribution manuelle', description: `${assignments.length} chambres attribuées` });
    } catch (error) {
      toast({ title: 'Erreur', description: 'Échec de l\'attribution manuelle', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success';
      case 'occupied': return 'bg-warning';
      case 'cleaning': return 'bg-primary';
      case 'maintenance': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Disponible';
      case 'occupied': return 'Occupée';
      case 'cleaning': return 'Nettoyage';
      case 'maintenance': return 'Maintenance';
      case 'out_of_order': return 'Hors service';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Admin</h1>
          <p className="text-muted-foreground">{hotel?.name}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chambres totales</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRooms}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À nettoyer</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.roomsToClean}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En cours</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAssignments}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminées aujourd'hui</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedToday}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="rooms">Gestion chambres</TabsTrigger>
          <TabsTrigger value="team">Équipe</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assignments in progress */}
            <Card>
              <CardHeader>
                <CardTitle>Attributions en cours</CardTitle>
                <CardDescription>Suivi en temps réel des nettoyages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignments.filter(a => a.status !== 'completed').map(assignment => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Chambre {assignment.room?.room_number}</p>
                      <p className="text-sm text-muted-foreground">{assignment.housekeeper_name}</p>
                    </div>
                    <Badge variant={assignment.status === 'in_progress' ? 'default' : 'secondary'}>
                      {assignment.status === 'assigned' ? 'Attribuée' : 
                       assignment.status === 'in_progress' ? 'En cours' : assignment.status}
                    </Badge>
                  </div>
                ))}
                {assignments.filter(a => a.status !== 'completed').length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Aucune attribution en cours</p>
                )}
              </CardContent>
            </Card>

            {/* Recent activities */}
            <Card>
              <CardHeader>
                <CardTitle>Activités récentes</CardTitle>
                <CardDescription>Historique des actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activities.slice(0, 5).map(activity => (
                  <div key={activity.id} className="flex items-center space-x-3 text-sm">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p>{activity.actor_name || 'Système'}</p>
                      <p className="text-muted-foreground">{activity.activity_type}</p>
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <div className="flex gap-4 mb-6">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Home className="h-4 w-4 mr-2" />
                  Ajouter chambres
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter des chambres</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Numéros de chambre (séparés par des virgules)</label>
                    <Input
                      placeholder="101, 102, 103..."
                      value={newRoomNumbers}
                      onChange={(e) => setNewRoomNumbers(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCreateRooms} className="w-full">
                    Créer les chambres
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button onClick={handleAutoAssign} disabled={housekeepers.length === 0}>
              <Play className="h-4 w-4 mr-2" />
              Attribution automatique
            </Button>
          </div>

          {/* Rooms grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rooms.map(room => (
              <Card 
                key={room.id}
                className={`cursor-pointer transition-colors ${
                  selectedRooms.includes(room.id) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => {
                  setSelectedRooms(prev => 
                    prev.includes(room.id) 
                      ? prev.filter(id => id !== room.id)
                      : [...prev, room.id]
                  );
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Chambre {room.room_number}</CardTitle>
                    <Badge className={getStatusColor(room.status)}>
                      {getStatusLabel(room.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p>Priorité: {room.cleaning_priority}/4</p>
                    <p>Temps estimé: {room.estimated_time}min</p>
                    {room.last_cleaned_at && (
                      <p className="text-muted-foreground">
                        Nettoyé: {new Date(room.last_cleaned_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Manual assignment */}
          {selectedRooms.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Attribution manuelle</CardTitle>
                <CardDescription>{selectedRooms.length} chambre(s) sélectionnée(s)</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Input
                  placeholder="Nom de la femme de chambre"
                  value={newHousekeeperName}
                  onChange={(e) => setNewHousekeeperName(e.target.value)}
                />
                <Button onClick={handleManualAssign}>
                  Attribuer
                </Button>
                <Button variant="outline" onClick={() => setSelectedRooms([])}>
                  Annuler
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Équipe de nettoyage</CardTitle>
              <CardDescription>Gestion des femmes de chambre</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {housekeepers.map(housekeeper => {
                  const housekeeperAssignments = assignments.filter(
                    a => a.housekeeper_name === housekeeper && a.status !== 'completed'
                  );
                  
                  return (
                    <div key={housekeeper} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{housekeeper}</p>
                        <p className="text-sm text-muted-foreground">
                          {housekeeperAssignments.length} attribution(s) active(s)
                        </p>
                      </div>
                      <Badge variant="outline">
                        {housekeeperAssignments.length} tâches
                      </Badge>
                    </div>
                  );
                })}
                
                {housekeepers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune femme de chambre. Attribuez des chambres pour commencer.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}