/**
 * Composant Gestion des chambres
 * Extrait de Index.tsx pour modularité
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, FileText, Trash2, Link } from "lucide-react";
import { Room } from "@/services/pdfService";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { AddRoomDialog } from "@/components/AddRoomDialog";
import { RoomFilters } from "@/components/RoomFilters";
import { RoomCard } from "@/components/RoomCard";
import { useState } from "react";

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des chambres</h2>
        <div className="flex gap-2">
          <AddRoomDialog 
            onAddRoom={onAddRoom} 
            existingRooms={rooms} 
          />
          <PdfWorkflowDialog 
            hotelId={currentHotelId}
            onWorkflowComplete={onPdfProcessed}
          />
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune chambre importée</h3>
            <p className="text-muted-foreground text-center mb-4">
              Importez un fichier PDF pour commencer à gérer vos chambres ou ajoutez des chambres manuellement
            </p>
            <div className="flex gap-2 justify-center">
              <AddRoomDialog 
                onAddRoom={onAddRoom} 
                existingRooms={rooms} 
              />
              <PdfWorkflowDialog 
                hotelId={currentHotelId}
                onWorkflowComplete={onPdfProcessed}
              />
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
