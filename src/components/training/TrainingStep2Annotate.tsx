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
  AlertTriangle, Sparkles, Save, Calendar, User, ArrowRight, Copy, FileText, Wand2
} from "lucide-react";
import { ExtractedRoom, CLEANING_TYPE_LABELS } from "@/services/pms";
import { TrainingData } from "./TrainingWizard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LinePatternRuleDialog } from "./LinePatternRuleDialog";

interface TrainingStep2AnnotateProps {
  trainingData: TrainingData;
  hotelId: string;
  userId: string;
  onComplete: (rooms: ExtractedRoom[]) => void;
  onBack: () => void;
  onOpenAdvanced?: () => void;
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
const STATUS_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  'checkout': { label: 'Départ', icon: '🚪', description: 'C/O = Check-Out (heure de départ client). Nettoyage: À blanc.' },
  'checkout_arrival': { label: 'Départ → Arrivée', icon: '🔄', description: 'C/O + C/I = Départ puis arrivée même jour. Nettoyage: À blanc.' },
  'stayover': { label: 'Recouche', icon: '🛏️', description: 'Client reste. Mews: dates arrivée/départ sans horaire. Nettoyage: Recouche.' },
  'arrival': { label: 'En arrivée', icon: '📥', description: 'C/I = Check-In (heure d\'arrivée). Chambre doit être prête.' },
  'occupied': { label: 'Occupé', icon: '👤', description: 'Chambre occupée, client présent.' },
  'dirty': { label: 'Sale', icon: '🧹', description: 'SAL/SALE = Chambre sale. Par défaut: À blanc (nettoyage complet).' },
  'clean': { label: 'Propre', icon: '✨', description: 'INS/PRO = Chambre propre ou inspectée. Pas de nettoyage.' },
  'unknown': { label: 'Inconnu', icon: '❓', description: 'Statut non reconnu - vérifiez manuellement.' },
};

// Détecte si une chambre est une "dernière nuit" mal détectée
const isLastNightMisdetected = (room: ExtractedRoom): boolean => {
  const originalText = room.originalText || '';
  const upper = originalText.toUpperCase();
  
  // Chercher le pattern "Nuit X/X" où les chiffres sont égaux
  const lastNightMatch = upper.match(/NUIT\s*(\d+)\s*[\/\\]\s*(\d+)/i) || 
                         upper.match(/(\d+)\s*[\/\\]\s*(\d+)\s*NUIT/i);
  
  if (lastNightMatch) {
    const currentNight = parseInt(lastNightMatch[1]);
    const totalNights = parseInt(lastNightMatch[2]);
    
    // Si c'est la dernière nuit (X/X) mais détecté comme recouche → alerte
    if (currentNight === totalNights && 
        (room.cleaningType === 'recouche' || room.cleaningType === 'quick')) {
      return true;
    }
  }
  
  return false;
};

