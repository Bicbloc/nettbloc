import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, Eye, EyeOff, Wand2, Save } from "lucide-react";
import { ExtractedRoom, CleaningType } from "@/services/pms/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ParsedLine {
  index: number;
  raw: string;
  columns: string[];
  room?: ExtractedRoom;
}

interface LinePatternMapperProps {
  rawText: string;
  rooms: ExtractedRoom[];
  hotelId: string;
  userId: string;
  onComplete: (rooms: ExtractedRoom[]) => void;
  onBack: () => void;
}

// Detecter le séparateur de colonnes
function detectSeparator(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  const sample = lines.slice(0, 20).join('\n');
  
  const tabCount = (sample.match(/\t/g) || []).length;
  const pipeCount = (sample.match(/\|/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  
  if (tabCount > pipeCount && tabCount > semicolonCount) return '\t';
  if (pipeCount > semicolonCount) return '|';
  if (semicolonCount > 5) return ';';
  return '\t'; // Default
}

// Parser les lignes en colonnes
function parseLines(text: string, rooms: ExtractedRoom[]): ParsedLine[] {
  const separator = detectSeparator(text);
  const lines = text.split('\n');
  
  // Map room number to room
  const roomMap = new Map<string, ExtractedRoom>();
  rooms.forEach(r => {
    if (r.roomNumber) {
      roomMap.set(r.roomNumber.trim(), r);
      // Also try without leading zeros
      roomMap.set(r.roomNumber.replace(/^0+/, ''), r);
    }
  });
  
  return lines.map((line, index) => {
    const columns = line.split(separator).map(c => c.trim());
    
    // Find matching room
    let matchedRoom: ExtractedRoom | undefined;
    for (const col of columns) {
      if (roomMap.has(col)) {
        matchedRoom = roomMap.get(col);
        break;
      }
    }
    
    return {
      index,
      raw: line,
      columns,
      room: matchedRoom
    };
  });
}

// Extraire une signature de pattern d'une ligne
function extractPattern(columns: string[], excludedCols: Set<number>): string {
  return columns
    .map((col, idx) => {
      if (excludedCols.has(idx)) return '[EXCLU]';
      // Normaliser: remplacer les chiffres par des placeholders
      let normalized = col
        .replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, '[DATE]')
        .replace(/\d{1,2}[h:\.]\d{2}/gi, '[HEURE]')
        .replace(/\b\d{1,4}\b/g, '[NUM]')
        .toUpperCase()
        .trim();
      return normalized || '[VIDE]';
    })
    .join('|');
}

export const LinePatternMapper = ({
  rawText,
  rooms,
  hotelId,
  userId,
  onComplete,
  onBack
}: LinePatternMapperProps) => {
  const parsedLines = useMemo(() => parseLines(rawText, rooms), [rawText, rooms]);
  
  const [excludedColumns, setExcludedColumns] = useState<Set<number>>(new Set());
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [assignedCleaningType, setAssignedCleaningType] = useState<CleaningType | null>(null);
  const [modifiedRooms, setModifiedRooms] = useState<Map<string, CleaningType>>(new Map());
  
  // Calculer le nombre max de colonnes
  const maxColumns = useMemo(() => {
    return Math.max(...parsedLines.map(l => l.columns.length), 0);
  }, [parsedLines]);
  
  // Grouper les lignes par pattern similaire
  const patternGroups = useMemo(() => {
    const groups = new Map<string, number[]>();
    
    parsedLines.forEach((line, idx) => {
      if (line.columns.length > 1) {
        const pattern = extractPattern(line.columns, excludedColumns);
        if (!groups.has(pattern)) {
          groups.set(pattern, []);
        }
        groups.get(pattern)!.push(idx);
      }
    });
    
    return groups;
  }, [parsedLines, excludedColumns]);
  
  // Trouver les lignes similaires à la ligne survolée
  const similarLines = useMemo(() => {
    if (hoveredLine === null) return new Set<number>();
    
    const hoveredPattern = extractPattern(
      parsedLines[hoveredLine]?.columns || [], 
      excludedColumns
    );
    
    return new Set(patternGroups.get(hoveredPattern) || []);
  }, [hoveredLine, parsedLines, excludedColumns, patternGroups]);
  
  // Toggle exclusion d'une colonne
  const toggleColumnExclusion = (colIndex: number) => {
    const newExcluded = new Set(excludedColumns);
    if (newExcluded.has(colIndex)) {
      newExcluded.delete(colIndex);
    } else {
      newExcluded.add(colIndex);
    }
    setExcludedColumns(newExcluded);
    setSelectedLines(new Set()); // Reset selection when changing columns
  };
  
  // Sélectionner une ligne et toutes les similaires
  const selectLineAndSimilar = (lineIndex: number) => {
    const pattern = extractPattern(parsedLines[lineIndex]?.columns || [], excludedColumns);
    const similar = patternGroups.get(pattern) || [];
    
    // Toggle: si déjà sélectionné, désélectionner
    if (selectedLines.has(lineIndex)) {
      const newSelected = new Set(selectedLines);
      similar.forEach(idx => newSelected.delete(idx));
      setSelectedLines(newSelected);
    } else {
      const newSelected = new Set(selectedLines);
      similar.forEach(idx => newSelected.add(idx));
      setSelectedLines(newSelected);
    }
  };
  
  // Appliquer le type de nettoyage aux lignes sélectionnées
  const applyCleaningType = (cleaningType: CleaningType) => {
    const newModified = new Map(modifiedRooms);
    
    selectedLines.forEach(idx => {
      const line = parsedLines[idx];
      if (line?.room?.roomNumber) {
        newModified.set(line.room.roomNumber, cleaningType);
      }
    });
    
    setModifiedRooms(newModified);
    setAssignedCleaningType(cleaningType);
    toast.success(`${selectedLines.size} lignes assignées: ${cleaningType}`);
  };
  
  // Sauvegarder et continuer
  const handleSave = async () => {
    // Créer les chambres mises à jour
    const updatedRooms = rooms.map(room => {
      const modifiedType = modifiedRooms.get(room.roomNumber);
      if (modifiedType) {
        return {
          ...room,
          cleaningType: modifiedType,
          validated: true
        };
      }
      return room;
    });
    
    // Si des modifications ont été faites, sauvegarder une règle
    if (modifiedRooms.size > 0) {
      try {
        // Extraire les patterns uniques utilisés
        const usedPatterns: string[] = [];
        selectedLines.forEach(idx => {
          const line = parsedLines[idx];
          if (line?.room) {
            const pattern = extractPattern(line.columns, excludedColumns);
            if (!usedPatterns.includes(pattern)) {
              usedPatterns.push(pattern);
            }
          }
        });
        
        // Sauvegarder la règle
        await supabase.from('hotel_detection_rules').insert({
          hotel_id: hotelId,
          rule_type: 'line_pattern',
          rule_name: `Pattern auto - ${new Date().toLocaleDateString()}`,
          condition: {
            patterns: usedPatterns,
            excludedColumns: Array.from(excludedColumns)
          },
          result: {
            cleaningType: assignedCleaningType
          },
          created_by: userId
        });
        
        toast.success("Règle sauvegardée pour les prochains imports");
      } catch (error) {
        console.error('Error saving rule:', error);
      }
    }
    
    onComplete(updatedRooms);
  };
  
  // Stats
  const selectedWithRooms = Array.from(selectedLines).filter(idx => parsedLines[idx]?.room).length;
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Mapping des lignes</h3>
          <p className="text-sm text-muted-foreground">
            Survolez une ligne pour voir les similaires, cliquez pour sélectionner
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>Retour</Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Sauvegarder
          </Button>
        </div>
      </div>
      
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Colonnes exclues:</span>
            <div className="flex gap-1">
              {Array.from({ length: maxColumns }, (_, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={excludedColumns.has(i) ? "destructive" : "outline"}
                  onClick={() => toggleColumnExclusion(i)}
                  className="w-8 h-8 p-0"
                >
                  {excludedColumns.has(i) ? <EyeOff className="w-3 h-3" /> : i + 1}
                </Button>
              ))}
            </div>
          </div>
          
          {selectedLines.size > 0 && (
            <>
              <div className="h-6 w-px bg-border" />
              <Badge variant="secondary">
                {selectedLines.size} lignes ({selectedWithRooms} chambres)
              </Badge>
              <Select onValueChange={(v) => applyCleaningType(v as CleaningType)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Assigner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_blanc">Check-out (departure)</SelectItem>
                  <SelectItem value="recouche">Stayover (occupied)</SelectItem>
                  <SelectItem value="none">No cleaning</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </Card>
      
      {/* Légende */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/20" />
          <span>Survolé/Similaires</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary" />
          <span>Sélectionné</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/20 text-green-700">recouche</Badge>
          <Badge variant="outline" className="bg-blue-500/20 text-blue-700">a_blanc</Badge>
          <Badge variant="outline" className="bg-gray-500/20">none</Badge>
        </div>
      </div>
      
      {/* Table */}
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-20">Chambre</TableHead>
                <TableHead className="w-24">Type</TableHead>
                {Array.from({ length: maxColumns }, (_, i) => (
                  <TableHead 
                    key={i}
                    className={excludedColumns.has(i) ? "opacity-30 line-through" : ""}
                  >
                    Col {i + 1}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsedLines.map((line, idx) => {
                const isHovered = similarLines.has(idx);
                const isSelected = selectedLines.has(idx);
                const hasRoom = !!line.room;
                const modifiedType = line.room ? modifiedRooms.get(line.room.roomNumber) : null;
                const currentType = modifiedType || line.room?.cleaningType;
                
                if (line.columns.length <= 1) return null; // Skip empty/header lines
                
                return (
                  <TableRow
                    key={idx}
                    className={`cursor-pointer transition-colors ${
                      isSelected 
                        ? "bg-primary text-primary-foreground" 
                        : isHovered 
                          ? "bg-primary/20" 
                          : ""
                    } ${!hasRoom ? "opacity-50" : ""}`}
                    onMouseEnter={() => setHoveredLine(idx)}
                    onMouseLeave={() => setHoveredLine(null)}
                    onClick={() => selectLineAndSimilar(idx)}
                  >
                    <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {line.room?.roomNumber || "-"}
                    </TableCell>
                    <TableCell>
                      {currentType && (
                        <Badge 
                          variant="outline"
                          className={
                            currentType === 'recouche' 
                              ? "bg-green-500/20 text-green-700" 
                              : currentType === 'a_blanc'
                                ? "bg-blue-500/20 text-blue-700"
                                : "bg-gray-500/20"
                          }
                        >
                          {currentType}
                        </Badge>
                      )}
                    </TableCell>
                    {Array.from({ length: maxColumns }, (_, colIdx) => (
                      <TableCell 
                        key={colIdx}
                        className={`text-xs ${
                          excludedColumns.has(colIdx) ? "opacity-30 line-through" : ""
                        }`}
                      >
                        {line.columns[colIdx] || ""}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
      
      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        {parsedLines.length} lignes • {patternGroups.size} patterns uniques • {rooms.length} chambres détectées
      </div>
    </div>
  );
};
