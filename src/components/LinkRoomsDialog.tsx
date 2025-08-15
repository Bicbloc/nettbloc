import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { toast } from "@/hooks/use-toast";
import { Link, Unlink } from "lucide-react";

interface LinkRoomsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  allRooms: Room[];
  onLinkRooms: (roomNumber: string, linkedRoomNumbers: string[]) => void;
}

export function LinkRoomsDialog({ open, onOpenChange, room, allRooms, onLinkRooms }: LinkRoomsDialogProps) {
  const [selectedRooms, setSelectedRooms] = useState<string[]>(room.linkedRooms || []);

  // Filtrer les chambres disponibles (exclure la chambre actuelle)
  const availableRooms = allRooms.filter(r => r.number !== room.number);

  const handleRoomToggle = (roomNumber: string, checked: boolean) => {
    if (checked) {
      setSelectedRooms(prev => [...prev, roomNumber]);
    } else {
      setSelectedRooms(prev => prev.filter(r => r !== roomNumber));
    }
  };

  const handleSave = () => {
    onLinkRooms(room.number, selectedRooms);
    
    if (selectedRooms.length > 0) {
      toast({
        title: "Chambres liées",
        description: `Chambre ${room.number} liée avec ${selectedRooms.length} chambre(s) : ${selectedRooms.join(', ')}`,
      });
    } else {
      toast({
        title: "Liaisons supprimées",
        description: `Toutes les liaisons de la chambre ${room.number} ont été supprimées`,
      });
    }
    
    onOpenChange(false);
  };

  const handleUnlinkAll = () => {
    setSelectedRooms([]);
  };

  // Grouper les chambres par étage
  const roomsByFloor = availableRooms.reduce((acc, room) => {
    const floor = room.floor || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  const currentLinkedCount = room.linkedRooms?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Lier la chambre {room.number}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>Sélectionnez les chambres à connecter avec la chambre {room.number} (suites, chambres communicantes, etc.)</p>
            
            {currentLinkedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Actuellement liée avec :</span>
                {room.linkedRooms?.map(linkedRoom => (
                  <Badge key={linkedRoom} variant="secondary">
                    {linkedRoom}
                  </Badge>
                ))}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium">
              Chambres sélectionnées : {selectedRooms.length}
            </p>
            {selectedRooms.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlinkAll}
                className="gap-2"
              >
                <Unlink className="h-4 w-4" />
                Tout délier
              </Button>
            )}
          </div>

          <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
            {Object.keys(roomsByFloor).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Aucune autre chambre disponible
              </p>
            ) : (
              Object.entries(roomsByFloor)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([floor, rooms]) => (
                  <div key={floor} className="mb-4 last:mb-0">
                    <h4 className="font-medium mb-2 text-sm text-muted-foreground">
                      Étage {floor || 'Non spécifié'}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {rooms
                        .sort((a, b) => a.number.localeCompare(b.number))
                        .map((availableRoom) => (
                          <div
                            key={availableRoom.number}
                            className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50"
                          >
                            <Checkbox
                              id={`room-${availableRoom.number}`}
                              checked={selectedRooms.includes(availableRoom.number)}
                              onCheckedChange={(checked) => 
                                handleRoomToggle(availableRoom.number, checked as boolean)
                              }
                            />
                            <label
                              htmlFor={`room-${availableRoom.number}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="font-medium">{availableRoom.number}</div>
                              <div className="text-xs text-muted-foreground">
                                {availableRoom.status} • {availableRoom.cleaningType}
                                {availableRoom.assignedTo && (
                                  <span className="ml-1">• {availableRoom.assignedTo}</span>
                                )}
                              </div>
                            </label>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
            )}
          </div>

          {selectedRooms.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Chambres qui seront liées :</strong>
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedRooms.map(roomNumber => (
                  <Badge key={roomNumber} variant="secondary">
                    {roomNumber}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            {selectedRooms.length > 0 ? 'Sauvegarder les liaisons' : 'Supprimer toutes les liaisons'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}