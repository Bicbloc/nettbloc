
import { Room } from "@/services/pdfService";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RoomCard } from "@/components/RoomCard";

interface AssignmentSectionProps {
  housekeeperNames: string[];
  selectedHousekeeper: string;
  setSelectedHousekeeper: (name: string) => void;
  selectedRooms: Room[];
  onRoomSelect: (room: Room) => void;
  onAssign: () => void;
  onClose: () => void;
}

export function AssignmentSection({
  housekeeperNames,
  selectedHousekeeper,
  setSelectedHousekeeper,
  selectedRooms,
  onRoomSelect,
  onAssign,
  onClose
}: AssignmentSectionProps) {
  return (
    <div className="col-span-5 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="housekeeper-select" className="text-sm font-medium">
          Femme de chambre
        </Label>
        <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
          <SelectTrigger id="housekeeper-select" className="h-10">
            <SelectValue placeholder="Sélectionner une femme de chambre" />
          </SelectTrigger>
          <SelectContent>
            {housekeeperNames.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Chambres sélectionnées ({selectedRooms.length})
        </Label>
        <ScrollArea className="h-[280px] border rounded-md p-3 bg-muted/20">
          <div className="grid grid-cols-1 gap-2">
            {selectedRooms.map(room => (
              <div key={room.number} className="bg-background border rounded-lg p-2 hover:bg-accent/50 transition-colors">
                <RoomCard
                  room={room}
                  onUpdate={() => {}}
                  compact
                  selectable
                  isSelected={true}
                  onSelect={onRoomSelect}
                />
              </div>
            ))}
            
            {selectedRooms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-sm">Aucune chambre sélectionnée</div>
                <div className="text-xs mt-1">Cliquez sur les chambres à gauche pour les sélectionner</div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
          Annuler
        </Button>
        <Button 
          onClick={onAssign} 
          disabled={!selectedHousekeeper || selectedRooms.length === 0}
          className="flex-1 sm:flex-none"
        >
          Assigner {selectedRooms.length} chambre(s)
        </Button>
      </div>
    </div>
  );
}
