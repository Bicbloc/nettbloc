
import { useState } from "react";
import { Room } from "@/services/pdfService";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { RoomCard } from "./RoomCard";
import { RoomAssignmentButton } from "./RoomAssignmentButton";
import { AlertTriangle, Layers } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UnassignedRoomsColumnProps {
  rooms: Room[];
  onRoomUpdate: (room: Room) => void;
  draggable?: boolean;
  allRooms?: Room[]; // Pour afficher toutes les chambres non assignées
  forceHide?: boolean; // New prop to force hide the component
  housekeeperNames?: string[]; // Noms des femmes de chambre pour assignation directe
  onDirectAssign?: (roomNumber: string, housekeeperName: string) => void; // Callback pour assignation directe
  hotelId?: string;
}

export function UnassignedRoomsColumn({ 
  rooms, 
  onRoomUpdate,
  draggable = true,
  allRooms = [], // Par défaut, c'est un tableau vide
  forceHide = false, // Default is false, so the component will show
  housekeeperNames = [], // Noms des femmes de chambre
  onDirectAssign, // Callback pour assignation directe
  hotelId
}: UnassignedRoomsColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const roomData = e.dataTransfer.getData('application/json');
      if (!roomData) return;
      const room = JSON.parse(roomData) as Room;
      if (!room.assignedTo) return; // Already unassigned
      onRoomUpdate({ ...room, assignedTo: undefined });
    } catch (error) {
      console.error("Erreur lors du retrait d'affectation:", error);
    }
  };
  
  
  // Récupérer le nombre d'incidents actifs par chambre
  const { data: incidentCounts } = useQuery({
    queryKey: ['room-incident-counts', hotelId],
    queryFn: async () => {
      if (!hotelId) return {};
      
      const { data, error } = await supabase
        .from('incidents')
        .select('location_reference')
        .eq('hotel_id', hotelId)
        .neq('status', 'resolved');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach((incident) => {
        if (incident.location_reference) {
          counts[incident.location_reference] = (counts[incident.location_reference] || 0) + 1;
        }
      });
      
      return counts;
    },
    enabled: !!hotelId,
    staleTime: 30000
  });
  
  // If forceHide is true, don't render the component
  if (forceHide) {
    return null;
  }
  
  // Ensure all unassigned rooms are displayed
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
    <Card
      className={cn(
        "border-red-200 transition-colors",
        isDragOver && "border-primary border-2 bg-primary/5 ring-2 ring-primary/30"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
                    <div key={`unassigned-${room.number}`} className="space-y-1">
                      <RoomCard 
                        room={room} 
                        onUpdate={onRoomUpdate}
                        compact 
                        draggable={draggable}
                        showActions={true}
                        hotelId={hotelId}
                        incidentCount={incidentCounts?.[room.number] || 0}
                      />
                      {housekeeperNames.length > 0 && onDirectAssign && (
                        <RoomAssignmentButton
                          room={room}
                          housekeeperNames={housekeeperNames}
                          onAssign={onDirectAssign}
                          className="w-full"
                        />
                      )}
                    </div>
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
