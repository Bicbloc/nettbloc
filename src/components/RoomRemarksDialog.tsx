import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { Room } from '@/services/pdfService';
import { toast } from '@/hooks/use-toast';

interface RoomRemarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  onUpdateRoom: (room: Room) => void;
}

export function RoomRemarksDialog({
  open,
  onOpenChange,
  room,
  onUpdateRoom
}: RoomRemarksDialogProps) {
  const [adminNotes, setAdminNotes] = useState(room.notes || '');
  const [housekeeperRemarks, setHousekeeperRemarks] = useState(room.remark || '');

  useEffect(() => {
    if (open) {
      setAdminNotes(room.notes || '');
      setHousekeeperRemarks(room.remark || '');
    }
  }, [open, room]);

  const handleSave = () => {
    const updatedRoom = {
      ...room,
      notes: adminNotes.trim() || undefined,
      remark: housekeeperRemarks.trim() || undefined,
      status: housekeeperRemarks.trim() ? 'needs-attention' : room.status
    };

    onUpdateRoom(updatedRoom);
    
    toast({
      title: "Remarques sauvegardées",
      description: `Remarques mises à jour pour la chambre ${room.number}`
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Remarques - Chambre {room.number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Notes d'administration */}
          <div className="space-y-2">
            <Label htmlFor="admin-notes" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              Notes d'administration (apparaîtront sur le rapport PDF)
            </Label>
            <Textarea
              id="admin-notes"
              placeholder="Notes internes, instructions spéciales..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Ces notes apparaîtront sur le rapport PDF pour le client.
            </p>
          </div>

          {/* Remarques des femmes de chambre */}
          <div className="space-y-2">
            <Label htmlFor="housekeeper-remarks" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              Remarques de la femme de chambre
            </Label>
            <Textarea
              id="housekeeper-remarks"
              placeholder="Problèmes rencontrés, éléments cassés, demandes spéciales..."
              value={housekeeperRemarks}
              onChange={(e) => setHousekeeperRemarks(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Ces remarques seront visibles par le client et marqueront la chambre comme nécessitant une attention.
            </p>
          </div>

          {/* Boutons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Sauvegarder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}