import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Room } from "@/services/pdfService";

interface DeleteRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  onDeleteRoom: (roomNumber: string) => void;
}

export function DeleteRoomDialog({ open, onOpenChange, room, onDeleteRoom }: DeleteRoomDialogProps) {
  const handleConfirmDelete = () => {
    onDeleteRoom(room.number);
    onOpenChange(false);
  };

  const hasLinkedRooms = room.linkedRooms && room.linkedRooms.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la chambre {room.number}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Êtes-vous sûr de vouloir supprimer cette chambre ? Cette action est irréversible.</p>
            
            {room.assignedTo && (
              <p className="text-orange-600">
                ⚠️ Cette chambre est assignée à <strong>{room.assignedTo}</strong>
              </p>
            )}
            
            {hasLinkedRooms && (
              <p className="text-orange-600">
                ⚠️ Cette chambre est liée aux chambres : <strong>{room.linkedRooms?.join(', ')}</strong>
                <br />
                <span className="text-sm">Les liaisons seront automatiquement supprimées.</span>
              </p>
            )}
            
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <strong>Informations de la chambre :</strong>
              <ul className="mt-1 space-y-1">
                <li>• Statut : {room.status}</li>
                <li>• Type de nettoyage : {room.cleaningType}</li>
                <li>• Priorité : {room.priority}</li>
                {room.floor && <li>• Étage : {room.floor}</li>}
                {room.isTwin && <li>• Chambre twin</li>}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirmDelete}
            className="bg-red-600 hover:bg-red-700"
          >
            Supprimer la chambre
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}