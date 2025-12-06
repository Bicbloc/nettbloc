import { Room, CleaningConfig } from "@/services/pdfService";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { RoomCard } from "./RoomCard";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { FileCog, Layers, Plus, AlertTriangle, Trash2, Maximize, Minimize, Settings, FileText, Download, Key } from "lucide-react";
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
import { getRoomFloor } from "@/utils/roomUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface HousekeeperCardProps {
  name: string;
  rooms: Room[];
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onReassign?: (room: Room, newHousekeeper: string | null) => void;
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
  accessCode?: string;
  housekeeperNames?: string[];
  onGenerateAccessCode?: (housekeeperName: string) => void;
  hotelId?: string;
}

export function HousekeeperCard({ 
  name, 
  rooms, 
  onRoomUpdate,
  onReassign,
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
  onRename,
  accessCode,
  housekeeperNames = [],
  onGenerateAccessCode,
  hotelId
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
  
  const effectiveMaxRooms = maxRoomsOverride || cleaningConfig.maxRoomsPerHousekeeper;

  // Modification: Filter rooms to show only those from preferred floors when preferredFloors is not empty
  const visibleRooms = preferredFloors.length > 0
    ? rooms.filter(room => preferredFloors.includes(getRoomFloor(room.number)))
    : rooms;
  
  // Group rooms by floor
  const roomsByFloor = visibleRooms.reduce((acc, room) => {
    const floor = getRoomFloor(room.number);
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);
  
  // Modification: Show both unassigned rooms AND rooms assigned to this housekeeper that are on floors not in preferredFloors
  const filteredUnassignedRooms = [
    ...unassignedRooms.filter(room => !room.assignedTo),
    ...rooms.filter(room => !preferredFloors.includes(getRoomFloor(room.number)))
  ];
  
  // Group unassigned rooms by floor
  const unassignedRoomsByFloor = filteredUnassignedRooms.reduce((acc, room) => {
    const floor = getRoomFloor(room.number);
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
        
        // MODIFIED: We no longer block room assignment if already assigned to another housekeeper
        // Just show a notification but allow the force reassignment
        if (room.assignedTo && room.assignedTo !== name) {
          toast({
            description: `La chambre ${room.number} a été réassignée de ${room.assignedTo} à ${name}.`
          });
        }
        
        // The room is allowed to be assigned, proceed with assignment
        const updatedRoom = { ...room, assignedTo: name };
        onRoomUpdate(updatedRoom);
      }
    } catch (error) {
      console.error("Erreur lors du drop:", error);
    }
  };
  
  // Revised floor change handler - modified to ensure ALL rooms on a floor are assigned
  const handleFloorChange = (floor: number, isChecked: boolean) => {
    const newPreferredFloors = isChecked
      ? [...preferredFloors, floor]
      : preferredFloors.filter(f => f !== floor);
    
    onFloorPreferenceChange(name, newPreferredFloors);
    
    if (isChecked) {
      // Get ALL rooms from this floor, even if already assigned to other housekeepers
      const floorRooms = unassignedRooms.filter(room => {
        const roomFloor = getRoomFloor(room.number);
        return roomFloor === floor;
      });
      
      // Log for debugging
      console.log(`Étage ${floor} - Chambres trouvées:`, floorRooms.length);
      console.log("Numéros:", floorRooms.map(r => r.number).join(', '));
      
      // Check if adding all rooms would exceed the limit
      if (rooms.length + floorRooms.length > effectiveMaxRooms) {
        toast({
          variant: "destructive",
          title: "Limite dépassée",
          description: `L'ajout de ${floorRooms.length} chambres dépasserait la limite de ${effectiveMaxRooms} chambres pour ${name}. Seulement ${effectiveMaxRooms - rooms.length} chambres peuvent être ajoutées.`
        });
        
        // Don't add all rooms, only up to the limit
        const availableSlots = effectiveMaxRooms - rooms.length;
        if (availableSlots <= 0) return;
        
        // Prioritize high priority rooms
        const prioritizedRooms = [...floorRooms]
          .sort((a, b) => {
            // First by priority
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
      
      // If we have rooms on this floor, assign ALL of them to this housekeeper
      if (floorRooms.length > 0 && onRoomUpdate) {
        // Force assign all rooms on this floor to this housekeeper
        floorRooms.forEach(room => {
          // If room is already assigned to someone else, we need to force reassign
          if (room.assignedTo && room.assignedTo !== name) {
            console.log(`Réassignation de chambre ${room.number} de ${room.assignedTo} à ${name}`);
          }
          
          const updatedRoom = { ...room, assignedTo: name };
          onRoomUpdate(updatedRoom);
        });
        
        toast({
          description: `${floorRooms.length} chambre(s) de l'étage ${floor === 0 ? 'RDC' : floor} assignée(s) à ${name}`
        });
      }
    } else {
      // When deselecting a floor, unassign all rooms from this floor
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
    // Check if room limit is reached
    if (rooms.length >= effectiveMaxRooms) {
      toast({
        variant: "destructive",
        title: "Limite atteinte",
        description: `Impossible d'assigner plus de ${effectiveMaxRooms} chambres à ${name}. La limite est atteinte.`
      });
      return;
    }
    
    // MODIFIED: We no longer block room assignment if already assigned to another housekeeper
    // Just show a notification but allow the force reassignment
    if (room.assignedTo && room.assignedTo !== name) {
      toast({
        description: `La chambre ${room.number} a été réassignée de ${room.assignedTo} à ${name}.`
      });
    }
    
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
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">
                    {name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNameEdit}
                    className="h-6 px-2 text-xs opacity-70 hover:opacity-100"
                    title="Modifier le nom"
                  >
                    ✏️
                  </Button>
                  {accessCode ? (
                    <div className="bg-primary/10 px-3 py-2 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary" />
                        <span className="font-mono font-bold text-primary text-base md:text-sm">
                          {accessCode}
                        </span>
                      </div>
                      <div className="text-xs text-primary/70 mt-1 md:hidden">
                        Code d'accès mobile
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateAccessCode?.(name)}
                      className="h-8 px-3 text-sm md:h-6 md:px-2 md:text-xs"
                      title="Générer un code d'accès"
                    >
                      <Key className="h-4 w-4 mr-1 md:h-3 md:w-3" />
                      <span className="md:hidden">Générer Code</span>
                      <span className="hidden md:inline">Code</span>
                    </Button>
                  )}
                </div>
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
            {/* Affichage du code d'accès */}
            {accessCode && (
              <div className="bg-muted/50 p-2 rounded text-center mb-4">
                <div className="text-xs text-muted-foreground">Code d'accès mobile</div>
                <div className="font-mono font-bold text-lg text-primary">
                  {accessCode}
                </div>
                <div className="text-xs text-muted-foreground">Pour l'interface mobile</div>
              </div>
            )}
            
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
                           <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                             {sortRoomsByNumber(floorRooms).map(room => (
                               <div 
                                 key={`unassigned-${room.number}`} 
                                 className="min-w-0 cursor-pointer hover:bg-gray-100 rounded p-1"
                                 onClick={() => handleAssignRoom(room)}
                                title="Cliquer pour assigner à cette personne"
                              >
                                <RoomCard 
                                  room={room} 
                                  onUpdate={onRoomUpdate}
                                  compact 
                                  draggable={draggable}
                                  showActions={true}
                                  hotelId={hotelId}
                                  incidentCount={incidentCounts?.[room.number] || 0}
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
                       <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                         {sortRoomsByNumber(floorRooms).map(room => (
                           <div 
                             key={room.number} 
                             className="min-w-0"
                           >
                              <RoomCard 
                                room={room} 
                                onUpdate={onRoomUpdate}
                                onReassign={onReassign}
                                onUnassign={() => handleUnassignRoom(room)}
                                housekeeperNames={housekeeperNames}
                                compact 
                                draggable={draggable}
                                showActions={true}
                                hotelId={hotelId}
                                incidentCount={incidentCounts?.[room.number] || 0}
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
