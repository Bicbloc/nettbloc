import { useState, useEffect } from 'react';
import { useHotelCore } from '@/hooks/useHotelCore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, Clock, Home, LogOut, Play, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Assignment } from '@/services/HotelCoreEngine';

export default function HousekeeperMobile() {
  const {
    hotel,
    getHousekeeperAssignments,
    updateAssignmentStatus,
    updateRoomStatus
  } = useHotelCore();

  const [housekeeperName, setHousekeeperName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // Check if housekeeper is already logged in
    const savedName = localStorage.getItem('housekeeper_name');
    if (savedName) {
      setHousekeeperName(savedName);
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && housekeeperName) {
      // Load assignments for this housekeeper
      const housekeeperAssignments = getHousekeeperAssignments(housekeeperName);
      setAssignments(housekeeperAssignments);
    }
  }, [isLoggedIn, housekeeperName, getHousekeeperAssignments]);

  const handleLogin = () => {
    if (!housekeeperName.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez entrer votre nom', variant: 'destructive' });
      return;
    }

    localStorage.setItem('housekeeper_name', housekeeperName.trim());
    setIsLoggedIn(true);
    toast({ title: 'Connexion réussie', description: `Bonjour ${housekeeperName}!` });
  };

  const handleLogout = () => {
    localStorage.removeItem('housekeeper_name');
    setIsLoggedIn(false);
    setHousekeeperName('');
    setAssignments([]);
  };

  const handleStartCleaning = async (assignment: Assignment) => {
    try {
      await updateAssignmentStatus(assignment.id, 'in_progress', housekeeperName);
      toast({ title: 'Nettoyage commencé', description: `Chambre ${assignment.room?.room_number}` });
      
      // Refresh assignments
      const updated = getHousekeeperAssignments(housekeeperName);
      setAssignments(updated);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de commencer le nettoyage', variant: 'destructive' });
    }
  };

  const handleCompleteCleaning = async (assignment: Assignment, notes?: string) => {
    try {
      await updateAssignmentStatus(assignment.id, 'completed', housekeeperName, notes);
      toast({ title: 'Nettoyage terminé', description: `Chambre ${assignment.room?.room_number}` });
      
      // Refresh assignments
      const updated = getHousekeeperAssignments(housekeeperName);
      setAssignments(updated);
      setSelectedAssignment(null);
      setNotes('');
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de terminer le nettoyage', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-secondary';
      case 'in_progress': return 'bg-primary';
      case 'completed': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned': return 'Attribuée';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminée';
      default: return status;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Connexion</CardTitle>
            <CardDescription>Entrez votre nom pour accéder à vos tâches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input
                placeholder="Votre nom"
                value={housekeeperName}
                onChange={(e) => setHousekeeperName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full">
              <User className="h-4 w-4 mr-2" />
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Mes tâches</h1>
            <p className="text-sm opacity-90">Bonjour {housekeeperName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 bg-muted/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{assignments.length}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">
              {assignments.filter(a => a.status === 'in_progress').length}
            </p>
            <p className="text-sm text-muted-foreground">En cours</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-success">
              {assignments.filter(a => a.status === 'completed').length}
            </p>
            <p className="text-sm text-muted-foreground">Terminées</p>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="p-4 space-y-4">
        {assignments.map(assignment => (
          <Card key={assignment.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  <Home className="inline h-5 w-5 mr-2" />
                  Chambre {assignment.room?.room_number}
                </CardTitle>
                <Badge className={getStatusColor(assignment.status)}>
                  {getStatusLabel(assignment.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {assignment.estimated_duration}min estimé
                </span>
                <span className="text-muted-foreground">
                  Priorité: {assignment.room?.cleaning_priority}/4
                </span>
              </div>

              {assignment.room?.notes && (
                <p className="text-sm bg-muted p-2 rounded">
                  {assignment.room.notes}
                </p>
              )}

              <div className="flex gap-2">
                {assignment.status === 'assigned' && (
                  <Button 
                    onClick={() => handleStartCleaning(assignment)}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Commencer
                  </Button>
                )}

                {assignment.status === 'in_progress' && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => setSelectedAssignment(assignment)}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Terminer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Terminer le nettoyage</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p>Chambre {assignment.room?.room_number}</p>
                        <div>
                          <label className="text-sm font-medium">Notes (optionnel)</label>
                          <Textarea
                            placeholder="Remarques sur le nettoyage..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleCompleteCleaning(assignment, notes)}
                            className="flex-1"
                          >
                            Confirmer
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setSelectedAssignment(null);
                              setNotes('');
                            }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {assignment.status === 'completed' && (
                  <Badge className="flex-1 justify-center py-2">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Terminé
                  </Badge>
                )}
              </div>

              {assignment.started_at && (
                <p className="text-xs text-muted-foreground">
                  Commencé à {new Date(assignment.started_at).toLocaleTimeString()}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {assignments.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Home className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Aucune tâche</h3>
              <p className="text-muted-foreground">
                Pas de chambres attribuées pour le moment
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
