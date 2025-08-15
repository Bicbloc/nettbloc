import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Room } from '@/services/pdfService';
import { ArrowRight, UserMinus, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface RoomReassignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  housekeeperNames: string[];
  onReassign: (room: Room, newHousekeeper: string | null) => void;
}

export function RoomReassignmentDialog({
  open,
  onOpenChange,
  room,
  housekeeperNames,
  onReassign
}: RoomReassignmentDialogProps) {
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>('');

  const handleReassign = () => {
    if (selectedHousekeeper === 'unassigned') {
      onReassign(room, null);
      toast({
        description: `Chambre ${room.number} désassignée de ${room.assignedTo}`
      });
    } else {
      onReassign(room, selectedHousekeeper);
      toast({
        description: `Chambre ${room.number} réassignée ${room.assignedTo ? `de ${room.assignedTo} ` : ''}à ${selectedHousekeeper}`
      });
    }
    onOpenChange(false);
    setSelectedHousekeeper('');
  };

  const availableHousekeepers = housekeeperNames.filter(name => name !== room.assignedTo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Réassigner la chambre {room.number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Actuellement assignée à :</p>
            <p className="font-medium">
              {room.assignedTo || 'Non assignée'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Réassigner à :</label>
            <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une femme de chambre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <div className="flex items-center gap-2">
                    <UserMinus className="h-4 w-4" />
                    Désassigner (retour au pool)
                  </div>
                </SelectItem>
                {availableHousekeepers.map(name => (
                  <SelectItem key={name} value={name}>
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      {name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annuler
            </Button>
            <Button 
              onClick={handleReassign} 
              disabled={!selectedHousekeeper}
              className="flex-1"
            >
              Réassigner
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}