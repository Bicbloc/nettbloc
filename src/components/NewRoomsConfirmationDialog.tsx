import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Plus, X, Home, CheckCircle2 } from 'lucide-react';

interface NewRoom {
  room_number: string;
  floor?: number | null;
  room_type?: string | null;
}

interface NewRoomsConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  newRooms: NewRoom[];
  existingRoomsCount: number;
  onConfirm: (selectedRooms: NewRoom[]) => void;
  onSkip: () => void;
}

export const NewRoomsConfirmationDialog: React.FC<NewRoomsConfirmationDialogProps> = ({
  isOpen,
  onClose,
  newRooms,
  existingRoomsCount,
  onConfirm,
  onSkip,
}) => {
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(
    new Set(newRooms.map(r => r.room_number))
  );

  const toggleRoom = (roomNumber: string) => {
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(roomNumber)) {
      newSelection.delete(roomNumber);
    } else {
      newSelection.add(roomNumber);
    }
    setSelectedRooms(newSelection);
  };

  const toggleAll = () => {
    if (selectedRooms.size === newRooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(newRooms.map(r => r.room_number)));
    }
  };

  const handleConfirm = () => {
    const roomsToAdd = newRooms.filter(r => selectedRooms.has(r.room_number));
    onConfirm(roomsToAdd);
    onClose();
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Nouvelles chambres détectées
          </DialogTitle>
          <DialogDescription>
            L'analyse a détecté <strong>{newRooms.length} chambre(s)</strong> qui n'existe(nt) pas dans votre registre permanent.
            Le registre contient actuellement <strong>{existingRoomsCount} chambres</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Chambres à ajouter au registre</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
              className="text-xs"
            >
              {selectedRooms.size === newRooms.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
          </div>

          <ScrollArea className="h-[200px] border rounded-lg p-2">
            <div className="space-y-2">
              {newRooms.map((room) => (
                <div
                  key={room.room_number}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                    selectedRooms.has(room.room_number)
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => toggleRoom(room.room_number)}
                >
                  <Checkbox
                    checked={selectedRooms.has(room.room_number)}
                    onCheckedChange={() => toggleRoom(room.room_number)}
                  />
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="font-medium">Chambre {room.room_number}</span>
                    {room.floor && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Étage {room.floor}
                      </Badge>
                    )}
                    {room.room_type && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {room.room_type}
                      </Badge>
                    )}
                  </div>
                  {selectedRooms.has(room.room_number) && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <p className="text-xs text-muted-foreground mt-3">
            Le registre des chambres est votre référence permanente. Les chambres non ajoutées au registre seront utilisées pour aujourd'hui uniquement.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSkip} className="w-full sm:w-auto">
            <X className="h-4 w-4 mr-2" />
            Ne pas ajouter au registre
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedRooms.size === 0}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter {selectedRooms.size > 0 ? `(${selectedRooms.size})` : ''} au registre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
