import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Check, ChevronLeft, ArrowRight, Plus, 
  Sparkles, Search, CheckCircle2, Trash2, Edit2
} from "lucide-react";
import { ExtractedRoom } from "@/services/pms";
import { TrainingData } from "./TrainingWizard";
import { cn } from "@/lib/utils";

interface TrainingStep3AnnotateProps {
  trainingData: TrainingData;
  hotelId: string;
  userId: string;
  onComplete: (rooms: ExtractedRoom[]) => void;
  onBack: () => void;
  onOpenAdvanced?: () => void;
}

// Labels pour les types de nettoyage
const CLEANING_CONFIG = {
  'a_blanc': { label: 'À blanc', emoji: '🔶', color: 'bg-orange-500', bgLight: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-600' },
  'full': { label: 'À blanc', emoji: '🔶', color: 'bg-orange-500', bgLight: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-600' },
  'recouche': { label: 'Recouche', emoji: '🔄', color: 'bg-green-500', bgLight: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-600' },
  'quick': { label: 'Recouche', emoji: '🔄', color: 'bg-green-500', bgLight: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-600' },
  'none': { label: 'Aucun', emoji: '⏸️', color: 'bg-gray-400', bgLight: 'bg-gray-100 dark:bg-gray-900/30', textColor: 'text-gray-600' },
} as const;

type CleaningType = keyof typeof CLEANING_CONFIG;

export const TrainingStep3Annotate = ({
  trainingData,
  hotelId,
  userId,
  onComplete,
  onBack,
  onOpenAdvanced,
}: TrainingStep3AnnotateProps) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<ExtractedRoom[]>(trainingData.extractedRooms);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [bulkType, setBulkType] = useState<CleaningType | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<'all' | CleaningType>('all');

  // Collator pour tri naturel
  const collator = useMemo(() => new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }), []);

  // Chambres filtrées et triées
  const displayedRooms = useMemo(() => {
    let filtered = rooms.map((room, index) => ({ room, originalIndex: index }));
    
    // Filtre texte
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(({ room }) => 
        room.roomNumber.toLowerCase().includes(search) ||
        room.originalText?.toLowerCase().includes(search)
      );
    }
    
    // Filtre type
    if (filterType !== 'all') {
      filtered = filtered.filter(({ room }) => {
        const type = room.cleaningType;
        if (filterType === 'a_blanc') return type === 'a_blanc' || type === 'full';
        if (filterType === 'recouche') return type === 'recouche' || type === 'quick';
        return type === filterType;
      });
    }
    
    // Tri
    filtered.sort((a, b) => {
      const cmp = collator.compare(a.room.roomNumber, b.room.roomNumber);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    
    return filtered;
  }, [rooms, searchFilter, filterType, sortOrder, collator]);

  // Stats
  const stats = useMemo(() => {
    const aBlanc = rooms.filter(r => r.cleaningType === 'a_blanc' || r.cleaningType === 'full').length;
    const recouche = rooms.filter(r => r.cleaningType === 'recouche' || r.cleaningType === 'quick').length;
    const none = rooms.filter(r => r.cleaningType === 'none').length;
    const validated = rooms.filter(r => r.validated).length;
    return { total: rooms.length, aBlanc, recouche, none, validated };
  }, [rooms]);

  // Changer le type d'une chambre
  const changeType = useCallback((index: number, type: CleaningType) => {
    setRooms(prev => prev.map((r, i) => 
      i === index ? { ...r, cleaningType: type, validated: true } : r
    ));
  }, []);

  // Toggle sélection
  const toggleSelect = useCallback((index: number) => {
    setSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Sélectionner tout
  const selectAll = useCallback(() => {
    if (selectedRooms.size === displayedRooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(displayedRooms.map(d => d.originalIndex)));
    }
  }, [displayedRooms, selectedRooms]);

  // Appliquer type en masse
  const applyBulkType = useCallback((type: CleaningType) => {
    if (selectedRooms.size === 0) {
      toast({ title: "Sélectionnez des chambres", variant: "destructive" });
      return;
    }
    setRooms(prev => prev.map((r, i) => 
      selectedRooms.has(i) ? { ...r, cleaningType: type, validated: true } : r
    ));
    toast({ title: `${selectedRooms.size} chambres modifiées` });
    setSelectedRooms(new Set());
  }, [selectedRooms, toast]);

  // Supprimer sélection
  const deleteSelected = useCallback(() => {
    if (selectedRooms.size === 0) return;
    setRooms(prev => prev.filter((_, i) => !selectedRooms.has(i)));
    toast({ title: `${selectedRooms.size} chambres supprimées` });
    setSelectedRooms(new Set());
  }, [selectedRooms, toast]);

  // Valider toutes
  const validateAll = useCallback(() => {
    setRooms(prev => prev.map(r => ({ ...r, validated: true })));
    toast({ title: "Toutes les chambres validées" });
  }, [toast]);

  // Continuer
  const handleContinue = useCallback(() => {
    onComplete(rooms.map(r => ({ ...r, validated: true })));
  }, [rooms, onComplete]);

  const getConfig = (type: string) => {
    return CLEANING_CONFIG[type as CleaningType] || CLEANING_CONFIG['none'];
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card className="p-2 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
        <Card 
          className={cn("p-2 text-center cursor-pointer transition-all", 
            filterType === 'a_blanc' && "ring-2 ring-orange-500",
            "bg-orange-50 dark:bg-orange-900/20"
          )}
          onClick={() => setFilterType(filterType === 'a_blanc' ? 'all' : 'a_blanc')}
        >
          <p className="text-2xl font-bold text-orange-600">{stats.aBlanc}</p>
          <p className="text-xs text-orange-600">À blanc</p>
        </Card>
        <Card 
          className={cn("p-2 text-center cursor-pointer transition-all",
            filterType === 'recouche' && "ring-2 ring-green-500",
            "bg-green-50 dark:bg-green-900/20"
          )}
          onClick={() => setFilterType(filterType === 'recouche' ? 'all' : 'recouche')}
        >
          <p className="text-2xl font-bold text-green-600">{stats.recouche}</p>
          <p className="text-xs text-green-600">Recouche</p>
        </Card>
        <Card 
          className={cn("p-2 text-center cursor-pointer transition-all",
            filterType === 'none' && "ring-2 ring-gray-500",
            "bg-gray-50 dark:bg-gray-900/20"
          )}
          onClick={() => setFilterType(filterType === 'none' ? 'all' : 'none')}
        >
          <p className="text-2xl font-bold text-gray-600">{stats.none}</p>
          <p className="text-xs text-gray-600">Aucun</p>
        </Card>
        <Card className="p-2 text-center bg-primary/10">
          <p className="text-2xl font-bold text-primary">{stats.validated}</p>
          <p className="text-xs text-primary">Validées</p>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        
        <Button size="sm" variant="outline" onClick={selectAll}>
          {selectedRooms.size === displayedRooms.length ? 'Désélectionner' : 'Tout sélectionner'}
        </Button>
        
        <Button size="sm" variant="outline" onClick={validateAll} className="gap-1">
          <CheckCircle2 className="h-4 w-4" />
          Tout valider
        </Button>
        
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? '↑ A-Z' : '↓ Z-A'}
        </Button>
      </div>

      {/* Bulk actions */}
      {selectedRooms.size > 0 && (
        <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{selectedRooms.size} sélectionnée(s) :</span>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => applyBulkType('a_blanc')}>
              🔶 À blanc
            </Button>
            <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => applyBulkType('recouche')}>
              🔄 Recouche
            </Button>
            <Button size="sm" variant="secondary" onClick={() => applyBulkType('none')}>
              ⏸️ Aucun
            </Button>
            <Button size="sm" variant="destructive" onClick={deleteSelected}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Rooms List */}
      <ScrollArea className="h-[350px] border rounded-lg">
        <div className="p-2 space-y-1">
          {displayedRooms.map(({ room, originalIndex }) => {
            const config = getConfig(room.cleaningType || 'none');
            const isSelected = selectedRooms.has(originalIndex);
            
            return (
              <div
                key={originalIndex}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-all",
                  config.bgLight,
                  isSelected && "ring-2 ring-primary"
                )}
              >
                {/* Checkbox */}
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelect(originalIndex)}
                />
                
                {/* Room number */}
                <Badge variant="secondary" className="text-base font-bold min-w-[60px] justify-center">
                  {room.roomNumber}
                </Badge>
                
                {/* Type buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => changeType(originalIndex, 'a_blanc')}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      (room.cleaningType === 'a_blanc' || room.cleaningType === 'full')
                        ? "bg-orange-500 text-white ring-2 ring-offset-1 ring-orange-500"
                        : "bg-muted hover:bg-orange-200"
                    )}
                    title="À blanc"
                  >
                    {(room.cleaningType === 'a_blanc' || room.cleaningType === 'full') ? <Check className="h-4 w-4" /> : '🔶'}
                  </button>
                  <button
                    onClick={() => changeType(originalIndex, 'recouche')}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      (room.cleaningType === 'recouche' || room.cleaningType === 'quick')
                        ? "bg-green-500 text-white ring-2 ring-offset-1 ring-green-500"
                        : "bg-muted hover:bg-green-200"
                    )}
                    title="Recouche"
                  >
                    {(room.cleaningType === 'recouche' || room.cleaningType === 'quick') ? <Check className="h-4 w-4" /> : '🔄'}
                  </button>
                  <button
                    onClick={() => changeType(originalIndex, 'none')}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      room.cleaningType === 'none'
                        ? "bg-gray-500 text-white ring-2 ring-offset-1 ring-gray-500"
                        : "bg-muted hover:bg-gray-200"
                    )}
                    title="Aucun"
                  >
                    {room.cleaningType === 'none' ? <Check className="h-4 w-4" /> : '⏸️'}
                  </button>
                </div>
                
                {/* Original text preview */}
                <span className="flex-1 text-xs text-muted-foreground truncate">
                  {room.originalText?.substring(0, 50)}...
                </span>
                
                {/* Validated badge */}
                {room.validated && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
            );
          })}
          
          {displayedRooms.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchFilter ? 'Aucun résultat' : 'Aucune chambre'}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Button>
        <Button onClick={handleContinue} className="gap-2">
          Sauvegarder
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
