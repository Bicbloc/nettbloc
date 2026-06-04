import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { 
  Home, Loader2, RefreshCw, Search, User, UserX, Clock, Check, 
  MessageSquare, Star, AlertCircle, Filter, ShieldCheck, ShieldX, Package
} from 'lucide-react';
import { ReportLostItemDialog } from '@/components/lost-and-found/ReportLostItemDialog';
import { ReadOnlyFloorPlan } from '@/components/registry/ReadOnlyFloorPlan';
import { Map as MapIcon } from 'lucide-react';
import { IncidentReportWizard } from '@/components/incident/IncidentReportWizard';

interface GovernessRoomManagementProps {
  hotelId: string;
  governessName: string;
}

interface Room {
  id: string;
  room_number: string;
  status: string;
  cleaning_type: string;
  notes: string | null;
  inspected_at: string | null;
  inspected_by: string | null;
}

interface Assignment {
  id: string;
  room_id: string;
  housekeeper_name: string;
  housekeeper_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Housekeeper {
  id: string;
  name: string;
  is_active: boolean;
}

interface Inspection {
  room_id: string;
  status: string;
  cleanliness_score: number | null;
}

export const GovernessRoomManagement: React.FC<GovernessRoomManagementProps> = ({
  hotelId,
  governessName
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map());
  const [inspections, setInspections] = useState<Map<string, Inspection>>(new Map());
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPlan, setShowPlan] = useState(false);
  
  // Dialog states
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [noteDialog, setNoteDialog] = useState(false);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>('');
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Charger toutes les chambres
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('id, room_number, status, cleaning_type, notes, inspected_at, inspected_by')
        .eq('hotel_id', hotelId)
        .order('room_number');

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      // Charger les assignations actives du jour
      const today = new Date().toISOString().split('T')[0];
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id, room_id, housekeeper_name, housekeeper_id, status, started_at, completed_at')
        .eq('hotel_id', hotelId)
        .gte('assigned_at', today);

      const assignmentMap = new Map(
        assignmentsData?.map(a => [a.room_id, a]) || []
      );
      setAssignments(assignmentMap);

      // Charger les inspections du jour
      const { data: inspectionsData } = await supabase
        .from('room_inspections')
        .select('room_id, status, cleanliness_score')
        .eq('hotel_id', hotelId)
        .eq('inspection_date', today);

      const inspectionMap = new Map(
        inspectionsData?.map(i => [i.room_id, i]) || []
      );
      setInspections(inspectionMap);

      // Charger les femmes de chambre
      const { data: housekeepersData } = await supabase
        .from('housekeepers')
        .select('id, name, is_active')
        .eq('hotel_id', hotelId)
        .order('name');

