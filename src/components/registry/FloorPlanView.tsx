import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit, ClipboardList, Power, PowerOff, Bed, Building, Wrench, GripVertical, RotateCcw, Lock, Unlock } from 'lucide-react';
import { formatFloorLabel } from '@/utils/floorUtils';

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

interface FloorPlanViewProps {
  rooms: RoomRegistryItem[];
  hotelId?: string;
  onEdit: (room: RoomRegistryItem) => void;
  onToggleActive: (room: RoomRegistryItem) => void;
  onViewActivity: (room: RoomRegistryItem) => void;
}

const STORAGE_KEY_PREFIX = 'floorplan-order-';

const getCategoryIcon = (cat: string | null | undefined) => {
  switch (cat) {
    case 'common': return <Building className="h-3.5 w-3.5" />;
    case 'technical': return <Wrench className="h-3.5 w-3.5" />;
    default: return <Bed className="h-3.5 w-3.5" />;
  }
};

const getCategoryColor = (cat: string | null | undefined, isActive: boolean) => {
  if (!isActive) return 'bg-muted/60 border-muted-foreground/20 text-muted-foreground opacity-60';
  switch (cat) {
    case 'common': return 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/50';
    case 'technical': return 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50';
    default: return 'bg-primary/5 border-primary/20 text-foreground hover:bg-primary/10 hover:border-primary/40';
  }
};

