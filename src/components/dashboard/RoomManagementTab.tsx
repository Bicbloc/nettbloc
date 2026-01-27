/**
 * Composant Gestion des chambres
 * Extrait de Index.tsx pour modularité
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Trash2, Link, Sparkles, ClipboardList, FileUp } from "lucide-react";
import { Room } from "@/services/pdfService";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { AddRoomDialog } from "@/components/AddRoomDialog";
import { ManualRoomEntryDialog } from "@/components/ManualRoomEntryDialog";
import { ImportModeSwitch } from "@/components/ImportModeSwitch";
import { RoomFilters } from "@/components/RoomFilters";
import { RoomCard } from "@/components/RoomCard";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RoomManagementTabProps {
  rooms: Room[];
  housekeeperNames: string[];
  currentHotelId: string | null;
  onPdfProcessed: (data: Room[], housekeepers?: string[], method?: 'random' | 'floor' | 'cleaning-type') => void;
  onAddRoom: (room: Room) => Promise<void>;
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onRoomReassign: (room: Room, newHousekeeper: string | null) => void;
  onOpenManualAssignment: () => void;
  onDeleteRoom: (roomNumber: string) => void;
  onLinkRooms: (roomNumber: string) => void;
}

export function RoomManagementTab({
  rooms,
  housekeeperNames,
  currentHotelId,
  onPdfProcessed,
  onAddRoom,
  onRoomUpdate,
  onRoomUnassign,
  onRoomReassign,
  onOpenManualAssignment,
  onDeleteRoom,
  onLinkRooms,
}: RoomManagementTabProps) {
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  const [importMode, setImportMode] = useState<'auto' | 'manual'>('auto');

  // Load hotel's import mode preference
  useEffect(() => {
    const loadImportMode = async () => {
      if (!currentHotelId) return;
      const { data } = await supabase
        .from('hotels')
        .select('import_mode')
        .eq('id', currentHotelId)
        .maybeSingle();
      if (data?.import_mode) {
        setImportMode(data.import_mode as 'auto' | 'manual');
      }
    };
    loadImportMode();
  }, [currentHotelId]);
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs-cleaning':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">À Nettoyer</Badge>;
      case 'clean':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Propre</Badge>;
      case 'occupied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Occupé</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCleaningTypeBadge = (type?: string) => {
    switch (type) {
      case 'full':
      case 'a_blanc':
        return <Badge variant="outline" className="bg-red-100 text-red-800">À blanc</Badge>;
      case 'quick':
      case 'recouche':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Recouche</Badge>;
      case 'none':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Aucun</Badge>;
      default:
        return <Badge variant="outline">{type || 'N/A'}</Badge>;
    }
  };

  const handleManualRoomsAdded = async (newRooms: Room[]) => {
    // Process each room through the existing handler
    for (const room of newRooms) {
      await onAddRoom(room);
    }
    // Trigger a refresh with the new rooms
    onPdfProcessed([...rooms, ...newRooms]);
  };

  const existingRoomNumbers = rooms.map(r => r.number);

  return (
    <div className="space-y-6">
      {/* Import Mode Switch */}
      <ImportModeSwitch 
        hotelId={currentHotelId}
        currentMode={importMode}
        onModeChange={setImportMode}
      />

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des chambres</h2>
        <div className="flex gap-2">
          <AddRoomDialog 
            onAddRoom={onAddRoom} 
            existingRooms={rooms} 
          />
          {importMode === 'auto' ? (
            <PdfWorkflowDialog 
              hotelId={currentHotelId}
              onWorkflowComplete={onPdfProcessed}
            />
          ) : (
            <ManualRoomEntryDialog 
              hotelId={currentHotelId}
              onRoomsAdded={handleManualRoomsAdded}
              existingRoomNumbers={existingRoomNumbers}
            />
          )}
          <Button
            onClick={onOpenManualAssignment}
            variant="outline"
            disabled={housekeeperNames.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Assignation manuelle
          </Button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {importMode === 'auto' ? (
              <>
                <Sparkles className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Importez vos chambres</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Téléchargez un rapport PDF de votre PMS. L'IA extraira automatiquement les chambres et statuts.
                </p>
                <div className="flex flex-wrap gap-1 mb-4 justify-center">
                  <Badge variant="secondary" className="text-xs">Mews</Badge>
                  <Badge variant="secondary" className="text-xs">Apaleo</Badge>
                  <Badge variant="secondary" className="text-xs">Opera</Badge>
                  <Badge variant="secondary" className="text-xs">+10 PMS</Badge>
                </div>
                <PdfWorkflowDialog 
                  hotelId={currentHotelId}
                  onWorkflowComplete={onPdfProcessed}
                />
              </>
            ) : (
              <>
                <ClipboardList className="h-12 w-12 text-secondary-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Saisissez vos chambres</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Ajoutez vos chambres manuellement avec leur numéro, type de nettoyage et statut.
                </p>
                <div className="flex flex-wrap gap-1 mb-4 justify-center">
                  <Badge variant="outline" className="text-xs">🚪 À blanc</Badge>
                  <Badge variant="outline" className="text-xs">🛏️ Recouche</Badge>
                  <Badge variant="outline" className="text-xs">✅ Propre</Badge>
                </div>
                <ManualRoomEntryDialog 
                  hotelId={currentHotelId}
                  onRoomsAdded={handleManualRoomsAdded}
                  existingRoomNumbers={existingRoomNumbers}
                />
              </>
            )}

            {/* Quick add single room */}
            <div className="mt-6 pt-4 border-t w-full max-w-md">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Ou ajoutez une seule chambre :
              </p>
              <div className="flex justify-center">
                <AddRoomDialog 
                  onAddRoom={onAddRoom} 
                  existingRooms={rooms} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Filtres et options</CardTitle>
            </CardHeader>
            <CardContent>
              <RoomFilters 
                rooms={rooms}
                onFiltersChange={(filtered) => setFilteredRooms(filtered)}
              />
            </CardContent>
          </Card>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Chambre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Type de nettoyage</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Assignée à</TableHead>
                  <TableHead>Twin</TableHead>
                  <TableHead>Chambres liées</TableHead>
                  <TableHead>Actions rapides</TableHead>
                  <TableHead>Gestion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(filteredRooms || rooms).map((room) => (
                  <TableRow key={room.number}>
                    <TableCell className="font-medium">{room.number}</TableCell>
                    <TableCell>{getStatusBadge(room.status)}</TableCell>
                    <TableCell>{getCleaningTypeBadge(room.cleaningType)}</TableCell>
                    <TableCell>
                      {room.priority === 'high' ? (
                        <Badge variant="destructive">Élevée</Badge>
                      ) : (
                        <Badge variant="secondary">Normale</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {room.assignedTo ? (
                        <Badge variant="outline">{room.assignedTo}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Non assignée</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={room.isTwin || false}
                        onCheckedChange={(checked) => {
                          onRoomUpdate({ ...room, isTwin: checked as boolean });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {room.linkedRooms && room.linkedRooms.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {room.linkedRooms.map(linkedRoom => (
                            <Badge key={linkedRoom} variant="secondary" className="text-xs">
                              {linkedRoom}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Aucune</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <RoomCard
                        room={room}
                        onUpdate={onRoomUpdate}
                        onUnassign={onRoomUnassign}
                        onReassign={onRoomReassign}
                        allRooms={rooms}
                        housekeeperNames={housekeeperNames}
                        compact={true}
                        showActions={true}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onLinkRooms(room.number)}
                          title="Lier des chambres"
                        >
                          <Link className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteRoom(room.number)}
                          className="text-destructive hover:text-destructive"
                          title="Supprimer la chambre"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
