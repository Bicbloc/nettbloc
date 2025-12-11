import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Check, X, ChevronLeft, Link2, Unlink, Plus, 
  AlertTriangle, Eye, Sparkles, Save
} from "lucide-react";
import { ExtractedRoom } from "@/services/pms";
import { TrainingData } from "./TrainingWizard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface TrainingStep2AnnotateProps {
  trainingData: TrainingData;
  hotelId: string;
  userId: string;
  onComplete: (rooms: ExtractedRoom[]) => void;
  onBack: () => void;
}

export const TrainingStep2Annotate = ({
  trainingData,
  hotelId,
  userId,
  onComplete,
  onBack,
}: TrainingStep2AnnotateProps) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<ExtractedRoom[]>(trainingData.extractedRooms);
  const [mergingMode, setMergingMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [newRoom, setNewRoom] = useState({ roomNumber: "", cleaningType: "full" as const });

  const validatedCount = rooms.filter((r) => r.validated).length;
  const totalCount = rooms.length;

  // Highlight rooms in text
  const highlightedText = useMemo(() => {
    const text = trainingData.rawText;
    const segments: { text: string; isRoom: boolean; roomNum?: string }[] = [];
    
    const roomNumbers = rooms.map((r) => r.roomNumber);
    const sortedRoomNumbers = [...roomNumbers].sort((a, b) => b.length - a.length);
    
    const positions: { start: number; end: number; roomNum: string }[] = [];
    
    sortedRoomNumbers.forEach((roomNum) => {
      const escaped = roomNum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const overlap = positions.some(
          (pos) =>
            (match.index >= pos.start && match.index < pos.end) ||
            (match.index + match[0].length > pos.start &&
              match.index + match[0].length <= pos.end)
        );
        
        if (!overlap) {
          positions.push({
            start: match.index,
            end: match.index + match[0].length,
            roomNum,
          });
        }
      }
    });
    
    positions.sort((a, b) => a.start - b.start);
    
    let lastIndex = 0;
    positions.forEach((pos) => {
      if (pos.start > lastIndex) {
        segments.push({ text: text.substring(lastIndex, pos.start), isRoom: false });
      }
      segments.push({ text: text.substring(pos.start, pos.end), isRoom: true, roomNum: pos.roomNum });
      lastIndex = pos.end;
    });
    
    if (lastIndex < text.length) {
      segments.push({ text: text.substring(lastIndex), isRoom: false });
    }
    
    return segments;
  }, [trainingData.rawText, rooms]);

  const updateRoom = (index: number, field: keyof ExtractedRoom, value: any) => {
    const updated = [...rooms];
    updated[index] = { ...updated[index], [field]: value };
    setRooms(updated);
  };

  const validateRoom = (index: number) => {
    const updated = [...rooms];
    updated[index] = { ...updated[index], validated: !updated[index].validated };
    setRooms(updated);
  };

  const validateAll = () => {
    setRooms(rooms.map((r) => ({ ...r, validated: true })));
    toast({ title: "Toutes les chambres validées" });
  };

  const toggleRoomSelection = (index: number) => {
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedRooms(newSelection);
  };

  const mergeSelectedRooms = () => {
    if (selectedRooms.size < 2) {
      toast({ title: "Sélectionnez au moins 2 chambres", variant: "destructive" });
      return;
    }

    const indices = Array.from(selectedRooms).sort((a, b) => a - b);
    const roomsToMerge = indices.map((i) => rooms[i]);
    const roomNumbers = roomsToMerge.map((r) => r.roomNumber);

    const merged: ExtractedRoom = {
      roomNumber: roomNumbers.join("-"),
      status: roomsToMerge[0].status,
      cleaningType: roomsToMerge[0].cleaningType,
      arrivalDate: roomsToMerge[0].arrivalDate,
      departureDate: roomsToMerge[0].departureDate,
      validated: true,
      isConnected: true,
      linkedRooms: roomNumbers,
    };

    const updated = rooms.filter((_, i) => !selectedRooms.has(i));
    updated.push(merged);
    setRooms(updated);
    setSelectedRooms(new Set());
    setMergingMode(false);
    toast({ title: "Chambres fusionnées" });
  };

  const splitRoom = (index: number) => {
    const room = rooms[index];
    if (!room.isConnected || !room.linkedRooms) return;

    const separated = room.linkedRooms.map((num) => ({
      roomNumber: num,
      status: room.status,
      cleaningType: room.cleaningType,
      arrivalDate: room.arrivalDate,
      departureDate: room.departureDate,
      validated: true,
    }));

    const updated = [...rooms];
    updated.splice(index, 1, ...separated);
    setRooms(updated);
    toast({ title: "Chambres séparées" });
  };

  const addRoom = () => {
    if (!newRoom.roomNumber.trim()) {
      toast({ title: "Entrez un numéro de chambre", variant: "destructive" });
      return;
    }

    setRooms([
      ...rooms,
      {
        roomNumber: newRoom.roomNumber.trim(),
        status: "unknown",
        cleaningType: newRoom.cleaningType,
        arrivalDate: "",
        departureDate: "",
        validated: true,
      },
    ]);
    setNewRoom({ roomNumber: "", cleaningType: "full" });
    toast({ title: `Chambre ${newRoom.roomNumber} ajoutée` });
  };

  const removeRoom = (index: number) => {
    const updated = rooms.filter((_, i) => i !== index);
    setRooms(updated);
  };

  const handleComplete = () => {
    if (validatedCount === 0) {
      toast({
        title: "Aucune chambre validée",
        description: "Validez au moins une chambre avant de continuer",
        variant: "destructive",
      });
      return;
    }
    onComplete(rooms);
  };

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="w-3 h-3" />
            PMS: {trainingData.detectedPmsType.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={validatedCount === totalCount ? "default" : "secondary"}>
            {validatedCount}/{totalCount} validées
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="w-4 h-4 mr-1" />
            {showPreview ? "Masquer" : "Texte brut"}
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <Card className="p-4 max-h-48 overflow-auto">
          <ScrollArea className="h-full">
            <div className="font-mono text-xs whitespace-pre-wrap">
              {highlightedText.map((seg, i) =>
                seg.isRoom ? (
                  <mark key={i} className="bg-primary/20 text-primary px-0.5 rounded">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={validateAll} size="sm">
          <Check className="w-4 h-4 mr-1" />
          Tout valider
        </Button>
        <Button
          onClick={() => {
            setMergingMode(!mergingMode);
            setSelectedRooms(new Set());
          }}
          variant={mergingMode ? "default" : "outline"}
          size="sm"
        >
          <Link2 className="w-4 h-4 mr-1" />
          {mergingMode ? "Annuler fusion" : "Fusionner"}
        </Button>
        {mergingMode && selectedRooms.size >= 2 && (
          <Button onClick={mergeSelectedRooms} variant="secondary" size="sm">
            Confirmer ({selectedRooms.size})
          </Button>
        )}

        {/* Add room dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Ajouter chambre
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une chambre manquante</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Numéro de chambre</Label>
                <Input
                  value={newRoom.roomNumber}
                  onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
                  placeholder="Ex: 712, 01, A101..."
                />
              </div>
              <div>
                <Label>Type de nettoyage</Label>
                <Select
                  value={newRoom.cleaningType}
                  onValueChange={(v: any) => setNewRoom({ ...newRoom, cleaningType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">À blanc (complet)</SelectItem>
                    <SelectItem value="quick">Recouche (rapide)</SelectItem>
                    <SelectItem value="none">Aucun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addRoom} className="w-full">
                Ajouter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rooms list */}
      <ScrollArea className="h-[320px] pr-4">
        <div className="space-y-2">
          {rooms.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aucune chambre détectée. Utilisez le bouton "Ajouter chambre" pour les ajouter manuellement.
              </p>
            </Card>
          ) : (
            rooms.map((room, index) => (
              <Card
                key={index}
                className={`p-3 transition-all ${
                  room.validated ? "border-green-500/50 bg-green-500/5" : "border-muted"
                } ${mergingMode && selectedRooms.has(index) ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center gap-3">
                  {mergingMode && (
                    <Checkbox
                      checked={selectedRooms.has(index)}
                      onCheckedChange={() => toggleRoomSelection(index)}
                    />
                  )}

                  <div className="flex-1 flex items-center gap-3">
                    <div className="font-semibold min-w-[60px]">
                      {room.roomNumber}
                    </div>

                    {room.isConnected && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Link2 className="w-3 h-3" />
                        Liées
                      </Badge>
                    )}

                    <Select
                      value={room.cleaningType}
                      onValueChange={(v: any) => updateRoom(index, "cleaningType", v)}
                    >
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">À blanc</SelectItem>
                        <SelectItem value="quick">Recouche</SelectItem>
                        <SelectItem value="none">Aucun</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      value={room.status}
                      onChange={(e) => updateRoom(index, "status", e.target.value)}
                      className="w-[80px] h-8"
                      placeholder="Statut"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    {room.isConnected && (
                      <Button size="icon" variant="ghost" onClick={() => splitRoom(index)} className="h-8 w-8">
                        <Unlink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant={room.validated ? "default" : "outline"}
                      onClick={() => validateRoom(index)}
                      className="h-8 w-8"
                    >
                      {room.validated ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeRoom(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Continue button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleComplete} size="lg" className="gap-2">
          <Save className="w-4 h-4" />
          Sauvegarder et terminer
        </Button>
      </div>
    </div>
  );
};