export const TrainingStep2Annotate = ({
  trainingData,
  hotelId,
  userId,
  onComplete,
  onBack,
  onOpenAdvanced,
}: TrainingStep2AnnotateProps) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<ExtractedRoom[]>(trainingData.extractedRooms);
  const [mergingMode, setMergingMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [editingTimeRoom, setEditingTimeRoom] = useState<number | null>(null);
  const [newRoom, setNewRoom] = useState({ roomNumber: "", cleaningType: "full" as const });
  const [ruleDialogRoom, setRuleDialogRoom] = useState<ExtractedRoom | null>(null);
  const [clickedLine, setClickedLine] = useState<{ text: string; index: number } | null>(null);
  const [lineRoomNumber, setLineRoomNumber] = useState("");
  const [lineCleaningType, setLineCleaningType] = useState<"a_blanc" | "recouche" | "none">("a_blanc");

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [cleaningFilter, setCleaningFilter] = useState<'all' | 'a_blanc' | 'recouche' | 'none'>('all');

  const copyRawText = () => {
    navigator.clipboard.writeText(trainingData.rawText);
    toast({ title: "Texte copié dans le presse-papiers" });
  };

  // Parse les lignes du texte brut pour affichage interactif
  const rawLines = useMemo(() => {
    return trainingData.rawText.split('\n').map((text, index) => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      
      // Chercher si cette ligne correspond à une chambre détectée
      const matchingRoom = rooms.find(r => {
        const roomNum = r.roomNumber.replace(/-T$/, '');
        // Vérifier si le numéro de chambre apparaît au début de la ligne
        return new RegExp(`^${roomNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`).test(trimmed) ||
               trimmed.includes(` ${roomNum} `) ||
               trimmed.startsWith(roomNum + ' ');
      });
      
      return {
        index,
        text: trimmed,
        isDetected: !!matchingRoom,
        roomNumber: matchingRoom?.roomNumber || null,
      };
    }).filter(Boolean) as { index: number; text: string; isDetected: boolean; roomNumber: string | null }[];
  }, [trainingData.rawText, rooms]);

  // Ajouter une chambre depuis une ligne cliquée
  const addRoomFromLine = () => {
    if (!clickedLine || !lineRoomNumber.trim()) {
      toast({ title: "Entrez un numéro de chambre", variant: "destructive" });
      return;
    }

    // Détecter automatiquement le type de nettoyage basé sur le texte
    const upper = clickedLine.text.toUpperCase();
    let autoCleaningType = lineCleaningType;
    
    if (/\bINS\b|\bPRO\b/.test(upper)) autoCleaningType = 'none';
    else if (/\bSAL\b.*\d{1,2}:\d{2}.*\d{1,2}:\d{2}/.test(upper)) autoCleaningType = 'a_blanc';
    else if (/\bDEP\b|\bDIR\b/.test(upper)) autoCleaningType = 'a_blanc';

    setRooms([
      ...rooms,
      {
        roomNumber: lineRoomNumber.trim(),
        status: "unknown",
        cleaningType: autoCleaningType,
        arrivalDate: "",
        departureDate: "",
        validated: true,
        originalText: clickedLine.text,
      },
    ]);
    
    toast({ title: `Chambre ${lineRoomNumber} ajoutée` });
    setClickedLine(null);
    setLineRoomNumber("");
  };

  const validatedCount = rooms.filter((r) => r.validated).length;
  const totalCount = rooms.length;

  const collator = useMemo(() => new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }), []);

  const matchesCleaningFilter = (room: ExtractedRoom) => {
    if (cleaningFilter === 'all') return true;

    if (cleaningFilter === 'a_blanc') {
      return room.cleaningType === 'a_blanc' || room.cleaningType === 'full';
    }
    if (cleaningFilter === 'recouche') {
      return room.cleaningType === 'recouche' || room.cleaningType === 'quick';
    }
    return room.cleaningType === 'none';
  };

  const displayedRooms = useMemo(() => {
    const indexed = rooms.map((room, index) => ({ room, index }));

    const filtered = indexed.filter(({ room }) => matchesCleaningFilter(room));

    filtered.sort((a, b) => {
      const cmp = collator.compare(a.room.roomNumber, b.room.roomNumber);
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [rooms, cleaningFilter, sortOrder, collator]);

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
    <div className="flex gap-4 h-[600px]">
      {/* Left panel - Raw PDF text with clickable lines */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Texte brut du PDF</span>
            <Badge variant="outline" className="text-xs">
              Cliquez sur une ligne pour l'ajouter
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={copyRawText}>
            <Copy className="w-4 h-4 mr-1" />
            Copier
          </Button>
        </div>
        <Card className="flex-1 p-2 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-0.5">
              {rawLines.map((line) => (
                <div
                  key={line.index}
                  onClick={() => {
                    if (!line.isDetected) {
                      // Essayer d'extraire un numéro de chambre automatiquement
                      const match = line.text.match(/^(\d{2,4}(?:-?T)?)/);
                      setLineRoomNumber(match ? match[1] : "");
                      setClickedLine(line);
                      
                      // Auto-détecter le type de nettoyage
                      const upper = line.text.toUpperCase();
                      if (/\bINS\b|\bPRO\b/.test(upper)) setLineCleaningType('none');
                      else if (/\bSAL\b/.test(upper)) setLineCleaningType('a_blanc');
                      else setLineCleaningType('a_blanc');
                    }
                  }}
                  className={`px-2 py-1 rounded text-xs font-mono cursor-pointer transition-all ${
                    line.isDetected 
                      ? "bg-green-100 dark:bg-green-900/30 border-l-2 border-green-500" 
                      : "hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:border-l-2 hover:border-amber-500"
                  } ${clickedLine?.index === line.index ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {line.isDetected ? (
                      <Check className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Plus className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0 opacity-50" />
                    )}
                    <span className={line.isDetected ? "text-muted-foreground" : ""}>
                      {line.text.length > 100 ? line.text.substring(0, 100) + "..." : line.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
        
        {/* Mini form when a line is clicked */}
        {clickedLine && (
          <Card className="mt-2 p-3 border-primary bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Ajouter cette ligne comme chambre</span>
            </div>
            <p className="text-xs font-mono bg-muted p-2 rounded mb-2 truncate">
              {clickedLine.text}
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={lineRoomNumber}
                onChange={(e) => setLineRoomNumber(e.target.value)}
                placeholder="N° chambre"
                className="h-8 w-24"
              />
              <Select
                value={lineCleaningType}
                onValueChange={(v: any) => setLineCleaningType(v)}
              >
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_blanc">À blanc</SelectItem>
                  <SelectItem value="recouche">Recouche</SelectItem>
                  <SelectItem value="none">Aucun</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addRoomFromLine} className="h-8">
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setClickedLine(null)} className="h-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}
        
        {!clickedLine && (
          <p className="text-xs text-muted-foreground mt-2">
            ✅ Lignes vertes = détectées | Cliquez sur une ligne non détectée pour l'ajouter
          </p>
        )}
      </div>

      {/* Right panel - Room list */}
      <div className="w-1/2 flex flex-col">
        {/* Header with stats */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
            <Badge variant="outline" className="gap-1">
              <Sparkles className="w-3 h-3" />
              PMS: {trainingData.detectedPmsType.toUpperCase()}
            </Badge>
            {onOpenAdvanced && (
              <Button variant="outline" size="sm" onClick={onOpenAdvanced}>
                Paramètres / parser
              </Button>
            )}
          </div>
          <Badge variant={validatedCount === totalCount ? "default" : "secondary"}>
            {validatedCount}/{totalCount} validées
          </Badge>
        </div>

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

      {/* Filtres (colonne droite) */}
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Tri</Label>
          <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Chambres ↑</SelectItem>
              <SelectItem value="desc">Chambres ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Nettoyage</Label>
          <Select value={cleaningFilter} onValueChange={(v: any) => setCleaningFilter(v)}>
            <SelectTrigger className="h-8 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="a_blanc">À blanc</SelectItem>
              <SelectItem value="recouche">Recouche</SelectItem>
              <SelectItem value="none">Aucun</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Badge variant="outline" className="h-8 flex items-center">
          {displayedRooms.length}/{rooms.length}
        </Badge>
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
            ) : displayedRooms.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucune chambre ne correspond aux filtres sélectionnés.
                </p>
              </Card>
            ) : (
              displayedRooms.map(({ room, index }) => {
                const cleaningConfig = getCleaningBadge(room.cleaningType);
                const statusInfo = getStatusInfo(room.status);
                const lastNightAlert = isLastNightMisdetected(room);

                return (
                  <Card
                    key={index}
                    className={`p-3 transition-all ${
                      room.validated ? "border-green-500/50 bg-green-500/5" : "border-muted"
                    } ${mergingMode && selectedRooms.has(index) ? "ring-2 ring-primary" : ""} ${
                      lastNightAlert ? "border-amber-500/70 bg-amber-500/10" : ""
                    }`}
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
                        <div className="font-bold text-lg min-w-[50px] text-primary flex items-center gap-2">
                          {room.roomNumber}
                          {lastNightAlert && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-amber-600 border-amber-500 bg-amber-50 gap-1 text-xs">
                                  <AlertTriangle className="w-3 h-3" />
                                  Dernière nuit
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="font-medium">⚠️ Dernière nuit détectée comme recouche</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Cette chambre semble être en dernière nuit (Nuit X/X) mais est marquée comme recouche. 
                                  Si c'est un départ, changez le type de nettoyage en "À blanc".
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
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

                        {/* Toggle règle permanente */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Checkbox
                                id={`permanent-${index}`}
                                checked={(room as any).isPermanentRule || false}
                                onCheckedChange={(checked) => updateRoom(index, 'isPermanentRule' as any, !!checked)}
                                className="h-4 w-4"
                              />
                              <Label 
                                htmlFor={`permanent-${index}`} 
                                className="text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                              >
                                🔒
                              </Label>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-medium">Règle permanente</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Si coché, cette chambre aura TOUJOURS ce type de nettoyage, 
                              peu importe le contenu du rapport. Utile pour les chambres 
                              spéciales (stockage, staff, etc.).
                            </p>
                          </TooltipContent>
                        </Tooltip>

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
                          {/* Bouton créer règle depuis exemple */}
                          {room.originalText && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setRuleDialogRoom(room)}
                                  className="h-8 w-8 text-primary hover:text-primary"
                                >
                                  <Wand2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Créer une règle depuis cet exemple</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
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

                      {/* Details row - guest info, dates, times */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pl-[50px]">
                        {room.guestName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {room.guestName}
                          </span>
                        )}
                        
                        {/* Time inputs for departure/arrival */}
                        {editingTimeRoom === index ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Départ:</span>
                              <Input
                                type="time"
                                className="h-6 w-20 text-xs"
                                value={room.departureTime || ''}
                                onChange={(e) => updateRoom(index, 'departureTime' as keyof ExtractedRoom, e.target.value)}
                                placeholder="HH:MM"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Arrivée:</span>
                              <Input
                                type="time"
                                className="h-6 w-20 text-xs"
                                value={room.arrivalTime || ''}
                                onChange={(e) => updateRoom(index, 'arrivalTime' as keyof ExtractedRoom, e.target.value)}
                                placeholder="HH:MM"
                              />
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingTimeRoom(null)}>
                              <Check className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1 text-xs"
                            onClick={() => setEditingTimeRoom(index)}
                          >
                            {(room.departureTime || room.arrivalTime) ? (
                              <span className="flex items-center gap-1">
                                {room.departureTime && <span>🚪{room.departureTime}</span>}
                                {room.arrivalTime && <span>📥{room.arrivalTime}</span>}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">+ Horaires</span>
                            )}
                          </Button>
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

                      {/* Status description tooltip */}
                      <div className="pl-[50px] text-xs text-muted-foreground/70 italic">
                        {statusInfo.description}
                      </div>
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
        {/* Dialog création de règle */}
        {ruleDialogRoom && (
          <LinePatternRuleDialog
            open={!!ruleDialogRoom}
            onOpenChange={(open) => !open && setRuleDialogRoom(null)}
            room={ruleDialogRoom}
            allRooms={rooms}
            hotelId={hotelId}
            onRuleCreated={(updatedRooms) => {
              setRooms(updatedRooms);
              setRuleDialogRoom(null);
            }}
          />
        )}
        </div>
      </div>
    </div>
  );
};
