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
  AlertTriangle, Eye, Sparkles, Save, Calendar, User, ArrowRight
} from "lucide-react";
import { ExtractedRoom, CLEANING_TYPE_LABELS } from "@/services/pms";
import { TrainingData } from "./TrainingWizard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TrainingStep2AnnotateProps {
  trainingData: TrainingData;
  hotelId: string;
  userId: string;
  onComplete: (rooms: ExtractedRoom[]) => void;
  onBack: () => void;
}

// Labels pour les types de nettoyage
const CLEANING_LABELS: Record<string, { label: string; color: string }> = {
  'a_blanc': { label: 'À blanc', color: 'bg-orange-500' },
  'full': { label: 'À blanc', color: 'bg-orange-500' },
  'recouche': { label: 'Recouche', color: 'bg-blue-500' },
  'quick': { label: 'Recouche', color: 'bg-blue-500' },
  'none': { label: 'Aucun', color: 'bg-gray-400' },
};

// Labels pour les statuts séjour
const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
  'checkout': { label: 'Départ', icon: '🚪' },
  'checkout_arrival': { label: 'Départ → Arrivée', icon: '🔄' },
  'stayover': { label: 'Recouche', icon: '🛏️' },
  'arrival': { label: 'En arrivée', icon: '📥' },
  'occupied': { label: 'Occupé', icon: '👤' },
  'dirty': { label: 'Sale', icon: '🧹' },
  'unknown': { label: 'Inconnu', icon: '❓' },
};

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

  // Intelligent highlighting - avoid false positives
  const highlightedText = useMemo(() => {
    const text = trainingData.rawText;
    const segments: { text: string; isRoom: boolean; roomNum?: string }[] = [];
    
    const roomNumbers = rooms.map((r) => r.roomNumber);
    const sortedRoomNumbers = [...roomNumbers].sort((a, b) => b.length - a.length);
    
    const positions: { start: number; end: number; roomNum: string }[] = [];
    
    // Process line by line to better identify context
    const lines = text.split('\n');
    let currentPos = 0;
    
    for (const line of lines) {
      sortedRoomNumbers.forEach((roomNum) => {
        const escaped = roomNum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Only match room numbers at the start of a line or after significant whitespace
        const regex = new RegExp(`(?:^|\\s{2,})(${escaped})(?:\\s|$)`, "g");
        let match;
        
        while ((match = regex.exec(line)) !== null) {
          const matchIndex = match.index + (match[0].indexOf(roomNum));
          const globalIndex = currentPos + matchIndex;
          
          // Skip if this looks like it's part of "X adultes" or time
          const contextBefore = line.substring(Math.max(0, matchIndex - 15), matchIndex);
          const contextAfter = line.substring(matchIndex + roomNum.length, matchIndex + roomNum.length + 15);
          
          // Skip if preceded by digits (likely part of a larger number)
          if (/\d$/.test(contextBefore.trim())) continue;
          
          // Skip if followed by "adultes", "enfants", or time pattern
          if (/^\s*(adultes?|enfants?|:\d{2})/i.test(contextAfter)) continue;
          
          // Skip if it's clearly part of a date pattern
          if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(line.substring(matchIndex - 5, matchIndex + roomNum.length + 5))) {
            // But allow if it's at the very start of the line
            if (matchIndex > 3) continue;
          }
          
          const overlap = positions.some(
            (pos) =>
              (globalIndex >= pos.start && globalIndex < pos.end) ||
              (globalIndex + roomNum.length > pos.start &&
                globalIndex + roomNum.length <= pos.end)
          );
          
          if (!overlap) {
            positions.push({
              start: globalIndex,
              end: globalIndex + roomNum.length,
              roomNum,
            });
          }
        }
      });
      currentPos += line.length + 1; // +1 for newline
    }
    
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
  
  // Get cleaning badge styling
  const getCleaningBadge = (cleaningType: string) => {
    const config = CLEANING_LABELS[cleaningType] || CLEANING_LABELS['none'];
    return config;
  };
  
  // Get status info
  const getStatusInfo = (status: string) => {
    return STATUS_LABELS[status] || STATUS_LABELS['unknown'];
  };

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

      {/* Rooms list with enhanced display */}
      <TooltipProvider>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {rooms.length === 0 ? (
              <Card className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Aucune chambre détectée. Utilisez le bouton "Ajouter chambre" pour les ajouter manuellement.
                </p>
              </Card>
            ) : (
              rooms.map((room, index) => {
                const cleaningConfig = getCleaningBadge(room.cleaningType);
                const statusInfo = getStatusInfo(room.status);
                
                return (
                  <Card
                    key={index}
                    className={`p-3 transition-all ${
                      room.validated ? "border-green-500/50 bg-green-500/5" : "border-muted"
                    } ${mergingMode && selectedRooms.has(index) ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="flex flex-col gap-2">
                      {/* Main row */}
                      <div className="flex items-center gap-3">
                        {mergingMode && (
                          <Checkbox
                            checked={selectedRooms.has(index)}
                            onCheckedChange={() => toggleRoomSelection(index)}
                          />
                        )}

                        {/* Room number */}
                        <div className="font-bold text-lg min-w-[50px] text-primary">
                          {room.roomNumber}
                        </div>

                        {/* Status badge */}
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="gap-1">
                              <span>{statusInfo.icon}</span>
                              <span className="hidden sm:inline">{statusInfo.label}</span>
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Statut séjour: {statusInfo.label}</TooltipContent>
                        </Tooltip>

                        {/* Cleaning type selector */}
                        <Select
                          value={room.cleaningType}
                          onValueChange={(v: any) => updateRoom(index, "cleaningType", v)}
                        >
                          <SelectTrigger className={`w-[130px] h-8 ${
                            room.cleaningType === 'a_blanc' || room.cleaningType === 'full' 
                              ? 'border-orange-500 text-orange-600' 
                              : room.cleaningType === 'recouche' || room.cleaningType === 'quick'
                                ? 'border-blue-500 text-blue-600'
                                : ''
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="a_blanc">🧹 À blanc</SelectItem>
                            <SelectItem value="recouche">🛏️ Recouche</SelectItem>
                            <SelectItem value="none">⏸️ Aucun</SelectItem>
                          </SelectContent>
                        </Select>

                        {room.isConnected && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Link2 className="w-3 h-3" />
                            Liées
                          </Badge>
                        )}

                        {/* Room type if available */}
                        {room.roomType && (
                          <span className="text-xs text-muted-foreground hidden md:inline">
                            {room.roomType}
                          </span>
                        )}

                        <div className="flex-1" />

                        {/* Action buttons */}
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

                      {/* Details row - guest info, dates */}
                      {(room.guestName || room.arrivalDate || room.departureDate || room.rawStatuses) && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pl-[50px]">
                          {room.guestName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {room.guestName}
                            </span>
                          )}
                          {(room.arrivalDate || room.departureDate) && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {room.arrivalDate && <span>{room.arrivalDate}</span>}
                              {room.arrivalDate && room.departureDate && <ArrowRight className="w-3 h-3" />}
                              {room.departureDate && <span>{room.departureDate}</span>}
                            </span>
                          )}
                          {room.rawStatuses && room.rawStatuses.length > 0 && (
                            <span className="text-xs opacity-70">
                              ({room.rawStatuses.join(' + ')})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </TooltipProvider>

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
