import { Room } from "@/services/pdfService";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { RoomCard } from "./RoomCard";
import { AlertTriangle, Layers } from "lucide-react";
import { Badge } from "./ui/badge";

interface UnassignedRoomsColumnProps {
  rooms: Room[];
  onRoomUpdate: (room: Room) => void;
  draggable?: boolean;
  allRooms?: Room[]; // Pour afficher toutes les chambres non assignées
  forceHide?: boolean; // New prop to force hide the component
}

export function UnassignedRoomsColumn({ 
  rooms, 
  onRoomUpdate,
  draggable = true,
  allRooms = [], // Par défaut, c'est un tableau vide
  forceHide = false // Default is false, so the component will show
}: UnassignedRoomsColumnProps) {
  
  // If forceHide is true, don't render the component
  if (forceHide) {
    return null;
  }
  
  // MODIFIED: When floors are selected, some rooms may already be assigned to housekeepers
  // but might not be in their visible rooms due to floor preference settings
  // We need to ensure any room that isn't visibly assigned appears in the unassigned column
  const displayRooms = allRooms.length > 0 
    ? allRooms.filter(room => !room.assignedTo) 
    : rooms.filter(room => !room.assignedTo);
  
  // Grouper les chambres par étage
  const roomsByFloor = displayRooms.reduce((acc, room) => {
    const floor = parseInt(room.number[0]) || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);
  
  // Trier les chambres par étage et par numéro
  const sortedFloorRooms = Object.entries(roomsByFloor)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));
  
  const sortRoomsByNumber = (rooms: Room[]) => {
    return [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  };
  
  return (
    <Card className="border-red-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-bold text-lg">Chambres non assignées</h3>
          </div>
          <Badge variant="outline" className="bg-red-50 text-red-700">
            {displayRooms.length} chambres
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {displayRooms.length > 0 ? (
          <div className="space-y-4">
            {sortedFloorRooms.map(([floor, floorRooms]) => (
              <div key={`unassigned-${floor}`} className="pt-1">
                <div className="flex items-center gap-1 text-sm font-semibold mb-2 border-b pb-1">
                  <Layers className="h-4 w-4" />
                  <span>Étage {floor === '0' ? 'RDC' : floor} ({floorRooms.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {sortRoomsByNumber(floorRooms).map(room => (
                    <RoomCard 
                      key={`unassigned-${room.number}`} 
                      room={room} 
                      onUpdate={onRoomUpdate}
                      compact 
                      draggable={draggable}
                      showActions={true}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 border border-dashed rounded-lg">
            <p>Toutes les chambres sont assignées</p>
            <p className="text-sm mt-1">Félicitations !</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
