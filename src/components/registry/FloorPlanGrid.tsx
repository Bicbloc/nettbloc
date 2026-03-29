import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bed, Building, Wrench, Edit, ClipboardList, Power, PowerOff,
  Plus, Trash2, Lock, Unlock, RotateCcw, DoorOpen, Square,
  Armchair, ArrowUpDown, Droplets, Wifi, Save, Loader2
} from 'lucide-react';
import { formatFloorLabel } from '@/utils/floorUtils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RoomRegistryItem {
  id: string;
  room_number: string;
  floor: number | null;
  room_type: string | null;
  building: string | null;
  zone: string | null;
  source: string | null;
  imported_from: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  space_category?: string | null;
}

interface MarkerType {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const MARKER_TYPES: MarkerType[] = [
  { id: 'corridor', label: 'Couloir', icon: 'door', color: 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600' },
  { id: 'closet', label: 'Placard', icon: 'square', color: 'bg-stone-200 dark:bg-stone-700 border-stone-300 dark:border-stone-600' },
  { id: 'elevator', label: 'Ascenseur', icon: 'arrows', color: 'bg-zinc-300 dark:bg-zinc-600 border-zinc-400 dark:border-zinc-500' },
  { id: 'stairs', label: 'Escalier', icon: 'arrows', color: 'bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500' },
  { id: 'bathroom', label: 'SDB commune', icon: 'droplets', color: 'bg-cyan-100 dark:bg-cyan-900 border-cyan-300 dark:border-cyan-700' },
  { id: 'lounge', label: 'Salon', icon: 'armchair', color: 'bg-violet-100 dark:bg-violet-900 border-violet-300 dark:border-violet-700' },
  { id: 'wifi', label: 'Local tech', icon: 'wifi', color: 'bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700' },
];

const getMarkerIcon = (iconId: string, className = 'h-3.5 w-3.5') => {
  switch (iconId) {
    case 'door': return <DoorOpen className={className} />;
    case 'square': return <Square className={className} />;
    case 'arrows': return <ArrowUpDown className={className} />;
    case 'droplets': return <Droplets className={className} />;
    case 'armchair': return <Armchair className={className} />;
    case 'wifi': return <Wifi className={className} />;
    default: return <Square className={className} />;
  }
};

interface GridCell {
  type: 'room' | 'marker' | 'empty';
  roomId?: string;
  markerId?: string;
}

interface FloorGridData {
  cols: number;
  cells: Record<string, GridCell>;
}

interface FloorPlanGridProps {
  rooms: RoomRegistryItem[];
  hotelId?: string;
  onEdit: (room: RoomRegistryItem) => void;
  onToggleActive: (room: RoomRegistryItem) => void;
  onViewActivity: (room: RoomRegistryItem) => void;
}

const DEFAULT_COLS = 10;
const DEFAULT_ROWS = 4;

const getCategoryIcon = (cat: string | null | undefined) => {
  switch (cat) {
    case 'common': return <Building className="h-3 w-3" />;
    case 'technical': return <Wrench className="h-3 w-3" />;
    default: return <Bed className="h-3 w-3" />;
  }
};

export const FloorPlanGrid: React.FC<FloorPlanGridProps> = ({
  rooms,
  hotelId,
  onEdit,
  onToggleActive,
  onViewActivity,
}) => {
  const { toast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [gridData, setGridData] = useState<Record<string, FloorGridData>>({});
  const [draggedItem, setDraggedItem] = useState<{ type: 'room' | 'marker'; roomId?: string; markerId?: string; fromKey?: string; fromFloor?: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load grid data from Supabase
  useEffect(() => {
    if (!hotelId) { setIsLoading(false); return; }
    
    const loadGridData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('floor_plan_layouts')
          .select('floor_key, grid_cols, cells')
          .eq('hotel_id', hotelId);

        if (error) throw error;

        const loaded: Record<string, FloorGridData> = {};
        data?.forEach((row: any) => {
          loaded[row.floor_key] = {
            cols: row.grid_cols || DEFAULT_COLS,
            cells: (row.cells as Record<string, GridCell>) || {},
          };
        });
        setGridData(loaded);
      } catch (err) {
        console.error('Error loading floor plan:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadGridData();
  }, [hotelId]);

  // Save grid data to Supabase
  const saveToDb = useCallback(async () => {
    if (!hotelId) return;
    setIsSaving(true);
    try {
      // Upsert each floor
      for (const [floorKey, floorData] of Object.entries(gridData)) {
        const { error } = await supabase
          .from('floor_plan_layouts')
          .upsert({
            hotel_id: hotelId,
            floor_key: floorKey,
            grid_cols: floorData.cols,
            cells: floorData.cells as any,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'hotel_id,floor_key' });

        if (error) throw error;
      }
      setHasUnsavedChanges(false);
      toast({ title: 'Plan sauvegardé', description: 'Le plan est visible par toute l\'équipe.' });
    } catch (err: any) {
      console.error('Error saving floor plan:', err);
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder le plan.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [hotelId, gridData, toast]);

  const resetGrid = useCallback(async () => {
    if (!hotelId) return;
    setIsSaving(true);
    try {
      await supabase.from('floor_plan_layouts').delete().eq('hotel_id', hotelId);
      setGridData({});
      setHasUnsavedChanges(false);
      toast({ title: 'Plan réinitialisé' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [hotelId, toast]);

  // Group rooms by floor
  const floorGroups = useMemo(() => {
    const groups = new Map<string, RoomRegistryItem[]>();
    rooms.forEach(room => {
      const floorKey = room.floor?.toString() ?? 'null';
      if (!groups.has(floorKey)) groups.set(floorKey, []);
      groups.get(floorKey)!.push(room);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'null') return 1;
      if (b[0] === 'null') return -1;
      return Number(b[0]) - Number(a[0]);
    });
  }, [rooms]);

  const roomsById = useMemo(() => {
    const map = new Map<string, RoomRegistryItem>();
    rooms.forEach(r => map.set(r.id, r));
    return map;
  }, [rooms]);

  // Build effective grid for each floor
  const getFloorGrid = useCallback((floorKey: string, floorRooms: RoomRegistryItem[]): { grid: FloorGridData; rows: number } => {
    const saved = gridData[floorKey];
    const cols = saved?.cols || DEFAULT_COLS;

    if (saved && Object.keys(saved.cells).length > 0) {
      let maxRow = 0;
      Object.keys(saved.cells).forEach(key => {
        const row = parseInt(key.split('-')[0]);
        if (row > maxRow) maxRow = row;
      });
      const placedRoomIds = new Set(
        Object.values(saved.cells).filter(c => c.type === 'room' && c.roomId).map(c => c.roomId!)
      );
      const unplaced = floorRooms.filter(r => !placedRoomIds.has(r.id));
      const extraRows = Math.ceil(unplaced.length / cols);
      return { grid: saved, rows: Math.max(maxRow + 1, DEFAULT_ROWS) + (unplaced.length > 0 ? extraRows : 0) };
    }

    // Auto-place rooms in grid
    const cells: Record<string, GridCell> = {};
    const sorted = [...floorRooms].sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
    sorted.forEach((room, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      cells[`${row}-${col}`] = { type: 'room', roomId: room.id };
    });
    const rows = Math.max(Math.ceil(sorted.length / cols), DEFAULT_ROWS);
    return { grid: { cols, cells }, rows };
  }, [gridData]);

  const updateGridData = useCallback((newData: Record<string, FloorGridData>) => {
    setGridData(newData);
    setHasUnsavedChanges(true);
  }, []);

  const handleDragStart = useCallback((type: 'room' | 'marker', id: string, cellKey?: string, floorKey?: string) => {
    setDraggedItem({ type, roomId: type === 'room' ? id : undefined, markerId: type === 'marker' ? id : undefined, fromKey: cellKey, fromFloor: floorKey });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell(cellKey);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, floorKey: string, cellKey: string) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedItem) return;

    const newGridData = { ...gridData };
    if (!newGridData[floorKey]) {
      newGridData[floorKey] = { cols: DEFAULT_COLS, cells: {} };
    }
    // Deep copy cells
    newGridData[floorKey] = { ...newGridData[floorKey], cells: { ...newGridData[floorKey].cells } };

    // Remove from old position (same floor only)
    if (draggedItem.fromKey && draggedItem.fromFloor === floorKey) {
      const targetCell = newGridData[floorKey].cells[cellKey];
      // Swap if target occupied by a room
      if (targetCell && targetCell.type === 'room' && draggedItem.type === 'room') {
        newGridData[floorKey].cells[draggedItem.fromKey] = targetCell;
      } else {
        delete newGridData[floorKey].cells[draggedItem.fromKey];
      }
    }

    // Place item
    if (draggedItem.type === 'room') {
      newGridData[floorKey].cells[cellKey] = { type: 'room', roomId: draggedItem.roomId };
    } else if (draggedItem.type === 'marker') {
      newGridData[floorKey].cells[cellKey] = { type: 'marker', markerId: draggedItem.markerId };
    }

    updateGridData(newGridData);
    setDraggedItem(null);
  }, [draggedItem, gridData, updateGridData]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverCell(null);
  }, []);

  const placeMarker = useCallback((floorKey: string, cellKey: string, markerId: string) => {
    const newGridData = { ...gridData };
    if (!newGridData[floorKey]) {
      newGridData[floorKey] = { cols: DEFAULT_COLS, cells: {} };
    }
    newGridData[floorKey] = { ...newGridData[floorKey], cells: { ...newGridData[floorKey].cells } };
    newGridData[floorKey].cells[cellKey] = { type: 'marker', markerId };
    updateGridData(newGridData);
  }, [gridData, updateGridData]);

  const clearCell = useCallback((floorKey: string, cellKey: string) => {
    const newGridData = { ...gridData };
    if (newGridData[floorKey]?.cells[cellKey]) {
      newGridData[floorKey] = { ...newGridData[floorKey], cells: { ...newGridData[floorKey].cells } };
      delete newGridData[floorKey].cells[cellKey];
      updateGridData(newGridData);
    }
  }, [gridData, updateGridData]);

  const hasGridData = Object.keys(gridData).length > 0 && Object.values(gridData).some(g => Object.keys(g.cells).length > 0);

  if (rooms.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Aucun espace trouvé</p>
        <p className="text-sm">Ajoutez des chambres ou espaces pour voir le plan</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
        <p className="text-sm">Chargement du plan...</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setIsEditMode(!isEditMode); setSelectedMarker(null); }}
          >
            {isEditMode ? <Unlock className="h-4 w-4 mr-1.5" /> : <Lock className="h-4 w-4 mr-1.5" />}
            {isEditMode ? 'Mode édition actif' : 'Réorganiser le plan'}
          </Button>
          {isEditMode && hasUnsavedChanges && (
            <Button variant="default" size="sm" onClick={saveToDb} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Sauvegarder
            </Button>
          )}
          {hasGridData && isEditMode && (
            <Button variant="ghost" size="sm" onClick={resetGrid} disabled={isSaving}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Réinitialiser
            </Button>
          )}
        </div>

        {/* Marker palette */}
        {isEditMode && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Dessiner :</span>
            {MARKER_TYPES.map(marker => (
              <Button
                key={marker.id}
                variant={selectedMarker === marker.id ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setSelectedMarker(selectedMarker === marker.id ? null : marker.id)}
              >
                {getMarkerIcon(marker.icon, 'h-3 w-3')}
                {marker.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {isEditMode && selectedMarker && (
        <div className="text-xs text-muted-foreground mb-2 bg-accent/50 px-3 py-1.5 rounded-md border border-accent">
          👆 Cliquez sur une case vide pour placer : <strong>{MARKER_TYPES.find(m => m.id === selectedMarker)?.label}</strong>
          <Button variant="ghost" size="sm" className="ml-2 h-5 px-1.5 text-xs" onClick={() => setSelectedMarker(null)}>✕ Annuler</Button>
        </div>
      )}

      {isEditMode && !selectedMarker && (
        <p className="text-xs text-muted-foreground mb-2">
          Glissez les chambres pour les déplacer. Sélectionnez un élément ci-dessus pour le dessiner.
        </p>
      )}

      {/* Grid per floor */}
      <div className="border-2 border-foreground/10 rounded-xl overflow-hidden bg-gradient-to-b from-background to-muted/20">
        <div className="h-3 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

        <div className="divide-y divide-foreground/5">
          {floorGroups.map(([floorKey, floorRooms]) => {
            const floorNum = floorKey === 'null' ? null : Number(floorKey);
            const { grid, rows } = getFloorGrid(floorKey, floorRooms);
            const cols = grid.cols;

            const placedRoomIds = new Set(
              Object.values(grid.cells).filter(c => c.type === 'room' && c.roomId).map(c => c.roomId!)
            );
            const unplacedRooms = floorRooms.filter(r => !placedRoomIds.has(r.id));

            return (
              <div key={floorKey} className="flex">
                {/* Floor label */}
                <div className="w-16 md:w-24 shrink-0 flex flex-col items-center justify-center py-3 px-2 bg-foreground/[0.02] border-r border-foreground/5">
                  <span className="text-base md:text-lg font-black text-foreground/80">
                    {formatFloorLabel(floorNum)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{floorRooms.length} espaces</span>
                </div>

                {/* Grid */}
                <div className="flex-1 p-2 md:p-3 overflow-x-auto">
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(72px, 1fr))` }}
                  >
                    {Array.from({ length: rows * cols }).map((_, idx) => {
                      const row = Math.floor(idx / cols);
                      const col = idx % cols;
                      const cellKey = `${row}-${col}`;
                      const cell = grid.cells[cellKey];
                      const fullCellKey = `${floorKey}-${cellKey}`;
                      const isOver = dragOverCell === fullCellKey;

                      if (cell?.type === 'room' && cell.roomId) {
                        const room = roomsById.get(cell.roomId);
                        if (!room) return <EmptyCell key={cellKey} cellKey={cellKey} floorKey={floorKey} isEditMode={isEditMode} isOver={isOver} selectedMarker={selectedMarker} onDragOver={handleDragOver} onDrop={handleDrop} onPlaceMarker={placeMarker} />;

                        return (
                          <RoomGridCell
                            key={cellKey}
                            room={room}
                            isEditMode={isEditMode}
                            isDragging={draggedItem?.type === 'room' && draggedItem.roomId === room.id}
                            isOver={isOver}
                            cellKey={cellKey}
                            floorKey={floorKey}
                            onEdit={onEdit}
                            onToggleActive={onToggleActive}
                            onViewActivity={onViewActivity}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onDrop={handleDrop}
                            onClear={clearCell}
                          />
                        );
                      }

                      if (cell?.type === 'marker' && cell.markerId) {
                        const marker = MARKER_TYPES.find(m => m.id === cell.markerId);
                        if (!marker) return <EmptyCell key={cellKey} cellKey={cellKey} floorKey={floorKey} isEditMode={isEditMode} isOver={isOver} selectedMarker={selectedMarker} onDragOver={handleDragOver} onDrop={handleDrop} onPlaceMarker={placeMarker} />;

                        return (
                          <MarkerCell
                            key={cellKey}
                            marker={marker}
                            isEditMode={isEditMode}
                            cellKey={cellKey}
                            floorKey={floorKey}
                            isOver={isOver}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClear={clearCell}
                          />
                        );
                      }

                      return (
                        <EmptyCell
                          key={cellKey}
                          cellKey={cellKey}
                          floorKey={floorKey}
                          isEditMode={isEditMode}
                          isOver={isOver}
                          selectedMarker={selectedMarker}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onPlaceMarker={placeMarker}
                        />
                      );
                    })}
                  </div>

                  {/* Unplaced rooms tray */}
                  {unplacedRooms.length > 0 && isEditMode && (
                    <div className="mt-2 pt-2 border-t border-dashed border-foreground/10">
                      <p className="text-[10px] text-muted-foreground mb-1">Non placées — glissez vers la grille :</p>
                      <div className="flex flex-wrap gap-1">
                        {unplacedRooms.map(room => (
                          <div
                            key={room.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              handleDragStart('room', room.id, undefined, floorKey);
                            }}
                            onDragEnd={handleDragEnd}
                            className="border border-dashed border-primary/40 bg-primary/5 rounded px-2 py-1 text-xs font-medium cursor-grab active:cursor-grabbing flex items-center gap-1"
                          >
                            {getCategoryIcon(room.space_category)}
                            {room.room_number}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-2 bg-gradient-to-r from-foreground/10 via-foreground/20 to-foreground/10" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 bg-primary/5 border-primary/20" />
          <span>Chambre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 bg-blue-500/10 border-blue-500/30" />
          <span>Espace commun</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 bg-amber-500/10 border-amber-500/30" />
          <span>Espace technique</span>
        </div>
        {MARKER_TYPES.slice(0, 4).map(m => (
          <div key={m.id} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${m.color}`} />
            <span>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Sub-components ---

const RoomGridCell: React.FC<{
  room: RoomRegistryItem;
  isEditMode: boolean;
  isDragging: boolean;
  isOver: boolean;
  cellKey: string;
  floorKey: string;
  onEdit: (room: RoomRegistryItem) => void;
  onToggleActive: (room: RoomRegistryItem) => void;
  onViewActivity: (room: RoomRegistryItem) => void;
  onDragStart: (type: 'room', id: string, cellKey: string, floorKey: string) => void;
  onDragOver: (e: React.DragEvent, cellKey: string) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, floorKey: string, cellKey: string) => void;
  onClear: (floorKey: string, cellKey: string) => void;
}> = ({ room, isEditMode, isDragging, isOver, cellKey, floorKey, onEdit, onToggleActive, onViewActivity, onDragStart, onDragOver, onDragEnd, onDrop, onClear }) => {
  const isActive = room.is_active ?? true;

  const colorClass = (() => {
    if (!isActive) return 'bg-muted/60 border-muted-foreground/20 text-muted-foreground opacity-60';
    switch (room.space_category) {
      case 'common': return 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300';
      case 'technical': return 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300';
      default: return 'bg-primary/5 border-primary/20 text-foreground';
    }
  })();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable={isEditMode}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              onDragStart('room', room.id, cellKey, floorKey);
            }}
            onDragOver={(e) => onDragOver(e, `${floorKey}-${cellKey}`)}
            onDragEnd={onDragEnd}
            onDrop={(e) => onDrop(e, floorKey, cellKey)}
            className={`group relative border rounded-md p-1.5 min-h-[52px] flex flex-col items-center justify-center text-center transition-all duration-150 select-none ${colorClass} ${
              isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            } ${isDragging ? 'opacity-30 scale-90' : ''} ${
              isOver ? 'ring-2 ring-primary ring-offset-1 scale-105' : ''
            }`}
          >
            <div className="flex items-center gap-0.5">
              {getCategoryIcon(room.space_category)}
              <span className="font-bold text-xs leading-tight">{room.room_number}</span>
            </div>
            {room.room_type && (
              <span className="text-[9px] opacity-60 truncate max-w-full leading-tight">{room.room_type}</span>
            )}

            {/* Actions overlay */}
            {!isEditMode && (
              <div className="absolute inset-0 bg-background/90 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onEdit(room); }}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onViewActivity(room); }}>
                  <ClipboardList className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onToggleActive(room); }}>
                  {isActive ? <PowerOff className="h-3 w-3 text-destructive" /> : <Power className="h-3 w-3 text-green-500" />}
                </Button>
              </div>
            )}

            {isEditMode && (
              <button
                onClick={(e) => { e.stopPropagation(); onClear(floorKey, cellKey); }}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">{room.room_number}</p>
          {room.room_type && <p>Type: {room.room_type}</p>}
          {room.building && <p>Bâtiment: {room.building}</p>}
          <p>Statut: {isActive ? '✅ Actif' : '⛔ Inactif'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const MarkerCell: React.FC<{
  marker: MarkerType;
  isEditMode: boolean;
  cellKey: string;
  floorKey: string;
  isOver: boolean;
  onDragOver: (e: React.DragEvent, cellKey: string) => void;
  onDrop: (e: React.DragEvent, floorKey: string, cellKey: string) => void;
  onClear: (floorKey: string, cellKey: string) => void;
}> = ({ marker, isEditMode, cellKey, floorKey, isOver, onDragOver, onDrop, onClear }) => {
  return (
    <div
      onDragOver={(e) => onDragOver(e, `${floorKey}-${cellKey}`)}
      onDrop={(e) => onDrop(e, floorKey, cellKey)}
      className={`group relative border rounded-md p-1.5 min-h-[52px] flex flex-col items-center justify-center text-center ${marker.color} transition-all ${
        isOver ? 'ring-2 ring-primary ring-offset-1 scale-105' : ''
      }`}
    >
      {getMarkerIcon(marker.icon, 'h-4 w-4 opacity-60')}
      <span className="text-[9px] opacity-70 font-medium mt-0.5">{marker.label}</span>

      {isEditMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(floorKey, cellKey); }}
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
};

const EmptyCell: React.FC<{
  cellKey: string;
  floorKey: string;
  isEditMode: boolean;
  isOver: boolean;
  selectedMarker: string | null;
  onDragOver: (e: React.DragEvent, cellKey: string) => void;
  onDrop: (e: React.DragEvent, floorKey: string, cellKey: string) => void;
  onPlaceMarker: (floorKey: string, cellKey: string, markerId: string) => void;
}> = ({ cellKey, floorKey, isEditMode, isOver, selectedMarker, onDragOver, onDrop, onPlaceMarker }) => {
  if (!isEditMode) {
    return <div className="min-h-[52px] rounded-md" />;
  }

  const hasMarkerSelected = !!selectedMarker;
  const markerInfo = selectedMarker ? MARKER_TYPES.find(m => m.id === selectedMarker) : null;

  return (
    <div
      onDragOver={(e) => onDragOver(e, `${floorKey}-${cellKey}`)}
      onDrop={(e) => onDrop(e, floorKey, cellKey)}
      onClick={() => {
        if (selectedMarker) {
          onPlaceMarker(floorKey, cellKey, selectedMarker);
        }
      }}
      className={`min-h-[52px] rounded-md border border-dashed transition-all flex flex-col items-center justify-center ${
        isOver ? 'border-primary bg-primary/10 scale-105' : 'border-foreground/10'
      } ${hasMarkerSelected ? 'cursor-pointer hover:border-primary/50 hover:bg-accent/30' : ''}`}
    >
      {hasMarkerSelected && markerInfo && (
        <div className="flex flex-col items-center opacity-30 hover:opacity-60 transition-opacity">
          {getMarkerIcon(markerInfo.icon, 'h-3 w-3')}
          <Plus className="h-2 w-2 mt-0.5" />
        </div>
      )}
    </div>
  );
};
