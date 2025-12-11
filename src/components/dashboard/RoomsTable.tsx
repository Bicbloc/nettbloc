import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, Trash2 } from "lucide-react";
import { RoomCard } from "@/components/RoomCard";
import { Room } from "@/services/pdfService";

interface RoomsTableProps {
  rooms: Room[];
  housekeeperNames: string[];
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onRoomReassign: (room: Room, newHousekeeper: string) => void;
  onOpenLinkDialog: (room: Room) => void;
  onOpenDeleteDialog: (room: Room) => void;
}

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

const getCleaningTypeBadge = (type: string) => {
  switch (type) {
    case 'full':
      return <Badge variant="outline" className="bg-red-100 text-red-800">À blanc</Badge>;
    case 'quick':
      return <Badge variant="outline" className="bg-blue-100 text-blue-800">Recouche</Badge>;
    case 'none':
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Aucun</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
};

export const RoomsTable = ({
  rooms,
  housekeeperNames,
  onRoomUpdate,
  onRoomUnassign,
  onRoomReassign,
  onOpenLinkDialog,
  onOpenDeleteDialog
}: RoomsTableProps) => {
  return (
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
          {rooms.map((room) => (
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
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenLinkDialog(room)}
                    className="flex items-center gap-1"
                    title="Lier avec d'autres chambres"
                  >
                    <Link className="h-3 w-3" />
                    Lier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenDeleteDialog(room)}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Supprimer la chambre"
                  >
                    <Trash2 className="h-3 w-3" />
                    Supprimer
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
