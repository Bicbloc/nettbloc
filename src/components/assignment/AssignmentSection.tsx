
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
              onSelect={onRoomSelect}
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
        <Button onClick={onAssign}>
          Assigner {selectedRooms.length} chambre(s)
        </Button>
      </div>
    </div>
  );
}
