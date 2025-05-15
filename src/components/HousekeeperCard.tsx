import { Room, CleaningConfig } from "@/services/pdfService";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { RoomCard } from "./RoomCard";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { FileCog, Layers, Plus, AlertTriangle, Trash2, Maximize, Minimize, Settings, FileText, Download } from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { toast } from "@/hooks/use-toast";
import { Input } from "./ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  unassignedRooms?: Room[];
  showUnassignedColumn?: boolean;
  onAssignRoom?: (room: Room) => void;
  onDelete?: (name: string) => void;
  maxRoomsOverride?: number;
  onMaxRoomsOverrideChange?: (name: string, maxRooms: number) => void;
  onRename?: (newName: string) => void;
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
  onManualAssign,
  unassignedRooms = [],
  showUnassignedColumn = false,
  onAssignRoom,
  onDelete,
  maxRoomsOverride,
  onMaxRoomsOverrideChange,
  onRename
}: HousekeeperCardProps) {
  const [isOverloaded, setIsOverloaded] = useState(false);
  const [isUnderloaded, setIsUnderloaded] = useState(false);
  const [workload, setWorkload] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isFloorSelectorOpen, setIsFloorSelectorOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [tempMaxRooms, setTempMaxRooms] = useState(maxRoomsOverride || cleaningConfig.maxRoomsPerHousekeeper);
  const [showMaxRoomsSettings, setShowMaxRoomsSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  
  const effectiveMaxRooms = maxRoomsOverride || cleaningConfig.maxRoomsPerHousekeeper;
  
  // Always show all rooms regardless of selected floors
  const visibleRooms = rooms;
  
  // Group rooms by floor
  const roomsByFloor = visibleRooms.reduce((acc, room) => {
    const floor = parseInt(room.number[0]) || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);
  
  // Show ALL unassigned rooms, not just those from selected floors
  const filteredUnassignedRooms = unassignedRooms.filter(room => !room.assignedTo);
  
  // Group unassigned rooms by floor
  const unassignedRoomsByFloor = filteredUnassignedRooms.reduce((acc, room) => {
    const floor = parseInt(room.number[0]) || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);
  
  useEffect(() => {
    // Calculate estimated time
    const time = rooms.reduce((total, room) => {
      if (room.cleaningType === 'full') {
        return total + cleaningConfig.fullCleaningTime;
      } else if (room.cleaningType === 'quick') {
        return total + cleaningConfig.quickCleaningTime;
      }
      return total;
    }, 0);
    
    setEstimatedTime(time);
    
    // Check min/max constraints
    setIsOverloaded(rooms.length > effectiveMaxRooms);
    setIsUnderloaded(rooms.length < cleaningConfig.minRoomsPerHousekeeper);
    
    // Calculate workload percentage (based on ideal max)
    const idealMaxTime = effectiveMaxRooms * 
      ((cleaningConfig.fullCleaningTime + cleaningConfig.quickCleaningTime) / 2);
    
    setWorkload(Math.min(100, (time / idealMaxTime) * 100));
    
    // Update temp max rooms value if override changes
    if (maxRoomsOverride !== undefined && tempMaxRooms !== maxRoomsOverride) {
      setTempMaxRooms(maxRoomsOverride);
    }
    
    // Update edited name if name prop changes
    if (name !== editedName && !isEditing) {
      setEditedName(name);
    }
  }, [rooms, cleaningConfig, effectiveMaxRooms, maxRoomsOverride, name, isEditing, editedName]);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const roomData = e.dataTransfer.getData('application/json');
      if (roomData) {
        const room = JSON.parse(roomData) as Room;
        // Check if room limit is reached
        if (rooms.length >= effectiveMaxRooms) {
          toast({
            variant: "destructive",
            title: "Limite atteinte",
            description: `Impossible d'assigner plus de ${effectiveMaxRooms} chambres à ${name}. La limite est atteinte.`
          });
          return;
        }
        
        // The room is on an allowed floor, proceed with assignment
        const updatedRoom = { ...room, assignedTo: name };
        onRoomUpdate(updatedRoom);
      }
    } catch (error) {
      console.error("Erreur lors du drop:", error);
    }
  };
  
  // Function to determine room floor from room number
  const getRoomFloor = (roomNumber: string): number => {
    // Ignore years like 2025, 2026, 2027, 2028
    if (/^20(2[5-8])$/.test(roomNumber)) {
      return 0;
    }
    
    // Si c'est juste un chiffre (comme 1, 2, 3) ou deux chiffres (comme 12, 24), c'est RDC
    if (/^\d{1,2}$/.test(roomNumber)) {
      return 0;
    }
    
    // Pour les numéros plus longs, le premier chiffre indique généralement l'étage
    const firstDigit = parseInt(roomNumber.charAt(0));
    return isNaN(firstDigit) ? 0 : firstDigit;
  };
  
  // Revised floor change handler - also gets rooms from other housekeepers
  const handleFloorChange = (floor: number, isChecked: boolean) => {
    const newPreferredFloors = isChecked
      ? [...preferredFloors, floor]
      : preferredFloors.filter(f => f !== floor);
    
    onFloorPreferenceChange(name, newPreferredFloors);
    
    if (isChecked) {
      // Récupérer TOUTES les chambres de cet étage, incluant celles assignées à d'autres
      const allRoomsOnFloor = rooms.filter(room => {
        const roomFloor = getRoomFloor(room.number);
        return roomFloor === floor && room.assignedTo !== name;
      });
      
      // Ajouter les chambres non assignées sur cet étage
      if (unassignedRooms) {
        const unassignedFloorRooms = unassignedRooms.filter(room => {
          const roomFloor = getRoomFloor(room.number);
          return roomFloor === floor && !room.assignedTo;
        });
        
        allRoomsOnFloor.push(...unassignedFloorRooms);
      }
      
      // Log pour debugging
      console.log(`Étage ${floor} - Chambres trouvées:`, allRoomsOnFloor.length);
      console.log("Numéros:", allRoomsOnFloor.map(r => r.number).join(', '));
      
      // Vérifier si l'ajout dépasserait la limite de chambres
      if (rooms.length + allRoomsOnFloor.length > effectiveMaxRooms) {
        toast({
          variant: "destructive",
          title: "Limite dépassée",
          description: `L'ajout de ${allRoomsOnFloor.length} chambres dépasserait la limite de ${effectiveMaxRooms} chambres pour ${name}. Seulement ${effectiveMaxRooms - rooms.length} chambres peuvent être ajoutées.`
        });
        
        // Ne pas ajouter toutes les chambres, mais uniquement jusqu'à la limite
        const availableSlots = effectiveMaxRooms - rooms.length;
        if (availableSlots <= 0) return;
        
        // Prioriser les chambres non assignées et les chambres prioritaires
        const prioritizedRooms = [...allRoomsOnFloor]
          .sort((a, b) => {
            // D'abord les chambres non assignées
            if (!a.assignedTo && b.assignedTo) return -1;
            if (a.assignedTo && !b.assignedTo) return 1;
            // Ensuite par priorité
            if (a.priority === 'high' && b.priority !== 'high') return -1;
            if (b.priority === 'high' && a.priority !== 'high') return 1;
            return 0;
          })
          .slice(0, availableSlots);
        
        prioritizedRooms.forEach(room => {
          const updatedRoom = { ...room, assignedTo: name };
          onRoomUpdate(updatedRoom);
        });
        
        toast({
          description: `${prioritizedRooms.length} chambres de l'étage ${floor === 0 ? 'RDC' : floor} assignées à ${name} (limite atteinte)`
        });
        return;
      }
      
      // Si on a des chambres sur cet étage
      if (allRoomsOnFloor.length > 0 && onRoomUpdate) {
        // Assigner toutes les chambres de cet étage à cette femme de chambre
        allRoomsOnFloor.forEach(room => {
          const updatedRoom = { ...room, assignedTo: name };
          onRoomUpdate(updatedRoom);
        });
        
        toast({
          description: `${allRoomsOnFloor.length} chambre(s) de l'étage ${floor === 0 ? 'RDC' : floor} assignée(s) à ${name}`
        });
      }
    } else {
      // Si on désélectionne un étage, désassigner toutes les chambres de cet étage
      const roomsToUnassign = rooms.filter(room => {
        const roomFloor = getRoomFloor(room.number);
        return roomFloor === floor;
      });
      
      if (roomsToUnassign.length > 0) {
        roomsToUnassign.forEach(room => {
          onRoomUnassign(room);
        });
        
        toast({
          description: `${roomsToUnassign.length} chambre(s) de l'étage ${floor === 0 ? 'RDC' : floor} retirée(s) de ${name}`
        });
      }
    }
  };
  
  const toggleFloorSelector = () => {
    setIsFloorSelectorOpen(!isFloorSelectorOpen);
  };
  
  // Sort rooms by floor and number
  const sortedFloorRooms = Object.entries(roomsByFloor)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));
  
  // Sort unassigned rooms by floor
  const sortedUnassignedFloorRooms = Object.entries(unassignedRoomsByFloor)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));
  
  const sortRoomsByNumber = (rooms: Room[]) => {
    return [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  };

  const handleUnassignRoom = (room: Room) => {
    onRoomUnassign(room);
  };
  
  const handleAssignRoom = (room: Room) => {
    // Vérifier si la limite de chambres est atteinte
    if (rooms.length >= effectiveMaxRooms) {
      toast({
        variant: "destructive",
        title: "Limite atteinte",
        description: `Impossible d'assigner plus de ${effectiveMaxRooms} chambres à ${name}. La limite est atteinte.`
      });
      return;
    }
    
    // Plus de vérification d'étage - on peut maintenant assigner n'importe quelle chambre
    if (onAssignRoom) {
      onAssignRoom(room);
    }
  };
  
  const handleDeleteHousekeeper = () => {
    if (onDelete) {
      if (rooms.length > 0) {
        // Confirmation avant suppression si des chambres sont assignées
        setShowDeleteConfirm(true);
      } else {
        // Suppression directe si aucune chambre assignée
        onDelete(name);
        toast({
          description: `${name} a été supprimé(e)`
        });
      }
    }
  };
  
  const confirmDelete = () => {
    if (onDelete) {
      onDelete(name);
      setShowDeleteConfirm(false);
      toast({
        description: `${name} a été supprimé(e). ${rooms.length} chambre(s) ont été désassignées.`
      });
    }
  };
  
  // This no longer filters out rooms because we're showing all rooms now
  const hiddenRooms: Room[] = [];
  
  const toggleExpand = () => {
    setExpanded(!expanded);
  };
  
  const handleMaxRoomsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setTempMaxRooms(value);
    }
  };
  
  const saveMaxRooms = () => {
    if (onMaxRoomsOverrideChange) {
      onMaxRoomsOverrideChange(name, tempMaxRooms);
      toast({
        description: `Limite de chambres pour ${name} modifiée à ${tempMaxRooms}`
      });
    }
    setShowMaxRoomsSettings(false);
  };
  
  const handleNameEdit = () => {
    setIsEditing(true);
  };
  
  const handleNameSave = () => {
    if (editedName.trim() && onRename) {
      onRename(editedName.trim());
    } else {
      setEditedName(name);
    }
    setIsEditing(false);
  };
  
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setEditedName(name);
      setIsEditing(false);
    }
  };
  
  return (
    <>
      <Card 
        className={cn(
          "border rounded-lg",
          isOverloaded && "border-red-400",
          isUnderloaded && "border-amber-400"
        )}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <CardHeader className="p-4 pb-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div className="flex gap-1">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    className="h-8 text-lg font-bold py-1 px-2"
                    autoFocus
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleNameSave}
                    className="h-8"
                  >
                    OK
                  </Button>
                </div>
              ) : (
                <h3 
                  className="font-bold text-lg cursor-pointer hover:underline"
                  onClick={handleNameEdit}
                  title="Cliquer pour modifier le nom"
                >
                  {name}
                </h3>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpand}
                className="h-6 w-6 p-0"
                title={expanded ? "Minimiser" : "Maximiser"}
              >
                {expanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
            
            <div className="flex gap-1">
              <Popover open={showMaxRoomsSettings} onOpenChange={setShowMaxRoomsSettings}>
                <PopoverTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    title="Configurer la limite de chambres"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Limite de chambres</h4>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min="1"
                        value={tempMaxRooms}
                        onChange={handleMaxRoomsChange}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">chambres</span>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={saveMaxRooms}>Appliquer</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              {onDelete && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={handleDeleteHousekeeper}
                  title="Supprimer cette femme de chambre"
                  className="text-red-500 hover:text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              
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
                <FileText className="h-4 w-4" /> Rapport
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
          
          {expanded && (
            <div className="mb-4 mt-3">
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
                <span>Max: {effectiveMaxRooms} chambres</span>
              </div>
            </div>
          )}
        </CardHeader>
          
        {expanded && (
          <CardContent className="p-4 pt-2">
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
                <p className="text-xs text-gray-500 mt-2">
                  Lorsqu'un étage est sélectionné, toutes les chambres de cet étage sont automatiquement assignées.
                </p>
              </div>
            )}
            
            {isOverloaded && (
              <div className="text-red-500 text-xs mb-2">
                ⚠️ Trop de chambres assignées (limite: {effectiveMaxRooms})
              </div>
            )}
            
            {isUnderloaded && rooms.length > 0 && (
              <div className="text-amber-500 text-xs mb-2">
                ⚠️ Pas assez de chambres assignées (min: {cleaningConfig.minRoomsPerHousekeeper})
              </div>
            )}
            
            {/* Display unassigned column if showUnassignedColumn is true */}
            {showUnassignedColumn && (
              <div className="mb-6 pb-4 border-b-2 border-red-300">
                <div className="text-red-600 font-bold mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Chambres non assignées</span>
                </div>
                {filteredUnassignedRooms.length > 0 ? (
                  sortedUnassignedFloorRooms.length > 0 ? (
                    <div className="space-y-2">
                      {sortedUnassignedFloorRooms.map(([floor, floorRooms]) => (
                        <div key={`unassigned-${floor}`} className="pt-1">
                          <div className="text-xs font-semibold mb-1">
                            Étage {floor === '0' ? 'RDC' : floor} ({floorRooms.length})
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {sortRoomsByNumber(floorRooms).map(room => (
                              <div 
                                key={`unassigned-${room.number}`} 
                                className="cursor-pointer hover:bg-gray-100 rounded p-1"
                                onClick={() => handleAssignRoom(room)}
                                title="Cliquer pour assigner à cette personne"
                              >
                                <RoomCard 
                                  room={room} 
                                  onUpdate={onRoomUpdate}
                                  compact 
                                  draggable={draggable}
                                  showActions={true}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-gray-500 border border-dashed rounded-lg">
                      Aucune chambre non assignée sur les étages sélectionnés
                    </div>
                  )
                ) : (
                  <div className="text-center py-3 text-gray-500 border border-dashed rounded-lg">
                    Toutes les chambres sont assignées
                  </div>
                )}
              </div>
            )}
            
            {/* Display assigned rooms by floor */}
            <div className="mt-4">
              <h4 className="text-slate-600 font-bold mb-2">Chambres assignées</h4>
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
              ) : (
                <div className="text-center py-4 text-gray-400 border border-dashed rounded-lg">
                  Glissez des chambres ici
                </div>
              )}
            </div>
          </CardContent>
        )}
        
        {!expanded && (
          <CardContent className="p-4 pt-0">
            <div className="flex justify-between text-sm">
              <span>{rooms.length} chambres</span>
              <span>{estimatedTime} min</span>
              {isOverloaded && <span className="text-red-500">Surcharge</span>}
              {isUnderloaded && rooms.length > 0 && <span className="text-amber-500">Sous-charge</span>}
            </div>
          </CardContent>
        )}
      </Card>
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va supprimer la femme de chambre "{name}" et désassigner ses {rooms.length} chambres. Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
