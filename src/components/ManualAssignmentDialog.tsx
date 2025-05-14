
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Room } from "@/services/pdfService";
import { Button } from "@/components/ui/button";
import { RoomCard } from "@/components/RoomCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

interface ManualAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  housekeeperNames: string[];
  onAssignRooms: (housekeeperName: string, rooms: Room[]) => void;
}

export function ManualAssignmentDialog({
  isOpen,
  onClose,
  rooms,
  housekeeperNames,
  onAssignRooms,
}: ManualAssignmentDialogProps) {
  const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Reset selections when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedRooms([]);
      setSelectedHousekeeper(housekeeperNames.length > 0 ? housekeeperNames[0] : "");
      setSearchTerm("");
      setFilterFloor("all");
      setFilterStatus("all");
    }
  }, [isOpen, housekeeperNames]);
  
  // Apply filters to rooms
  useEffect(() => {
    let result = [...rooms];
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter(room => 
        room.number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply floor filter
    if (filterFloor !== "all") {
      const floorNum = parseInt(filterFloor);
      result = result.filter(room => {
        const roomFloor = room.floor !== undefined ? room.floor : parseInt(room.number[0]);
        return roomFloor === floorNum;
      });
    }
    
    // Apply status filter
    if (filterStatus !== "all") {
      result = result.filter(room => room.status === filterStatus);
    }
    
    // Sort by room number
    result.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    
    setFilteredRooms(result);
  }, [rooms, searchTerm, filterFloor, filterStatus]);
  
  const handleRoomSelect = (room: Room) => {
    setSelectedRooms(prev => {
      const isSelected = prev.some(r => r.number === room.number);
      
      if (isSelected) {
        return prev.filter(r => r.number !== room.number);
      } else {
        return [...prev, room];
      }
    });
  };
  
  const handleAssign = () => {
    if (selectedRooms.length === 0) {
      toast({
        title: "Aucune chambre sélectionnée",
        description: "Veuillez sélectionner au moins une chambre à assigner.",
        variant: "destructive"
      });
      return;
    }
    
    if (!selectedHousekeeper) {
      toast({
        title: "Aucune femme de chambre sélectionnée",
        description: "Veuillez sélectionner une femme de chambre.",
        variant: "destructive"
      });
      return;
    }
    
    onAssignRooms(selectedHousekeeper, selectedRooms);
    toast({
      title: "Chambres assignées",
      description: `${selectedRooms.length} chambre(s) assignée(s) à ${selectedHousekeeper}`,
    });
    onClose();
  };
  
  // Get available floors from rooms
  const availableFloors = Array.from(
    new Set(
      rooms.map(room => room.floor !== undefined ? room.floor : parseInt(room.number[0]))
    )
  ).sort((a, b) => a - b);
  
  const selectAll = () => {
    setSelectedRooms(filteredRooms);
  };
  
  const clearSelection = () => {
    setSelectedRooms([]);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Assigner manuellement des chambres</DialogTitle>
          <DialogDescription>
            Sélectionnez les chambres et assignez-les à une femme de chambre
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-12 gap-4">
          {/* Filters */}
          <div className="col-span-12 grid grid-cols-4 gap-2">
            <div>
              <Label htmlFor="search">Recherche</Label>
              <Input
                id="search"
                placeholder="Numéro de chambre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="floor-filter">Étage</Label>
              <Select value={filterFloor} onValueChange={setFilterFloor}>
                <SelectTrigger id="floor-filter">
                  <SelectValue placeholder="Tous les étages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les étages</SelectItem>
                  {availableFloors.map(floor => (
                    <SelectItem key={floor} value={floor.toString()}>
                      {floor === 0 ? "RDC" : `Étage ${floor}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status-filter">Statut</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="needs-cleaning">À nettoyer</SelectItem>
                  <SelectItem value="clean">Propre</SelectItem>
                  <SelectItem value="occupied">Occupé</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 items-end">
              <Button variant="outline" className="flex-1" onClick={selectAll}>
                Tout sélectionner
              </Button>
              <Button variant="outline" className="flex-1" onClick={clearSelection}>
                Effacer
              </Button>
            </div>
          </div>
          
          {/* Room Selection */}
          <div className="col-span-7">
            <Label className="mb-2 block">Chambres disponibles ({filteredRooms.length})</Label>
            <ScrollArea className="h-[400px] border rounded-md p-2">
              <div className="grid grid-cols-3 gap-2">
                {filteredRooms.map(room => (
                  <RoomCard
                    key={room.number}
                    room={room}
                    onUpdate={() => {}}
                    compact
                    selectable
                    isSelected={selectedRooms.some(r => r.number === room.number)}
                    onSelect={handleRoomSelect}
                  />
                ))}
                
                {filteredRooms.length === 0 && (
                  <div className="col-span-3 text-center py-8 text-gray-500">
                    Aucune chambre ne correspond aux critères de recherche
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Assignment Section */}
          <div className="col-span-5">
            <div className="mb-4">
              <Label htmlFor="housekeeper-select" className="mb-2 block">
                Femme de chambre
              </Label>
              <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
                <SelectTrigger id="housekeeper-select">
                  <SelectValue placeholder="Sélectionner une femme de chambre" />
                </SelectTrigger>
                <SelectContent>
                  {housekeeperNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Label className="mb-2 block">Chambres sélectionnées ({selectedRooms.length})</Label>
            <ScrollArea className="h-[300px] border rounded-md p-2">
              <div className="grid grid-cols-2 gap-2">
                {selectedRooms.map(room => (
                  <RoomCard
                    key={room.number}
                    room={room}
                    onUpdate={() => {}}
                    compact
                    selectable
                    isSelected={true}
                    onSelect={handleRoomSelect}
                  />
                ))}
                
                {selectedRooms.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    Aucune chambre sélectionnée
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={handleAssign}>
                Assigner {selectedRooms.length} chambre(s)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
