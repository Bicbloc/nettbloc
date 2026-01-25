import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Check, X, Edit2, Trash2, User, Calendar, Clock, Home } from 'lucide-react';
import { ParsedRow } from '@/services/training/ReportFormatDetector';
import { CleaningType } from '@/constants/cleaningTypes';

const CLEANING_OPTIONS = [
  { value: 'full', label: 'À blanc', color: 'bg-orange-100 text-orange-800' },
  { value: 'quick', label: 'Recouche', color: 'bg-blue-100 text-blue-800' },
  { value: 'none', label: 'Aucun', color: 'bg-gray-100 text-gray-800' },
  { value: 'out_of_service', label: 'Hors service', color: 'bg-purple-100 text-purple-800' },
  { value: 'exclude', label: 'Exclure', color: 'bg-red-100 text-red-800' },
];

interface InteractiveRowEditorProps {
  row: ParsedRow;
  rowIndex: number;
  onUpdate: (index: number, updates: Partial<ParsedRow>) => void;
  onExclude: (index: number) => void;
  isExcluded?: boolean;
}

export const InteractiveRowEditor: React.FC<InteractiveRowEditorProps> = ({
  row,
  rowIndex,
  onUpdate,
  onExclude,
  isExcluded = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRow, setEditedRow] = useState<Partial<ParsedRow>>({});

  const handleSave = () => {
    onUpdate(rowIndex, editedRow);
    setIsEditing(false);
    setEditedRow({});
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedRow({});
  };

  const getCleaningBadge = (type: string) => {
    const option = CLEANING_OPTIONS.find(o => o.value === type);
    return option ? (
      <Badge className={option.color}>{option.label}</Badge>
    ) : (
      <Badge variant="outline">Inconnu</Badge>
    );
  };

  if (isExcluded) {
    return (
      <div className="flex items-center gap-3 p-2 bg-muted/30 rounded border border-dashed opacity-50">
        <Badge variant="secondary" className="font-mono">{row.roomNumber}</Badge>
        <span className="text-sm text-muted-foreground line-through flex-1">Ligne exclue</span>
        <Button variant="ghost" size="sm" onClick={() => onExclude(rowIndex)}>
          Restaurer
        </Button>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-muted/50 cursor-pointer ${
          !row.guestName ? 'border-yellow-200 bg-yellow-50/50' : ''
        }`}
        onClick={() => setIsEditing(true)}
      >
        {/* Numéro de chambre */}
        <Badge variant="secondary" className="font-mono font-bold min-w-[50px] justify-center">
          {row.roomNumber}
        </Badge>

        {/* Type de chambre */}
        <Badge variant="outline" className="text-xs">
          {row.roomType || '-'}
        </Badge>

        {/* Nom du client */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-muted-foreground" />
            {row.guestName ? (
              <span className="text-sm font-medium truncate">{row.guestName}</span>
            ) : (
              <span className="text-sm text-yellow-600 italic">Cliquez pour ajouter le nom</span>
            )}
          </div>
          {(row.arrivalDate || row.departureDate) && (
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {row.arrivalDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {row.arrivalDate}
                </span>
              )}
              {row.nightInfo && (
                <Badge variant="secondary" className="text-[10px]">
                  Nuit {row.nightInfo}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Statut */}
        <Badge variant="outline" className="font-mono text-xs">
          {row.statusIndicator || row.cleaningStatus || '-'}
        </Badge>

        {/* Type de nettoyage */}
        {getCleaningBadge(row.detectedCleaningType)}

        {/* Actions */}
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}>
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={(e) => {
            e.stopPropagation();
            onExclude(rowIndex);
          }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Dialog d'édition */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Modifier la chambre {row.roomNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nom du client */}
            <div className="space-y-2">
              <Label htmlFor="guestName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nom du client
              </Label>
              <Input
                id="guestName"
                value={editedRow.guestName ?? row.guestName}
                onChange={(e) => setEditedRow({ ...editedRow, guestName: e.target.value })}
                placeholder="Ex: Jean Dupont"
              />
            </div>

            {/* Type de nettoyage */}
            <div className="space-y-2">
              <Label>Type de nettoyage</Label>
              <Select
                value={(editedRow.detectedCleaningType ?? row.detectedCleaningType) as string}
                onValueChange={(v) => setEditedRow({ ...editedRow, detectedCleaningType: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {CLEANING_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${opt.color.split(' ')[0]}`} />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="arrivalDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Arrivée
                </Label>
                <Input
                  id="arrivalDate"
                  value={editedRow.arrivalDate ?? row.arrivalDate}
                  onChange={(e) => setEditedRow({ ...editedRow, arrivalDate: e.target.value })}
                  placeholder="JJ/MM/AAAA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departureDate">Départ</Label>
                <Input
                  id="departureDate"
                  value={editedRow.departureDate ?? row.departureDate}
                  onChange={(e) => setEditedRow({ ...editedRow, departureDate: e.target.value })}
                  placeholder="JJ/MM/AAAA"
                />
              </div>
            </div>

            {/* Heures */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="arrivalTime" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Heure arrivée
                </Label>
                <Input
                  id="arrivalTime"
                  value={editedRow.arrivalTime ?? row.arrivalTime}
                  onChange={(e) => setEditedRow({ ...editedRow, arrivalTime: e.target.value })}
                  placeholder="HH:MM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departureTime">Heure départ</Label>
                <Input
                  id="departureTime"
                  value={editedRow.departureTime ?? row.departureTime}
                  onChange={(e) => setEditedRow({ ...editedRow, departureTime: e.target.value })}
                  placeholder="HH:MM"
                />
              </div>
            </div>

            {/* Info nuit */}
            <div className="space-y-2">
              <Label htmlFor="nightInfo">Info nuit (X/Y)</Label>
              <Input
                id="nightInfo"
                value={editedRow.nightInfo ?? row.nightInfo}
                onChange={(e) => setEditedRow({ ...editedRow, nightInfo: e.target.value })}
                placeholder="Ex: 2/3"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