const RoomCell: React.FC<{
  room: RoomRegistryItem;
  isEditMode: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onEdit: (room: RoomRegistryItem) => void;
  onToggleActive: (room: RoomRegistryItem) => void;
  onViewActivity: (room: RoomRegistryItem) => void;
  onDragStart: (e: React.DragEvent, room: RoomRegistryItem) => void;
  onDragOver: (e: React.DragEvent, room: RoomRegistryItem) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, room: RoomRegistryItem) => void;
}> = ({ room, isEditMode, isDragging, isDragOver, onEdit, onToggleActive, onViewActivity, onDragStart, onDragOver, onDragEnd, onDrop }) => {
  const isActive = room.is_active ?? true;
  const colorClass = getCategoryColor(room.space_category, isActive);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable={isEditMode}
            onDragStart={(e) => onDragStart(e, room)}
            onDragOver={(e) => onDragOver(e, room)}
            onDragEnd={onDragEnd}
            onDrop={(e) => onDrop(e, room)}
            className={`group relative border-2 rounded-lg p-2.5 transition-all duration-200 min-w-[90px] select-none ${colorClass} ${
              isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            } ${isDragging ? 'opacity-30 scale-95' : ''} ${
              isDragOver ? 'ring-2 ring-primary ring-offset-2 scale-105' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {isEditMode && <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />}
              {getCategoryIcon(room.space_category)}
              <span className="font-bold text-sm truncate">{room.room_number}</span>
            </div>
            {room.room_type && (
              <span className="text-[10px] opacity-70 truncate block">{room.room_type}</span>
            )}
            {room.building && (
              <span className="text-[10px] opacity-50 truncate block">Bât. {room.building}</span>
            )}
            {/* Hover actions overlay - only in view mode */}
            {!isEditMode && (
              <div className="absolute inset-0 bg-background/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(room); }}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onViewActivity(room); }}>
                  <ClipboardList className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onToggleActive(room); }}>
                  {isActive ? <PowerOff className="h-3.5 w-3.5 text-destructive" /> : <Power className="h-3.5 w-3.5 text-green-500" />}
                </Button>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <p className="font-semibold">{room.room_number}</p>
            {room.room_type && <p>Type: {room.room_type}</p>}
            {room.building && <p>Bâtiment: {room.building}</p>}
            {room.zone && <p>Zone: {room.zone}</p>}
            <p>Statut: {isActive ? '✅ Actif' : '⛔ Inactif'}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const FloorPlanView: React.FC<FloorPlanViewProps> = ({
  rooms,
  hotelId,
  onEdit,
  onToggleActive,
  onViewActivity,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedRoom, setDraggedRoom] = useState<RoomRegistryItem | null>(null);
  const [dragOverRoom, setDragOverRoom] = useState<string | null>(null);
  const [customOrder, setCustomOrder] = useState<Record<string, string[]>>({});

  const storageKey = `${STORAGE_KEY_PREFIX}${hotelId || 'default'}`;

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCustomOrder(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Save order to localStorage
  const saveOrder = useCallback((order: Record<string, string[]>) => {
    setCustomOrder(order);
    try {
      localStorage.setItem(storageKey, JSON.stringify(order));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const resetOrder = useCallback(() => {
    setCustomOrder({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Group rooms by floor with custom ordering
  const floorGroups = React.useMemo(() => {
    const groups = new Map<string, RoomRegistryItem[]>();
    rooms.forEach(room => {
      const floorKey = room.floor?.toString() ?? 'null';
      if (!groups.has(floorKey)) groups.set(floorKey, []);
      groups.get(floorKey)!.push(room);
    });

    // Sort floors descending
    const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'null') return 1;
      if (b[0] === 'null') return -1;
      return Number(b[0]) - Number(a[0]);
    });

    // Apply custom order or default natural sort
    sortedEntries.forEach(([floorKey, floorRooms]) => {
      const savedOrder = customOrder[floorKey];
      if (savedOrder && savedOrder.length > 0) {
        const orderMap = new Map(savedOrder.map((id, idx) => [id, idx]));
        floorRooms.sort((a, b) => {
          const aIdx = orderMap.get(a.id) ?? 999;
          const bIdx = orderMap.get(b.id) ?? 999;
          return aIdx - bIdx;
        });
      } else {
        floorRooms.sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
      }
    });

    return sortedEntries;
  }, [rooms, customOrder]);

  const handleDragStart = useCallback((e: React.DragEvent, room: RoomRegistryItem) => {
    setDraggedRoom(room);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', room.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, room: RoomRegistryItem) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedRoom && draggedRoom.id !== room.id) {
      setDragOverRoom(room.id);
    }
  }, [draggedRoom]);

  const handleDragEnd = useCallback(() => {
    setDraggedRoom(null);
    setDragOverRoom(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetRoom: RoomRegistryItem) => {
    e.preventDefault();
    if (!draggedRoom || draggedRoom.id === targetRoom.id) {
      handleDragEnd();
      return;
    }

    // Find the floor of the target
    const targetFloorKey = targetRoom.floor?.toString() ?? 'null';
    const draggedFloorKey = draggedRoom.floor?.toString() ?? 'null';

    // Only allow reordering within same floor
    if (targetFloorKey !== draggedFloorKey) {
      handleDragEnd();
      return;
    }

    // Get current order for this floor
    const floorEntry = floorGroups.find(([key]) => key === targetFloorKey);
    if (!floorEntry) {
      handleDragEnd();
      return;
    }

    const currentIds = floorEntry[1].map(r => r.id);
    const dragIdx = currentIds.indexOf(draggedRoom.id);
    const targetIdx = currentIds.indexOf(targetRoom.id);

    if (dragIdx === -1 || targetIdx === -1) {
      handleDragEnd();
      return;
    }

    // Reorder
    const newIds = [...currentIds];
    newIds.splice(dragIdx, 1);
    newIds.splice(targetIdx, 0, draggedRoom.id);

    const newOrder = { ...customOrder, [targetFloorKey]: newIds };
    saveOrder(newOrder);
    handleDragEnd();
  }, [draggedRoom, floorGroups, customOrder, saveOrder, handleDragEnd]);

  const hasCustomOrder = Object.keys(customOrder).length > 0;

  if (rooms.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Aucun espace trouvé</p>
        <p className="text-sm">Ajoutez des chambres ou espaces pour voir le plan</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Edit mode toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? <Unlock className="h-4 w-4 mr-1.5" /> : <Lock className="h-4 w-4 mr-1.5" />}
            {isEditMode ? 'Mode édition actif' : 'Réorganiser le plan'}
          </Button>
          {hasCustomOrder && (
            <Button variant="ghost" size="sm" onClick={resetOrder}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Réinitialiser
            </Button>
          )}
        </div>
        {isEditMode && (
          <p className="text-xs text-muted-foreground">
            Glissez-déposez les chambres pour réorganiser chaque étage
          </p>
        )}
      </div>

      {/* Building frame */}
      <div className="border-2 border-foreground/10 rounded-xl overflow-hidden bg-gradient-to-b from-background to-muted/20">
        {/* Roof */}
        <div className="h-3 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

        <div className="divide-y divide-foreground/5">
          {floorGroups.map(([floorKey, floorRooms]) => {
            const floorNum = floorKey === 'null' ? null : Number(floorKey);
            const roomCount = floorRooms.filter(r => (r.space_category || 'room') === 'room').length;
            const commonCount = floorRooms.filter(r => r.space_category === 'common').length;
            const techCount = floorRooms.filter(r => r.space_category === 'technical').length;

            return (
              <div key={floorKey} className="flex">
                {/* Floor label */}
                <div className="w-20 md:w-28 shrink-0 flex flex-col items-center justify-center py-4 px-2 bg-foreground/[0.02] border-r border-foreground/5">
                  <span className="text-lg md:text-xl font-black text-foreground/80">
                    {formatFloorLabel(floorNum)}
                  </span>
                  <div className="flex flex-col items-center gap-0.5 mt-1">
                    {roomCount > 0 && <span className="text-[10px] text-muted-foreground">{roomCount} ch.</span>}
                    {commonCount > 0 && <span className="text-[10px] text-blue-500">{commonCount} com.</span>}
                    {techCount > 0 && <span className="text-[10px] text-amber-500">{techCount} tech.</span>}
                  </div>
                </div>

                {/* Rooms */}
                <div className="flex-1 p-3 md:p-4">
                  <div className="flex flex-wrap gap-2">
                    {floorRooms.map(room => (
                      <RoomCell
                        key={room.id}
                        room={room}
                        isEditMode={isEditMode}
                        isDragging={draggedRoom?.id === room.id}
                        isDragOver={dragOverRoom === room.id}
                        onEdit={onEdit}
                        onToggleActive={onToggleActive}
                        onViewActivity={onViewActivity}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Foundation */}
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
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 bg-muted/60 border-muted-foreground/20 opacity-60" />
          <span>Inactif</span>
        </div>
      </div>
    </div>
  );
};
