import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertTriangle, Eye, EyeOff, Plus, Search, ChevronRight, 
  Check, X, FileText, Wand2, HelpCircle
} from "lucide-react";
import { ExtractedRoom } from "@/services/pms";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UndetectedLine {
  index: number;
  raw: string;
  potentialRoomNumber: string | null;
  isSelected: boolean;
  manualRoomNumber: string;
  cleaningType: 'a_blanc' | 'recouche' | 'none';
}

interface UndetectedLinesAnnotatorProps {
  rawText: string;
  detectedRooms: ExtractedRoom[];
  onAddRooms: (newRooms: ExtractedRoom[]) => void;
  onSkip: () => void;
}

// Patterns pour détecter les numéros de chambres potentiels
const ROOM_PATTERNS = [
  /^(\d{3,4}(?:-?T)?(?:-\s*Balcon)?)\s+/i,  // 001, 101-T, 504-Balcon
  /^(\d{2,4})\s*\+\s*(\d{2,4})/,              // 003+004
  /^(\d{2,3})\s+(?:DBL|SGL|TPL|FAM|DUP)/i,    // 001 DBL
];

// Indicateurs que la ligne contient des infos de chambre
const ROOM_INDICATORS = [
  /\b(DBL|SGL|TPL|FAM|DUP|TWIN|QUEEN|KING)\b/i,
  /\b(SAL|PRO|INS|DIR|DEP|ARR|OCC)\b/i,
  /\b(Nettoyer|À blanc|Recouche)\b/i,
  /\d+\s*×\s*(Adultes?|Enfants?)/i,
];

// Patterns pour ignorer (headers, footers, etc.)
const IGNORE_PATTERNS = [
  /^étage|^floor|^statut|^espaces|^responsable/i,
  /hôtel|hotel.*\d{2}:\d{2}:\d{2}/i,
  /^\s*\d+\s*\/\s*\d+\s*$/,  // Page numbers
  /^\s*[A-Z]\s*$/,           // Single letters (section headers)
  /^\s*\d{1,2}\s*$/,         // Just floor numbers
];

