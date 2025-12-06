import { Room } from "@/services/pdfService";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { RoomCard } from "./RoomCard";
import { CheckCircle, Layers } from "lucide-react";
import { Badge } from "./ui/badge";

interface CleanRoomsSectionProps {
  rooms: Room[];
  onRoomUpdate: (room: Room) => void;
  hotelId?: string;
}

export function CleanRoomsSection({ 
  rooms, 
  onRoomUpdate,
  hotelId
}: CleanRoomsSectionProps) {
  
  // Si aucune chambre propre, ne pas afficher la section
  if (rooms.length === 0) {
    return null;
  }
  
  // Grouper les chambres par étage
  const roomsByFloor = rooms.reduce((acc, room) => {
    const floor = parseInt(room.number[0]) || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);
  
  // Trier les chambres par étage
  const sortedFloorRooms = Object.entries(roomsByFloor)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));
  
  const sortRoomsByNumber = (rooms: Room[]) => {
    return [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  };
  
  return (
    <Card className="border-green-200 bg-green-50/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <h3 className="font-bold text-lg">Chambres propres</h3>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            {rooms.length} chambres
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          {sortedFloorRooms.map(([floor, floorRooms]) => (
            <div key={`clean-${floor}`} className="pt-1">
              <div className="flex items-center gap-1 text-sm font-semibold mb-2 border-b border-green-200 pb-1 text-green-700">
                <Layers className="h-4 w-4" />
                <span>Étage {floor === '0' ? 'RDC' : floor} ({floorRooms.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {sortRoomsByNumber(floorRooms).map(room => (
                  <RoomCard 
                    key={`clean-${room.number}`}
                    room={room} 
                    onUpdate={onRoomUpdate}
                    compact 
                    draggable={false}
                    showActions={false}
                    hotelId={hotelId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
