
import { Room, CleaningConfig } from "@/services/pdfService";
import { Card } from "@/components/ui/card";
import { RoomCard } from "./RoomCard";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { FileCog, Layers, Plus, AlertTriangle } from "lucide-react";
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
  onManualAssign?: () => void;
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
  preferredFloors,
  onManualAssign
}: HousekeeperCardProps) {
  const [isOverloaded, setIsOverloaded] = useState(false);
  const [isUnderloaded, setIsUnderloaded] = useState(false);
  const [workload, setWorkload] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isFloorSelectorOpen, setIsFloorSelectorOpen] = useState(false);
  
  // Filter rooms based on selected floors
  const visibleRooms = preferredFloors.length > 0 
    ? rooms.filter(room => {
        const roomFloor = parseInt(room.number[0]) || 0;
        return preferredFloors.includes(roomFloor);
      })
    : rooms;
  
  // Group rooms by floor
  const roomsByFloor = visibleRooms.reduce((acc, room) => {
    const floor = parseInt(room.number[0]) || 0;
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
        description: `Les chambres de l'étage ${floor === 0 ? 'RDC' : floor} seront affichées pour ${name}`
      });
    } else if (preferredFloors.includes(floor)) {
      toast({
        description: `Les chambres de l'étage ${floor === 0 ? 'RDC' : floor} ne seront plus affichées pour ${name}`
      });
    }
  };
  
  const toggleFloorSelector = () => {
    setIsFloorSelectorOpen(!isFloorSelectorOpen);
  };
  
  // Trier les chambres par étage et numéro
  const sortedFloorRooms = Object.entries(roomsByFloor)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));
  
  const sortRoomsByNumber = (rooms: Room[]) => {
    return [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  };

  const handleUnassignRoom = (room: Room) => {
    onRoomUnassign(room);
  };
  
  // Calculate hidden rooms (not shown due to floor filtering)
  const hiddenRooms = preferredFloors.length > 0 
    ? rooms.filter(room => {
        const roomFloor = parseInt(room.number[0]) || 0;
        return !preferredFloors.includes(roomFloor);
      })
    : [];
  
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
          
          {onManualAssign && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onManualAssign}
              className="flex items-center gap-1 text-sm"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          )}
        </div>
      </div>
      
      {isFloorSelectorOpen && (
        <div className="mb-4 p-3 border rounded-md bg-slate-50">
          <div className="text-sm font-medium mb-2">Étages à afficher:</div>
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
      
      {/* Afficher un message si des chambres sont masquées à cause des filtres d'étage */}
      {hiddenRooms.length > 0 && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>{hiddenRooms.length} chambres masquées</span>
          </div>
          <div className="text-xs text-red-600 mt-1">
            {hiddenRooms.length} chambres sont assignées mais ne sont pas affichées car elles sont sur des étages non sélectionnés.
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs mt-1 text-red-700 hover:text-red-800 hover:bg-red-100 px-2 py-1 h-auto" 
            onClick={() => onFloorPreferenceChange(name, availableFloors)}
          >
            Afficher tous les étages
          </Button>
        </div>
      )}
      
      {/* Affichage par étage si au moins 1 étage visible */}
      {sortedFloorRooms.length > 0 ? (
        <div className="space-y-4">
          {sortedFloorRooms.map(([floor, floorRooms]) => (
            <div key={floor} className="border-t pt-2">
              <div className="text-xs font-semibold mb-1">
                Étage {floor === '0' ? 'RDC' : floor} ({floorRooms.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {sortRoomsByNumber(floorRooms).map(room => (
                  <div 
                    key={room.number} 
                    className="cursor-pointer hover:bg-gray-100 rounded p-1"
                    onClick={() => handleUnassignRoom(room)}
                    title="Cliquer pour retirer l'assignation"
                  >
                    <RoomCard 
                      room={room} 
                      onUpdate={onRoomUpdate} 
                      compact 
                      draggable={draggable}
                      onUnassign={() => handleUnassignRoom(room)}
                      showActions={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : preferredFloors.length > 0 ? (
        <div className="text-center py-4 text-gray-400 border border-dashed rounded-lg">
          Aucune chambre sur les étages sélectionnés
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400 border border-dashed rounded-lg">
          Glissez des chambres ici
        </div>
      )}
    </Card>
  );
}