export const UndetectedLinesAnnotator = ({
  rawText,
  detectedRooms,
  onAddRooms,
  onSkip
}: UndetectedLinesAnnotatorProps) => {
  const detectedRoomNumbers = useMemo(() => 
    new Set(detectedRooms.map(r => r.roomNumber.replace(/-T$/, '').replace(/^0+/, ''))), 
    [detectedRooms]
  );

  const [search, setSearch] = useState('');
  const [showIgnored, setShowIgnored] = useState(false);
  
  // Parser et identifier les lignes non détectées
  const [undetectedLines, setUndetectedLines] = useState<UndetectedLine[]>(() => {
    const lines = rawText.split('\n');
    const result: UndetectedLine[] = [];
    
    lines.forEach((raw, index) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      
      // Ignorer les headers/footers
      if (IGNORE_PATTERNS.some(p => p.test(trimmed))) return;
      
      // Chercher un numéro de chambre potentiel
      let potentialRoomNumber: string | null = null;
      for (const pattern of ROOM_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
          potentialRoomNumber = match[1];
          if (match[2]) {
            // Chambres liées
            potentialRoomNumber = `${match[1]}+${match[2]}`;
          }
          break;
        }
      }
      
      // Vérifier si la ligne a des indicateurs de chambre
      const hasRoomIndicators = ROOM_INDICATORS.some(p => p.test(trimmed));
      
      // Si aucun numéro potentiel trouvé et pas d'indicateurs, ignorer
      if (!potentialRoomNumber && !hasRoomIndicators) return;
      
      // Vérifier si déjà détecté
      const normalizedNum = potentialRoomNumber?.replace(/-T$/, '').replace(/^0+/, '');
      if (normalizedNum && detectedRoomNumbers.has(normalizedNum)) return;
      
      // Pour les chambres liées, vérifier les deux
      if (potentialRoomNumber?.includes('+')) {
        const [r1, r2] = potentialRoomNumber.split('+');
        if (detectedRoomNumbers.has(r1.replace(/^0+/, '')) || 
            detectedRoomNumbers.has(r2.replace(/^0+/, ''))) {
          return;
        }
      }
      
      result.push({
        index,
        raw: trimmed,
        potentialRoomNumber,
        isSelected: !!potentialRoomNumber && hasRoomIndicators,
        manualRoomNumber: potentialRoomNumber || '',
        cleaningType: determineCleaningType(trimmed),
      });
    });
    
    return result;
  });

  // Déterminer le type de nettoyage par défaut
  function determineCleaningType(line: string): 'a_blanc' | 'recouche' | 'none' {
    const upper = line.toUpperCase();
    
    // INS/PRO = propre
    if (/\bINS\b|\bPRO\b/.test(upper)) return 'none';
    
    // SAL avec 2 horaires ou DEP = à blanc
    if (/\bSAL\b.*\d{1,2}:\d{2}.*\d{1,2}:\d{2}/.test(upper)) return 'a_blanc';
    if (/\bDEP\b|\bDIR\b/.test(upper)) return 'a_blanc';
    
    // SAL seul = recouche par défaut (client présent)
    if (/\bSAL\b/.test(upper)) return 'recouche';
    
    // 2 horaires = checkout + checkin
    const times = line.match(/\d{1,2}:\d{2}/g) || [];
    if (times.length >= 2) return 'a_blanc';
    
    // Fallback
    return 'a_blanc';
  }

  const toggleSelection = (index: number) => {
    setUndetectedLines(prev => prev.map((l, i) => 
      i === index ? { ...l, isSelected: !l.isSelected } : l
    ));
  };

  const updateManualRoom = (index: number, value: string) => {
    setUndetectedLines(prev => prev.map((l, i) => 
      i === index ? { ...l, manualRoomNumber: value } : l
    ));
  };

  const updateCleaningType = (index: number, value: 'a_blanc' | 'recouche' | 'none') => {
    setUndetectedLines(prev => prev.map((l, i) => 
      i === index ? { ...l, cleaningType: value } : l
    ));
  };

  const selectAll = () => {
    setUndetectedLines(prev => prev.map(l => ({ 
      ...l, 
      isSelected: l.manualRoomNumber.trim() !== '' 
    })));
  };

  const deselectAll = () => {
    setUndetectedLines(prev => prev.map(l => ({ ...l, isSelected: false })));
  };

  // Lignes filtrées
  const filteredLines = useMemo(() => {
    let result = undetectedLines;
    
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(l => 
        l.raw.toLowerCase().includes(searchLower) ||
        l.manualRoomNumber.toLowerCase().includes(searchLower)
      );
    }
    
    return result;
  }, [undetectedLines, search]);

  const selectedCount = undetectedLines.filter(l => l.isSelected && l.manualRoomNumber.trim()).length;

  const handleAddRooms = () => {
    const newRooms: ExtractedRoom[] = undetectedLines
      .filter(l => l.isSelected && l.manualRoomNumber.trim())
      .map(l => ({
        roomNumber: l.manualRoomNumber.trim(),
        status: 'unknown',
        cleaningType: l.cleaningType,
        arrivalDate: '',
        departureDate: '',
        validated: true,
        originalText: l.raw,
      }));
    
    onAddRooms(newRooms);
  };

  if (undetectedLines.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
        <h3 className="font-semibold text-lg mb-2">Toutes les chambres ont été détectées !</h3>
        <p className="text-muted-foreground mb-4">
          Aucune ligne non détectée dans ce rapport.
        </p>
        <Button onClick={onSkip}>
          Continuer vers le mapping
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold">
              {undetectedLines.length} ligne(s) non détectée(s)
            </h3>
            <p className="text-sm text-muted-foreground">
              Annotez manuellement les chambres manquantes
            </p>
          </div>
        </div>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <HelpCircle className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium mb-1">Comment annoter ?</p>
              <ol className="text-xs space-y-1 list-decimal pl-4">
                <li>Vérifiez le numéro de chambre suggéré</li>
                <li>Corrigez-le si nécessaire</li>
                <li>Choisissez le type de nettoyage</li>
                <li>Cochez pour l'ajouter</li>
              </ol>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        
        <Button variant="outline" size="sm" onClick={selectAll}>
          <Check className="w-4 h-4 mr-1" />
          Tout sélectionner
        </Button>
        <Button variant="outline" size="sm" onClick={deselectAll}>
          <X className="w-4 h-4 mr-1" />
          Tout désélectionner
        </Button>
        
        <Badge variant="secondary">
          {selectedCount} sélectionnée(s)
        </Badge>
      </div>

      {/* Lines list */}
      <ScrollArea className="h-[350px] border rounded-lg">
        <div className="p-2 space-y-2">
          {filteredLines.map((line, idx) => (
            <Card 
              key={line.index}
              className={`p-3 transition-all ${
                line.isSelected ? 'border-primary bg-primary/5' : 'border-muted'
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={line.isSelected}
                  onCheckedChange={() => toggleSelection(idx)}
                  className="mt-1"
                />
                
                <div className="flex-1 space-y-2">
                  {/* Raw text */}
                  <div className="font-mono text-xs bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre">
                    {line.raw}
                  </div>
                  
                  {/* Inputs */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Chambre:</span>
                      <Input
                        value={line.manualRoomNumber}
                        onChange={(e) => updateManualRoom(idx, e.target.value)}
                        placeholder="N° chambre"
                        className="h-7 w-24 text-sm"
                      />
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Type:</span>
                      <Select
                        value={line.cleaningType}
                        onValueChange={(v: any) => updateCleaningType(idx, v)}
                      >
                        <SelectTrigger className="h-7 w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a_blanc">🧹 À blanc</SelectItem>
                          <SelectItem value="recouche">🛏️ Recouche</SelectItem>
                          <SelectItem value="none">⏸️ Aucun</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {line.potentialRoomNumber && line.potentialRoomNumber !== line.manualRoomNumber && (
                      <Badge variant="outline" className="text-xs">
                        Suggéré: {line.potentialRoomNumber}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          
          {filteredLines.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucune ligne correspondant à la recherche
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onSkip}>
          Ignorer et continuer
        </Button>
        
        <Button 
          onClick={handleAddRooms}
          disabled={selectedCount === 0}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter {selectedCount} chambre(s) et continuer
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
