import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, AlertCircle, Clock, Eye, Star, Loader2, Home, RefreshCw, Package, UserCheck } from 'lucide-react';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { ReportLostItemDialog } from '@/components/lost-and-found/ReportLostItemDialog';
interface GovernessInspectionInterfaceProps {
  hotelId: string;
  governessName: string;
  governessId?: string;
}

interface Room {
  id: string;
  room_number: string;
  status: string;
  cleaning_type: string;
  notes: string | null;
  floor?: number | null;
  housekeeper_name?: string;
}

interface DailyGovAssignment {
  id: string;
  governess_name: string;
  assignment_type: string;
  assigned_floors: number[] | null;
  assigned_housekeepers: string[] | null;
  assigned_rooms: string[] | null;
}

interface Inspection {
  id: string;
  room_id: string;
  status: string;
  cleanliness_score: number | null;
  notes: string | null;
  inspected_at: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  pending: { label: 'À inspecter', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  passed: { label: 'Validée', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: 'Refusée', color: 'bg-red-100 text-red-800', icon: XCircle },
  needs_rework: { label: 'À reprendre', color: 'bg-orange-100 text-orange-800', icon: AlertCircle }
};

export const GovernessInspectionInterface: React.FC<GovernessInspectionInterfaceProps> = ({
  hotelId,
  governessName,
  governessId
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [govAssignments, setGovAssignments] = useState<DailyGovAssignment[]>([]);
  const [inspections, setInspections] = useState<Map<string, Inspection>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [inspectionDialog, setInspectionDialog] = useState(false);
  const [inspectionData, setInspectionData] = useState({
    score: 5,
    notes: '',
    issues: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Charger les chambres propres (à inspecter)
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          id,
          room_number,
          status,
          cleaning_type,
          notes,
          floor
        `)
        .eq('hotel_id', hotelId)
        .eq('status', 'clean')
        .order('room_number');

      if (roomsError) throw roomsError;

      // Charger les assignations pour avoir le nom de la femme de chambre
      const { data: assignments } = await supabase
        .from('assignments')
        .select('room_id, housekeeper_name')
        .eq('hotel_id', hotelId)
        .eq('status', 'completed');

      const assignmentMap = new Map(assignments?.map(a => [a.room_id, a.housekeeper_name]) || []);

      const roomsWithHousekeeper = (roomsData || []).map(room => ({
        ...room,
        housekeeper_name: assignmentMap.get(room.id)
      }));

      setRooms(roomsWithHousekeeper);

      // Charger les attributions de gouvernantes du jour (par étage / femme de chambre)
      const { data: govData } = await supabase
        .from('daily_governess_assignments')
        .select('id, governess_name, assignment_type, assigned_floors, assigned_housekeepers')
        .eq('hotel_id', hotelId)
        .eq('assignment_date', today);
      setGovAssignments((govData as DailyGovAssignment[]) || []);

      // Charger les inspections du jour
      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from('room_inspections')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('inspection_date', today);

      if (inspectionsError) throw inspectionsError;

      const inspectionMap = new Map(inspectionsData?.map(i => [i.room_id, i]) || []);
      setInspections(inspectionMap);


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
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
    if (table === 'rooms' || table === 'room_inspections' || table === 'daily_governess_assignments') {
      loadData();
    }
  }, [loadData]);

  useRealtimeSync({
    hotelId,
    tables: ['rooms', 'room_inspections', 'daily_governess_assignments'],
    onUpdate: handleRealtimeUpdate
  });

  const openInspectionDialog = (room: Room) => {
    setSelectedRoom(room);
    const existing = inspections.get(room.id);
    if (existing) {
      setInspectionData({
        score: existing.cleanliness_score || 5,
        notes: existing.notes || '',
        issues: []
      });
    } else {
      setInspectionData({ score: 5, notes: '', issues: [] });
    }
    setInspectionDialog(true);
  };

  const handleInspection = async (status: 'passed' | 'failed' | 'needs_rework') => {
    if (!selectedRoom) return;

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingInspection = inspections.get(selectedRoom.id);

      const inspectionRecord = {
        hotel_id: hotelId,
        room_id: selectedRoom.id,
        governess_id: governessId,
        governess_name: governessName,
        inspection_date: today,
        status,
        cleanliness_score: inspectionData.score,
        notes: inspectionData.notes || null,
        issues: inspectionData.issues.length > 0 ? inspectionData.issues : null,
        inspected_at: new Date().toISOString()
      };

      if (existingInspection) {
        await supabase
          .from('room_inspections')
          .update(inspectionRecord)
          .eq('id', existingInspection.id);
      } else {
        await supabase
          .from('room_inspections')
          .insert(inspectionRecord);
      }

      // Si validée, marquer la chambre comme inspectée
      if (status === 'passed') {
        await supabase
          .from('rooms')
          .update({ 
            inspected_at: new Date().toISOString(),
            inspected_by: governessName 
          })
          .eq('id', selectedRoom.id);

        // Pousser l'état "Inspecté" vers le PMS (Mews INS / Apaleo Clean)
        try {
          const { RoomSyncService } = await import('@/services/roomSyncService');
          RoomSyncService.pushStatusToPms(hotelId, selectedRoom.room_number, 'inspected');
        } catch (e) {
          console.warn('Push PMS (inspected) échoué:', e);
        }
      }
      
      // Si refusée ou à reprendre, mettre à jour le statut de la chambre
      if (status === 'failed' || status === 'needs_rework') {
        // Préserver la note existante de la chambre plutôt que de l'écraser.
        const existingNote = (selectedRoom as any).notes?.trim();
        const inspectionNote = `Inspection: ${inspectionData.notes}`;
        const mergedNotes = existingNote
          ? `${existingNote}\n${inspectionNote}`
          : inspectionNote;
        await supabase
          .from('rooms')
          .update({ 
            status: 'needs-cleaning', 
            notes: mergedNotes,
            inspected_at: null,
            inspected_by: null
          })
          .eq('id', selectedRoom.id);

        // Pousser l'état "à nettoyer" (sale) vers le PMS
        try {
          const { RoomSyncService } = await import('@/services/roomSyncService');
          RoomSyncService.pushStatusToPms(hotelId, selectedRoom.room_number, 'needs-cleaning');
        } catch (e) {
          console.warn('Push PMS (needs-cleaning) échoué:', e);
        }
      }

      // Logger l'action
      await supabase.from('daily_action_logs').insert({
        hotel_id: hotelId,
        action_type: 'room-inspection',
        description: `Inspection chambre ${selectedRoom.room_number}: ${statusConfig[status].label}`,
        room_number: selectedRoom.room_number,
        actor_name: governessName,
        actor_type: 'governess',
        details: { status, score: inspectionData.score, notes: inspectionData.notes }
      });

      toast({
        title: status === 'passed' ? '✅ Chambre validée' : '⚠️ Chambre à reprendre',
        description: `Chambre ${selectedRoom.room_number} - ${statusConfig[status].label}`
      });

      setInspectionDialog(false);
      loadData();
    } catch (error) {
      console.error('Erreur inspection:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible d'enregistrer l'inspection" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInspectionStatus = (roomId: string): Inspection | undefined => {
    return inspections.get(roomId);
  };

  const stats = {
    total: rooms.length,
    inspected: Array.from(inspections.values()).filter(i => i.status !== 'pending').length,
    passed: Array.from(inspections.values()).filter(i => i.status === 'passed').length,
    failed: Array.from(inspections.values()).filter(i => i.status === 'failed' || i.status === 'needs_rework').length
  };

  // Détermine si une chambre relève d'une attribution de gouvernante donnée.
  const roomMatchesAssignment = (room: Room, a: DailyGovAssignment): boolean => {
    const floors = (a.assigned_floors || []).map(Number);
    const matchFloor =
      floors.length > 0 && room.floor != null && floors.includes(Number(room.floor));

    const hks = (a.assigned_housekeepers || []).map((h) => (h || '').trim().toLowerCase());
    const matchHk =
      hks.length > 0 &&
      !!room.housekeeper_name &&
      hks.includes(room.housekeeper_name.trim().toLowerCase());

    return matchFloor || matchHk;
  };

  // Regroupe les chambres à inspecter par gouvernante attribuée (sections).
  const sections = useMemo(() => {
    const result: { key: string; name: string; scope: string; rooms: Room[] }[] = [];
    const claimed = new Set<string>();

    for (const a of govAssignments) {
      const sectionRooms = rooms.filter((r) => roomMatchesAssignment(r, a));
      sectionRooms.forEach((r) => claimed.add(r.id));
      const scopeParts: string[] = [];
      if ((a.assigned_floors || []).length > 0) {
        scopeParts.push(`Étages : ${(a.assigned_floors || []).map((f) => (f === 0 ? 'RDC' : f)).join(', ')}`);
      }
      if ((a.assigned_housekeepers || []).length > 0) {
        scopeParts.push(`Femmes de chambre : ${(a.assigned_housekeepers || []).join(', ')}`);
      }
      const scope = scopeParts.join(' • ') || '—';
      result.push({ key: a.id, name: a.governess_name, scope, rooms: sectionRooms });
    }

    const unassigned = rooms.filter((r) => !claimed.has(r.id));
    if (unassigned.length > 0) {
      result.push({ key: '__unassigned__', name: 'Non attribuées', scope: 'Aucune gouvernante', rooms: unassigned });
    }
    return result;
  }, [rooms, govAssignments]);

  const renderRoomCard = (room: Room) => {
    const inspection = getInspectionStatus(room.id);
    const StatusIcon = inspection ? statusConfig[inspection.status].icon : Eye;
    return (
      <Card
        key={room.id}
        className={`cursor-pointer transition-all hover:shadow-lg ${
          inspection?.status === 'passed' ? 'border-green-200 bg-green-50/50' :
          inspection?.status === 'failed' ? 'border-red-200 bg-red-50/50' :
          inspection?.status === 'needs_rework' ? 'border-orange-200 bg-orange-50/50' :
          ''
        }`}
        onClick={() => openInspectionDialog(room)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-muted-foreground" />
              <span className="font-bold text-lg">{room.room_number}</span>
            </div>
            {inspection ? (
              <Badge className={statusConfig[inspection.status].color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig[inspection.status].label}
              </Badge>
            ) : (
              <Badge variant="outline">
                <Eye className="h-3 w-3 mr-1" />
                À inspecter
              </Badge>
            )}
          </div>

          {room.housekeeper_name && (
            <p className="text-sm text-muted-foreground mb-2">
              Nettoyée par: {room.housekeeper_name}
            </p>
          )}

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
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">{stats.total}</div>
          <div className="text-xs text-muted-foreground">À inspecter</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.inspected}</div>
          <div className="text-xs text-muted-foreground">Inspectées</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
          <div className="text-xs text-muted-foreground">Validées</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-xs text-muted-foreground">À reprendre</div>
        </Card>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Room list grouped by governess */}
      {rooms.length === 0 ? (
        <Card className="p-8 text-center">
          <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Aucune chambre à inspecter</h3>
          <p className="text-muted-foreground">
            Les chambres nettoyées apparaîtront ici pour inspection
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sections.map(section => {
            const doneCount = section.rooms.filter(
              r => getInspectionStatus(r.id)?.status === 'passed'
            ).length;
            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-base">{section.name}</h3>
                    <span className="text-xs text-muted-foreground">{section.scope}</span>
                  </div>
                  <Badge variant="secondary">
                    {doneCount}/{section.rooms.length} validée(s)
                  </Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {section.rooms.map(renderRoomCard)}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Inspection Dialog */}
      <Dialog open={inspectionDialog} onOpenChange={setInspectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inspection - Chambre {selectedRoom?.room_number}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedRoom?.housekeeper_name && (
              <p className="text-sm text-muted-foreground">
                Nettoyée par: <strong>{selectedRoom.housekeeper_name}</strong>
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Note de propreté</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setInspectionData(prev => ({ ...prev, score: star }))}
                    className="focus:outline-none"
                  >
                    <Star 
                      className={`h-8 w-8 transition-colors ${
                        star <= inspectionData.score ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 hover:text-yellow-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Remarques</label>
              <Textarea
                placeholder="Commentaires sur l'inspection..."
                value={inspectionData.notes}
                onChange={(e) => setInspectionData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          {/* Report Lost Item */}
          <div className="border-t pt-4">
            <ReportLostItemDialog
              hotelId={hotelId}
              reporterName={governessName}
              reporterType="governess"
              roomNumber={selectedRoom?.room_number}
              trigger={
                <Button variant="outline" className="w-full gap-2">
                  <Package className="h-4 w-4" />
                  Signaler un objet trouvé
                </Button>
              }
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => handleInspection('failed')}
              disabled={isSubmitting}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Refuser
            </Button>
            <Button
              variant="outline"
              onClick={() => handleInspection('needs_rework')}
              disabled={isSubmitting}
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              À reprendre
            </Button>
            <Button
              onClick={() => handleInspection('passed')}
              disabled={isSubmitting}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
