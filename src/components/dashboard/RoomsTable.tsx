import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, Trash2 } from "lucide-react";
import { RoomCard } from "@/components/RoomCard";
import { Room } from "@/services/pdfService";
import { normalizeCleaningType } from "@/utils/cleaningTypeUtils";
import { useLanguage } from "@/contexts/LanguageContext";

interface RoomsTableProps {
  rooms: Room[];
  housekeeperNames: string[];
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onRoomReassign: (room: Room, newHousekeeper: string) => void;
  onOpenLinkDialog: (room: Room) => void;
  onOpenDeleteDialog: (room: Room) => void;
}

export const RoomsTable = ({
  rooms,
  housekeeperNames,
  onRoomUpdate,
  onRoomUnassign,
  onRoomReassign,
  onOpenLinkDialog,
  onOpenDeleteDialog
}: RoomsTableProps) => {
  const { t } = useLanguage();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs-cleaning':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{t.rooms.dirty}</Badge>;
      case 'clean':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">{t.rooms.clean}</Badge>;
      case 'occupied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">{t.rooms.occupied}</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">{t.rooms.maintenance}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCleaningTypeBadge = (type: string) => {
    const normalized = normalizeCleaningType(type);
    
    switch (normalized) {
      case 'a_blanc':
        return <Badge variant="outline" className="bg-red-100 text-red-800">{t.rooms.fullClean}</Badge>;
      case 'recouche':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">{t.rooms.quickClean}</Badge>;
      case 'none':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">{t.common.none}</Badge>;
      default:
        return <Badge variant="outline">{t.rooms.fullClean}</Badge>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.rooms.roomNumberShort}</TableHead>
            <TableHead>{t.rooms.status}</TableHead>
            <TableHead>{t.rooms.cleaningType}</TableHead>
            <TableHead>{t.rooms.priority}</TableHead>
            <TableHead>{t.rooms.assignedTo}</TableHead>
            <TableHead>Twin</TableHead>
            <TableHead>{t.rooms.linkedRooms}</TableHead>
            <TableHead>{t.rooms.quickActions}</TableHead>
            <TableHead>{t.common.management}</TableHead>
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
                  <Badge variant="destructive">{t.common.high}</Badge>
                ) : (
                  <Badge variant="secondary">{t.common.normal}</Badge>
                )}
              </TableCell>
              <TableCell>
                {room.assignedTo ? (
                  <Badge variant="outline">{room.assignedTo}</Badge>
                ) : (
                  <span className="text-muted-foreground">{t.rooms.unassigned}</span>
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
                  <span className="text-muted-foreground text-sm">{t.common.none}</span>
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
                    title={t.rooms.linkWithRooms}
                  >
                    <Link className="h-3 w-3" />
                    {t.common.link}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenDeleteDialog(room)}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title={t.rooms.deleteRoom}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t.common.delete}
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