      setHousekeepers(housekeepersData || []);

    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les données' });
    } finally {
      setIsLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime sync
  const handleRealtimeUpdate = useCallback(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync({
    hotelId,
    tables: ['rooms', 'assignments', 'room_inspections'],
    onUpdate: handleRealtimeUpdate
  });

  const handleAssign = async () => {
    if (!selectedRoom || !selectedHousekeeper) return;
    
    setIsSubmitting(true);
    try {
      // selectedHousekeeper contient désormais l'ID (évite les erreurs d'homonymes)
      const chosen = housekeepers.find(h => h.id === selectedHousekeeper);
      const chosenName = chosen?.name || '';
      const chosenId = chosen?.id || null;
      const existingAssignment = assignments.get(selectedRoom.id);
      
      if (existingAssignment) {
        // Mise à jour de l'assignation existante
        await supabase
          .from('assignments')
          .update({ 
            housekeeper_name: chosenName,
            housekeeper_id: chosenId
          })
          .eq('id', existingAssignment.id);
      } else {
        // Nouvelle assignation
        await supabase
          .from('assignments')
          .insert({
            hotel_id: hotelId,
            room_id: selectedRoom.id,
            housekeeper_name: chosenName,
            housekeeper_id: chosenId,
            status: 'assigned'
          });
      }

      // Logger l'action
      await supabase.from('daily_action_logs').insert({
        hotel_id: hotelId,
        action_type: 'assignment',
        description: `Chambre ${selectedRoom.room_number} assignée à ${chosenName}`,
        room_number: selectedRoom.room_number,
        actor_name: governessName,
        actor_type: 'governess',
        details: { housekeeper: chosenName, housekeeper_id: chosenId }
      });

      toast({
        title: 'Assignation réussie',
        description: `Chambre ${selectedRoom.room_number} assignée à ${chosenName}`
      });

      setAssignDialog(false);
      setSelectedHousekeeper('');
      loadData();
    } catch (error) {
      console.error('Erreur assignation:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible d'assigner la chambre" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async (room: Room) => {
    const assignment = assignments.get(room.id);
    if (!assignment) return;

    try {
      await supabase
        .from('assignments')
        .delete()
        .eq('id', assignment.id);

      // Logger l'action
      await supabase.from('daily_action_logs').insert({
        hotel_id: hotelId,
        action_type: 'unassignment',
        description: `Chambre ${room.room_number} désassignée de ${assignment.housekeeper_name}`,
        room_number: room.room_number,
        actor_name: governessName,
        actor_type: 'governess'
      });

      toast({
        title: 'Désassignation réussie',
        description: `Chambre ${room.room_number} désassignée`
      });

      loadData();
    } catch (error) {
      console.error('Erreur désassignation:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de désassigner' });
    }
  };

  const handleSaveNote = async () => {
    if (!selectedRoom) return;

    setIsSubmitting(true);
    try {
      await supabase
        .from('rooms')
        .update({ notes: noteText || null })
        .eq('id', selectedRoom.id);

      // Logger l'action
      await supabase.from('daily_action_logs').insert({
        hotel_id: hotelId,
        action_type: 'note-update',
        description: `Commentaire modifié pour chambre ${selectedRoom.room_number}`,
        room_number: selectedRoom.room_number,
        actor_name: governessName,
        actor_type: 'governess',
        details: { note: noteText }
      });

      toast({ description: 'Commentaire enregistré' });
      setNoteDialog(false);
      loadData();
    } catch (error) {
      console.error('Erreur sauvegarde note:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetClean = async (room: Room) => {
    try {
      const { RoomSyncService } = await import('@/services/roomSyncService');
      const synced = await RoomSyncService.updateStatus(hotelId, room.room_number, 'clean');
      if (!synced) {
        throw new Error('Impossible de synchroniser le statut de la chambre');
      }

      // Logger l'action
      await supabase.from('daily_action_logs').insert({
        hotel_id: hotelId,
        action_type: 'set-clean',
        description: `Chambre ${room.room_number} marquée comme propre`,
        room_number: room.room_number,
        actor_name: governessName,
        actor_type: 'governess'
      });

      toast({ 
        title: '✅ Chambre propre',
        description: `Chambre ${room.room_number} marquée comme propre` 
      });
      loadData();
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le statut' });
    }
  };

  const openAssignDialog = (room: Room) => {
    setSelectedRoom(room);
    const existingAssignment = assignments.get(room.id);
    // Pré-sélectionner par ID (fallback : retrouver l'ID via le nom existant)
    const existingId = existingAssignment?.housekeeper_id
      || housekeepers.find(h => h.name === existingAssignment?.housekeeper_name)?.id
      || '';
    setSelectedHousekeeper(existingId);
    setAssignDialog(true);
  };

  const openNoteDialog = (room: Room) => {
    setSelectedRoom(room);
    setNoteText(room.notes || '');
    setNoteDialog(true);
  };

  // Filtrer les chambres
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.room_number.toLowerCase().includes(searchTerm.toLowerCase());
    const assignment = assignments.get(room.id);
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'unassigned') return matchesSearch && !assignment;
    if (statusFilter === 'assigned') return matchesSearch && assignment;
    if (statusFilter === 'in_progress') return matchesSearch && assignment?.status === 'in_progress';
    if (statusFilter === 'clean') return matchesSearch && room.status === 'clean';
    if (statusFilter === 'inspected') return matchesSearch && room.inspected_at;
    
    return matchesSearch;
  });

  const getStatusBadge = (room: Room, assignment?: Assignment) => {
    const inspection = inspections.get(room.id);
    
    if (room.inspected_at) {
      return inspection?.status === 'passed' 
        ? <Badge className="bg-emerald-100 text-emerald-800 gap-1"><ShieldCheck className="h-3 w-3" /> Inspectée OK</Badge>
        : <Badge className="bg-red-100 text-red-800 gap-1"><ShieldX className="h-3 w-3" /> Inspectée KO</Badge>;
    }
    
    if (room.status === 'clean') {
      return <Badge className="bg-green-100 text-green-800 gap-1"><Check className="h-3 w-3" /> Propre</Badge>;
    }
    
    if (assignment?.status === 'in_progress') {
      return <Badge className="bg-blue-100 text-blue-800 gap-1 animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> En cours</Badge>;
    }
    
    if (assignment?.status === 'completed') {
      return <Badge className="bg-green-100 text-green-800 gap-1"><Check className="h-3 w-3" /> Terminé</Badge>;
    }
    
    if (assignment) {
      return <Badge className="bg-purple-100 text-purple-800 gap-1"><User className="h-3 w-3" /> Assignée</Badge>;
    }
    
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> À assigner</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une chambre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="unassigned">Non assignées</SelectItem>
            <SelectItem value="assigned">Assignées</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="clean">Propres</SelectItem>
            <SelectItem value="inspected">Inspectées</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
        <Button
          variant={showPlan ? 'default' : 'outline'}
          onClick={() => setShowPlan(!showPlan)}
          className="gap-2"
        >
          <MapIcon className="h-4 w-4" />
          Plan
        </Button>
      </div>

      {showPlan ? (
        <ReadOnlyFloorPlan hotelId={hotelId} />
      ) : (
      <>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card className="p-3 text-center">
          <div className="text-xl font-bold">{rooms.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-purple-600">{Array.from(assignments.values()).length}</div>
          <div className="text-xs text-muted-foreground">Assignées</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-blue-600">
            {Array.from(assignments.values()).filter(a => a.status === 'in_progress').length}
          </div>
          <div className="text-xs text-muted-foreground">En cours</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-green-600">
            {rooms.filter(r => r.status === 'clean').length}
          </div>
          <div className="text-xs text-muted-foreground">Propres</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-emerald-600">
            {rooms.filter(r => r.inspected_at).length}
          </div>
          <div className="text-xs text-muted-foreground">Inspectées</div>
        </Card>
      </div>

      {/* Liste des chambres */}
      {filteredRooms.length === 0 ? (
        <Card className="p-8 text-center">
          <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune chambre trouvée</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map(room => {
            const assignment = assignments.get(room.id);
            const inspection = inspections.get(room.id);

            return (
              <Card 
                key={room.id}
                className={`transition-all hover:shadow-md ${
                  assignment?.status === 'in_progress' ? 'border-blue-400 border-2 bg-blue-50/30' :
                  room.inspected_at ? 'border-emerald-300 bg-emerald-50/30' :
                  room.status === 'clean' ? 'border-green-300 bg-green-50/30' :
                  ''
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-muted-foreground" />
                      <span className="font-bold text-lg">{room.room_number}</span>
                      {room.cleaning_type && (
                        <Badge variant="outline" className="text-xs">
                          {room.cleaning_type === 'a_blanc' ? '🚪 À blanc' : '🛏️ Recouche'}
                        </Badge>
                      )}
                    </div>
                    {getStatusBadge(room, assignment)}
                  </div>

                  {/* Assignation */}
                  {assignment && (
                    <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{assignment.housekeeper_name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnassign(room)}
                        className="h-7 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Note de propreté si inspectée */}
                  {inspection?.cleanliness_score && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star}
                          className={`h-4 w-4 ${star <= inspection.cleanliness_score! ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Commentaire */}
                  {room.notes && (
                    <div className="text-sm bg-purple-50 border border-purple-200 rounded-lg p-2">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-600 mt-0.5" />
                        <p className="text-purple-800">{room.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openAssignDialog(room)}
                    >
                      <User className="h-4 w-4 mr-1" />
                      {assignment ? 'Réassigner' : 'Assigner'}
                    </Button>
                    
                    {/* Mettre en propre - visible si pas propre */}
                    {room.status !== 'clean' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleSetClean(room)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openNoteDialog(room)}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    
                    {/* Incident */}
                    <IncidentReportWizard
                      hotelId={hotelId}
                      userType="governess"
                      userName={governessName}
                      defaultLocation={room.room_number}
                      trigger={
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                      }
                    />
                    
                    {/* Objet trouvé */}
                    <ReportLostItemDialog
                      hotelId={hotelId}
                      reporterName={governessName}
                      reporterType="governess"
                      roomNumber={room.room_number}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Package className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Assignation */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner la chambre {selectedRoom?.room_number}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une femme de chambre" />
              </SelectTrigger>
              <SelectContent>
                {housekeepers.filter(h => h.is_active).map(h => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Annuler</Button>
            <Button onClick={handleAssign} disabled={!selectedHousekeeper || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Note */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commentaire - Chambre {selectedRoom?.room_number}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Ajouter un commentaire..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveNote} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
};
