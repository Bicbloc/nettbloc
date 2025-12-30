import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Plus, RefreshCw, Trash2, FileText } from "lucide-react";
import { Room } from "@/services/pdfService";

interface ImportConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newRooms: Room[];
  existingRoomNumbers: string[];
  onConfirm: (deleteObsolete: boolean) => void;
  onCancel: () => void;
}

export function ImportConfirmationDialog({
  open,
  onOpenChange,
  newRooms,
  existingRoomNumbers,
  onConfirm,
  onCancel,
}: ImportConfirmationDialogProps) {
  const [deleteObsolete, setDeleteObsolete] = useState(true);

  const newRoomNumbers = new Set(newRooms.map(r => r.number));
  const existingSet = new Set(existingRoomNumbers);

  // Chambres à ajouter (nouvelles, pas dans la DB)
  const roomsToAdd = newRooms.filter(r => !existingSet.has(r.number));
  
  // Chambres à mettre à jour (existent dans les deux)
  const roomsToUpdate = newRooms.filter(r => existingSet.has(r.number));
  
  // Chambres à supprimer (dans la DB mais pas dans le nouveau rapport)
  const roomsToDelete = existingRoomNumbers.filter(num => !newRoomNumbers.has(num));

  const isDuplicateReport = roomsToAdd.length === 0 && roomsToDelete.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Confirmer l'import
          </DialogTitle>
          <DialogDescription>
            {isDuplicateReport 
              ? "Ce rapport semble identique au précédent. Voulez-vous quand même mettre à jour les données ?"
              : "Voici un résumé des changements qui seront effectués :"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rapport potentiellement identique */}
          {isDuplicateReport && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-600">Rapport identique détecté</p>
                <p className="text-sm text-muted-foreground">
                  Les mêmes chambres sont déjà présentes. L'import mettra à jour les statuts.
                </p>
              </div>
            </div>
          )}

          {/* Résumé des changements */}
          <div className="grid grid-cols-3 gap-3">
            {/* Nouvelles chambres */}
            <div className="p-3 bg-green-500/10 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                <Plus className="h-4 w-4" />
                <span className="font-bold text-lg">{roomsToAdd.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">Nouvelles</p>
            </div>

            {/* Mises à jour */}
            <div className="p-3 bg-blue-500/10 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                <RefreshCw className="h-4 w-4" />
                <span className="font-bold text-lg">{roomsToUpdate.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">Mises à jour</p>
            </div>

            {/* Suppressions */}
            <div className="p-3 bg-red-500/10 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                <Trash2 className="h-4 w-4" />
                <span className="font-bold text-lg">{roomsToDelete.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">À supprimer</p>
            </div>
          </div>

          {/* Liste des chambres à supprimer */}
          {roomsToDelete.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Chambres absentes du nouveau rapport :</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={deleteObsolete}
                    onChange={(e) => setDeleteObsolete(e.target.checked)}
                    className="rounded border-muted"
                  />
                  Supprimer
                </label>
              </div>
              <ScrollArea className="h-20">
                <div className="flex flex-wrap gap-1">
                  {roomsToDelete.map((num) => (
                    <Badge key={num} variant="outline" className="text-red-600 border-red-300">
                      {num}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Nouvelles chambres */}
          {roomsToAdd.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Nouvelles chambres :</p>
              <ScrollArea className="h-20">
                <div className="flex flex-wrap gap-1">
                  {roomsToAdd.map((room) => (
                    <Badge key={room.number} variant="outline" className="text-green-600 border-green-300">
                      {room.number}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={() => onConfirm(deleteObsolete)}>
            {isDuplicateReport ? "Mettre à jour quand même" : "Confirmer l'import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
