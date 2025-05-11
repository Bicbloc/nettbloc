
import { Room, CleaningConfig } from "@/services/pdfService";
import { Card } from "@/components/ui/card";
import { RoomCard } from "./RoomCard";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { FileCog, Layers } from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { toast } from "./ui/use-toast";

interface HousekeeperCardProps {
  name: string;
  rooms: Room[];
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onGenerateReport: (name: string, rooms: Room[]) => void;
  cleaningConfig: CleaningConfig;
  draggable?: boolean;
  availableFloors: number[];
  onFloorPreferenceChange: (name: string, floors: number[]) => void;
  preferredFloors: number[];
}

export function HousekeeperCard({ 
  name, 
  rooms, 
  onRoomUpdate, 
  onRoomUnassign,
  onGenerateReport,
  cleaningConfig,
  draggable = false,
  availableFloors,
  onFloorPreferenceChange,
  preferredFloors
}: HousekeeperCardProps) {
  const [isOverloaded, setIsOverloaded] = useState(false);
  const [isUnderloaded, setIsUnderloaded] = useState(false);
  const [workload, setWorkload] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isFloorSelectorOpen, setIsFloorSelectorOpen] = useState(false);
  
  // Group rooms by floor
  const roomsByFloor = rooms.reduce((acc, room) => {
    const floor = room.floor || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);
  
  useEffect(() => {
    // Calculer le temps estimé
    const time = rooms.reduce((total, room) => {
      if (room.cleaningType === 'full') {
        return total + cleaningConfig.fullCleaningTime;
      } else if (room.cleaningType === 'quick') {
        return total + cleaningConfig.quickCleaningTime;
      }
      return total;
    }, 0);
    
    setEstimatedTime(time);
    
    // Vérifier les contraintes min/max
    setIsOverloaded(rooms.length > cleaningConfig.maxRoomsPerHousekeeper);
    setIsUnderloaded(rooms.length < cleaningConfig.minRoomsPerHousekeeper);
    
    // Calculer la charge de travail en pourcentage (basé sur un max idéal)
    const idealMaxTime = cleaningConfig.maxRoomsPerHousekeeper * 
      ((cleaningConfig.fullCleaningTime + cleaningConfig.quickCleaningTime) / 2);
    
    setWorkload(Math.min(100, (time / idealMaxTime) * 100));
  }, [rooms, cleaningConfig]);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const roomData = e.dataTransfer.getData('application/json');
      if (roomData) {
        const room = JSON.parse(roomData) as Room;
        // La chambre sera déjà assignée ailleurs, donc pas besoin de vérifier
        const updatedRoom = { ...room, assignedTo: name };
        onRoomUpdate(updatedRoom);
      }
    } catch (error) {
      console.error("Erreur lors du drop:", error);
    }
  };
  
  const handleFloorChange = (floor: number, isChecked: boolean) => {
    const newPreferredFloors = isChecked
      ? [...preferredFloors, floor]
      : preferredFloors.filter(f => f !== floor);
    
    onFloorPreferenceChange(name, newPreferredFloors);
    
    if (isChecked) {
      toast({
        description: `Les chambres de l'étage ${floor === 0 ? 'RDC' : floor} seront prioritaires pour ${name}`
      });
    }
  };
  
  const toggleFloorSelector = () => {
    setIsFloorSelectorOpen(!isFloorSelectorOpen);
  };
  
  return (
    <Card 
      className={cn(
        "p-4 border rounded-lg",
        isOverloaded && "border-red-400",
        isUnderloaded && "border-amber-400"
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">{name}</h3>
        
        <div className="flex gap-1">
          <Button 
            size="sm" 
            variant="outline"
            onClick={toggleFloorSelector}
            className="flex items-center gap-1 text-sm"
          >
            <Layers className="h-4 w-4" /> Étages
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => onGenerateReport(name, rooms)}
            className="flex items-center gap-1 text-sm"
          >
            <FileCog className="h-4 w-4" /> Rapport
          </Button>
        </div>
      </div>
      
      {isFloorSelectorOpen && (
        <div className="mb-4 p-3 border rounded-md bg-slate-50">
          <div className="text-sm font-medium mb-2">Étages préférés:</div>
          <div className="grid grid-cols-5 gap-2">
            {availableFloors.map((floor) => (
              <div key={floor} className="flex items-center space-x-2">
                <Checkbox 
                  id={`floor-${name}-${floor}`} 
                  checked={preferredFloors.includes(floor)}
                  onCheckedChange={(checked) => handleFloorChange(floor, !!checked)}
                />
                <Label 
                  htmlFor={`floor-${name}-${floor}`}
                  className="text-sm cursor-pointer"
                >
                  {floor === 0 ? 'RDC' : `${floor}`}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Charge de travail</span>
          <span>{estimatedTime} min</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={cn(
              "h-2.5 rounded-full",
              workload >= 90 ? "bg-red-500" :
              workload >= 75 ? "bg-orange-500" :
              workload <= 30 ? "bg-amber-500" :
              "bg-green-500"
            )} 
            style={{ width: `${workload}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs mt-1 text-muted-foreground">
          <span>Min: {cleaningConfig.minRoomsPerHousekeeper} chambres</span>
          <span>{rooms.length} chambres</span>
          <span>Max: {cleaningConfig.maxRoomsPerHousekeeper} chambres</span>
        </div>
      </div>
      
      {isOverloaded && (
        <div className="text-red-500 text-xs mb-2">
          ⚠️ Trop de chambres assignées
        </div>
      )}
      
      {isUnderloaded && rooms.length > 0 && (
        <div className="text-amber-500 text-xs mb-2">
          ⚠️ Pas assez de chambres assignées
        </div>
      )}
      
      {/* Affichage par étage si au moins 2 étages différents */}
      {Object.keys(roomsByFloor).length > 1 ? (
        <div className="space-y-4">
          {Object.entries(roomsByFloor)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([floor, floorRooms]) => (
              <div key={floor} className="border-t pt-2">
                <div className="text-xs font-semibold mb-1">
                  Étage {floor === '0' ? 'RDC' : floor} ({floorRooms.length})
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {floorRooms.map(room => (
                    <div 
                      key={room.number} 
                      className="cursor-pointer hover:bg-gray-100 rounded p-1"
                      onClick={() => onRoomUnassign(room)}
                      title="Cliquer pour retirer l'assignation"
                    >
                      <RoomCard 
                        room={room} 
                        onUpdate={onRoomUpdate} 
                        compact 
                        draggable={draggable}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {rooms.map(room => (
            <div 
              key={room.number} 
              className="cursor-pointer hover:bg-gray-100 rounded p-1"
              onClick={() => onRoomUnassign(room)}
              title="Cliquer pour retirer l'assignation"
            >
              <RoomCard 
                room={room} 
                onUpdate={onRoomUpdate} 
                compact 
                draggable={draggable}
              />
            </div>
          ))}
        </div>
      )}
      
      {rooms.length === 0 && (
        <div className="text-center py-4 text-gray-400 border border-dashed rounded-lg">
          Glissez des chambres ici
        </div>
      )}
    </Card>
  );
}
