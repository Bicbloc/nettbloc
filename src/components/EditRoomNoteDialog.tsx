import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Room } from "@/services/pdfService";
import { MessageSquare, Loader2 } from "lucide-react";

interface EditRoomNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  hotelId: string;
  onNoteUpdated: (room: Room, newNote: string) => void;
}

export function EditRoomNoteDialog({
  open,
  onOpenChange,
  room,
  hotelId,
  onNoteUpdated
}: EditRoomNoteDialogProps) {
  const [note, setNote] = useState(room.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ notes: note || null })
        .eq('hotel_id', hotelId)
        .eq('room_number', room.number);

      if (error) throw error;

      onNoteUpdated(room, note);
      toast({
        title: "Commentaire mis à jour",
        description: `Chambre ${room.number} : commentaire ${note ? 'modifié' : 'supprimé'}`
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur mise à jour commentaire:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour le commentaire"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600" />
            Commentaire - Chambre {room.number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="room-note">Commentaire</Label>
            <Textarea
              id="room-note"
              placeholder="Ajouter un commentaire pour cette chambre..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
          
          {room.notes && (
            <p className="text-xs text-muted-foreground">
              Commentaire actuel: {room.notes}
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          {room.notes && (
            <Button 
              variant="destructive" 
              onClick={() => {
                setNote("");
                handleSave();
              }}
              disabled={isSaving}
            >
              Supprimer
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}