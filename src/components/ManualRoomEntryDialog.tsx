import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ClipboardList, Save, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Room } from "@/services/pdfService";
import { useLanguage } from "@/contexts/LanguageContext";

interface ManualRoomEntry {
  id: string;
  roomNumber: string;
  cleaningType: 'a_blanc' | 'recouche' | 'none';
  status: string;
  floor?: string;
  notes?: string;
}

interface ManualRoomEntryDialogProps {
  hotelId: string | null;
  onRoomsAdded: (rooms: Room[]) => void;
  existingRoomNumbers?: string[];
}

export function ManualRoomEntryDialog({ 
  hotelId, 
  onRoomsAdded,
  existingRoomNumbers = []
}: ManualRoomEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ManualRoomEntry[]>([
    { id: crypto.randomUUID(), roomNumber: '', cleaningType: 'a_blanc', status: 'dirty' }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useLanguage();

  const addEntry = () => {
    setEntries([
      ...entries,
      { id: crypto.randomUUID(), roomNumber: '', cleaningType: 'a_blanc', status: 'dirty' }
    ]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id: string, field: keyof ManualRoomEntry, value: string) => {
    setEntries(entries.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const getCleaningTypeLabel = (type: string) => {
    switch (type) {
      case 'a_blanc': return '🚪 À blanc (Départ)';
      case 'recouche': return '🛏️ Recouche (Séjour)';
      case 'none': return '✅ Propre (Pas de ménage)';
      default: return type;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'dirty': return 'À nettoyer';
      case 'checkout': return 'Client sorti';
      case 'stayover': return 'Client en place';
      case 'clean': return 'Propre';
      case 'occupied': return 'Occupé';
      default: return status;
    }
  };

  const validateEntries = () => {
    const validEntries = entries.filter(e => e.roomNumber.trim() !== '');
    const duplicates = validEntries.filter((e, i, arr) => 
      arr.findIndex(x => x.roomNumber === e.roomNumber) !== i
    );
    const alreadyExists = validEntries.filter(e => 
      existingRoomNumbers.includes(e.roomNumber)
    );
    
    return {
      valid: validEntries,
      duplicates,
      alreadyExists,
      isEmpty: validEntries.length === 0
    };
  };

  const handleSave = async () => {
    const validation = validateEntries();
    
    if (validation.isEmpty) {
      toast({
        variant: "destructive",
        title: "Aucune chambre",
        description: "Veuillez entrer au moins un numéro de chambre.",
      });
      return;
    }

    if (validation.duplicates.length > 0) {
      toast({
        variant: "destructive",
        title: "Doublons détectés",
        description: `Les chambres suivantes sont en double: ${validation.duplicates.map(d => d.roomNumber).join(', ')}`,
      });
      return;
    }

    if (!hotelId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "ID de l'hôtel manquant.",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Prepare rooms for database
      const roomsToInsert = validation.valid.map(entry => ({
        hotel_id: hotelId,
        room_number: entry.roomNumber.trim(),
        status: entry.status,
        cleaning_type: entry.cleaningType,
        floor: entry.floor ? parseInt(entry.floor) : null,
        notes: entry.notes || null,
        cleaning_priority: 1,
      }));

      // Insert into rooms table (upsert)
      const { error: roomsError } = await supabase
        .from('rooms')
        .upsert(roomsToInsert, { 
          onConflict: 'hotel_id,room_number',
          ignoreDuplicates: false 
        });

      if (roomsError) {
        throw roomsError;
      }

      // Also update the registry
      const registryData = validation.valid.map(entry => ({
        hotel_id: hotelId,
        room_number: entry.roomNumber.trim(),
        floor: entry.floor ? parseInt(entry.floor) : null,
        source: 'manual',
        is_active: true,
      }));

      await supabase
        .from('hotel_rooms_registry')
        .upsert(registryData, { 
          onConflict: 'hotel_id,room_number',
          ignoreDuplicates: false 
        });

      // Convert to Room format for callback
      const rooms: Room[] = validation.valid.map(entry => ({
        number: entry.roomNumber.trim(),
        status: entry.status,
        cleaningType: entry.cleaningType,
        floor: entry.floor ? parseInt(entry.floor) : undefined,
        notes: entry.notes,
        priority: 'medium',
      }));

      onRoomsAdded(rooms);

      toast({
        title: "✅ Chambres enregistrées",
        description: `${validation.valid.length} chambre(s) ajoutée(s) avec succès.`,
      });

      // Reset and close
      setEntries([
        { id: crypto.randomUUID(), roomNumber: '', cleaningType: 'a_blanc', status: 'dirty' }
      ]);
      setOpen(false);

    } catch (error: any) {
      console.error('Error saving rooms:', error);
      toast({
        variant: "destructive",
        title: "Erreur d'enregistrement",
        description: error.message || "Une erreur est survenue.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const validation = validateEntries();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ClipboardList className="h-4 w-4" />
          Saisie manuelle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Saisie manuelle des chambres
          </DialogTitle>
          <DialogDescription>
            Ajoutez vos chambres manuellement avec leur statut et type de nettoyage.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div 
                key={entry.id} 
                className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg border bg-card"
              >
                {/* Room Number */}
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">N° Chambre</Label>
                  <Input
                    value={entry.roomNumber}
                    onChange={(e) => updateEntry(entry.id, 'roomNumber', e.target.value)}
                    placeholder="101"
                    className="h-9"
                  />
                </div>

                {/* Cleaning Type */}
                <div className="col-span-4">
                  <Label className="text-xs text-muted-foreground">Type de nettoyage</Label>
                  <Select
                    value={entry.cleaningType}
                    onValueChange={(value) => updateEntry(entry.id, 'cleaningType', value as any)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_blanc">🚪 À blanc (Départ)</SelectItem>
                      <SelectItem value="recouche">🛏️ Recouche (Séjour)</SelectItem>
                      <SelectItem value="none">✅ Propre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">Statut</Label>
                  <Select
                    value={entry.status}
                    onValueChange={(value) => updateEntry(entry.id, 'status', value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dirty">À nettoyer</SelectItem>
                      <SelectItem value="checkout">Client sorti</SelectItem>
                      <SelectItem value="stayover">Client en place</SelectItem>
                      <SelectItem value="clean">Propre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Floor */}
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Étage</Label>
                  <Input
                    type="number"
                    value={entry.floor || ''}
                    onChange={(e) => updateEntry(entry.id, 'floor', e.target.value)}
                    placeholder="1"
                    className="h-9"
                  />
                </div>

                {/* Delete button */}
                <div className="col-span-1 flex items-end justify-center pb-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeEntry(entry.id)}
                    disabled={entries.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Add button */}
        <Button
          variant="outline"
          className="w-full border-dashed gap-2"
          onClick={addEntry}
        >
          <Plus className="h-4 w-4" />
          Ajouter une chambre
        </Button>

        {/* Validation summary */}
        {validation.valid.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{validation.valid.length} chambre(s) à enregistrer</span>
            {validation.alreadyExists.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {validation.alreadyExists.length} mise(s) à jour
              </Badge>
            )}
          </div>
        )}

        {validation.duplicates.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Doublons: {validation.duplicates.map(d => d.roomNumber).join(', ')}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || validation.isEmpty}
            className="gap-2"
          >
            {isSaving ? (
              <>Enregistrement...</>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Enregistrer ({validation.valid.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
