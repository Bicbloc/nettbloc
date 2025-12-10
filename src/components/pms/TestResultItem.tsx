import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Pencil, AlertTriangle } from "lucide-react";
import { ExtractedRoom, CleaningType } from "@/services/pms";

interface TestResultItemProps {
  room: ExtractedRoom;
  index: number;
  onValidate: (index: number) => void;
  onRemove: (index: number) => void;
  onModify: (index: number, updates: Partial<ExtractedRoom>) => void;
}

export const TestResultItem = ({ 
  room, 
  index, 
  onValidate, 
  onRemove, 
  onModify 
}: TestResultItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRoom, setEditedRoom] = useState({
    roomNumber: room.roomNumber,
    status: room.status || '',
    cleaningType: room.cleaningType
  });

  const isLikelyError = 
    /^\d{4}$/.test(room.roomNumber) && parseInt(room.roomNumber) >= 1900 && parseInt(room.roomNumber) <= 2100 ||
    /^\d{1,2}\/\d{1,2}/.test(room.roomNumber) ||
    room.confidence < 50;

  const getCleaningLabel = (cleaning: CleaningType) => {
    switch (cleaning) {
      case 'full': return 'À blanc';
      case 'quick': return 'Recouche';
      case 'none': return 'Aucun';
      default: return cleaning;
    }
  };

  const handleSaveEdit = () => {
    onModify(index, editedRoom);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedRoom({
      roomNumber: room.roomNumber,
      status: room.status || '',
      cleaningType: room.cleaningType
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Card className="p-3 border-primary">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Numéro</label>
              <Input
                value={editedRoom.roomNumber}
                onChange={e => setEditedRoom({ ...editedRoom, roomNumber: e.target.value })}
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Statut</label>
              <Input
                value={editedRoom.status}
                onChange={e => setEditedRoom({ ...editedRoom, status: e.target.value })}
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nettoyage</label>
              <Select
                value={editedRoom.cleaningType}
                onValueChange={v => setEditedRoom({ ...editedRoom, cleaningType: v as CleaningType })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">À blanc</SelectItem>
                  <SelectItem value="quick">Recouche</SelectItem>
                  <SelectItem value="none">Aucun</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-3 ${isLikelyError ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' : room.validated ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {isLikelyError && (
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          )}
          <span className="font-mono font-bold">{room.roomNumber}</span>
          <Badge variant={
            room.cleaningType === 'full' ? 'destructive' :
            room.cleaningType === 'quick' ? 'default' : 'secondary'
          }>
            {getCleaningLabel(room.cleaningType)}
          </Badge>
          {room.status && (
            <span className="text-sm text-muted-foreground">{room.status}</span>
          )}
          {room.confidence < 70 && (
            <Badge variant="outline" className="text-xs">
              {room.confidence.toFixed(0)}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
            onClick={() => onValidate(index)}
            title="Valider"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
            onClick={() => setIsEditing(true)}
            title="Modifier"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(index)}
            title="Supprimer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
