import { Room } from "@/services/pdfService";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { RoomCard } from "./RoomCard";
import { CheckCircle, Clock } from "lucide-react";
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
  
  // Trier par chambre la plus récemment nettoyée en premier
  const sortedRooms = [...rooms].sort((a, b) => {
    const ta = a.lastCleanedAt ? new Date(a.lastCleanedAt).getTime() : 0;
    const tb = b.lastCleanedAt ? new Date(b.lastCleanedAt).getTime() : 0;
    return tb - ta;
  });

  const formatTime = (iso?: string) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
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
        <div className="flex items-center gap-1 text-xs text-green-700/80 mt-1">
          <Clock className="h-3 w-3" />
          <span>Triées par la plus récemment nettoyée</span>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {sortedRooms.map((room, index) => {
            const time = formatTime(room.lastCleanedAt);
            return (
              <div key={`clean-${room.number}`} className="relative">
                {index === 0 && (
                  <Badge className="absolute -top-2 -right-1 z-10 bg-green-600 text-white text-[10px] px-1.5 py-0">
                    Plus récente
                  </Badge>
                )}
                <RoomCard 
                  room={room} 
                  onUpdate={onRoomUpdate}
                  compact 
                  draggable={false}
                  showActions={false}
                  hotelId={hotelId}
                />
                {time && (
                  <div className="flex items-center justify-center gap-1 text-[10px] text-green-700/70 mt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{time}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
