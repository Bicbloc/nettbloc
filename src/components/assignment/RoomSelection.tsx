
import { Room } from "@/services/pdfService";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RoomCard } from "@/components/RoomCard";

interface RoomSelectionProps {
  title: string;
  rooms: Room[];
  onSelect?: (room: Room) => void;
  isSelected?: (room: Room) => boolean;
  emptyMessage: string;
}

export function RoomSelection({
  title,
  rooms,
  onSelect,
  isSelected = () => false,
  emptyMessage
}: RoomSelectionProps) {
  return (
    <>
      <Label className="mb-2 block">{title} ({rooms.length})</Label>
      <ScrollArea className="h-[400px] border rounded-md p-2">
        <div className="grid grid-cols-3 gap-2">
          {rooms.map(room => (
            <RoomCard
              key={room.number}
              room={room}
              onUpdate={() => {}}
              compact
              selectable={!!onSelect}
              isSelected={isSelected(room)}
              onSelect={onSelect}
            />
          ))}
          
          {rooms.length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-500">
              {emptyMessage}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
