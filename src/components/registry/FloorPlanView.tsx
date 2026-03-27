import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit, ClipboardList, Power, PowerOff, Bed, Building, Wrench } from 'lucide-react';
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
  onEdit: (room: RoomRegistryItem) => void;
  onToggleActive: (room: RoomRegistryItem) => void;
  onViewActivity: (room: RoomRegistryItem) => void;
}

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
  onEdit: (room: RoomRegistryItem) => void;
  onToggleActive: (room: RoomRegistryItem) => void;
  onViewActivity: (room: RoomRegistryItem) => void;
}> = ({ room, onEdit, onToggleActive, onViewActivity }) => {
  const isActive = room.is_active ?? true;
  const colorClass = getCategoryColor(room.space_category, isActive);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`group relative border-2 rounded-lg p-2.5 cursor-pointer transition-all duration-200 min-w-[90px] ${colorClass}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {getCategoryIcon(room.space_category)}
              <span className="font-bold text-sm truncate">{room.room_number}</span>
            </div>
            {room.room_type && (
              <span className="text-[10px] opacity-70 truncate block">{room.room_type}</span>
            )}
            {room.building && (
              <span className="text-[10px] opacity-50 truncate block">Bât. {room.building}</span>
            )}
            {/* Hover actions overlay */}
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
  onEdit,
  onToggleActive,
  onViewActivity,
}) => {
  // Group rooms by floor, sorted descending (top floors first like a building)
  const floorGroups = React.useMemo(() => {
    const groups = new Map<number | null, RoomRegistryItem[]>();
    rooms.forEach(room => {
      const floor = room.floor;
      if (!groups.has(floor)) groups.set(floor, []);
      groups.get(floor)!.push(room);
    });

    // Sort floors descending (highest first), null floor at bottom
    const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === null) return 1;
      if (b[0] === null) return -1;
      return (b[0] ?? 0) - (a[0] ?? 0);
    });

    // Sort rooms within each floor naturally
    sortedEntries.forEach(([, floorRooms]) => {
      floorRooms.sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
    });

    return sortedEntries;
  }, [rooms]);

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
      {/* Building frame */}
      <div className="border-2 border-foreground/10 rounded-xl overflow-hidden bg-gradient-to-b from-background to-muted/20">
        {/* Roof decoration */}
        <div className="h-3 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

        <div className="divide-y divide-foreground/5">
          {floorGroups.map(([floor, floorRooms]) => {
            const roomCount = floorRooms.filter(r => (r.space_category || 'room') === 'room').length;
            const commonCount = floorRooms.filter(r => r.space_category === 'common').length;
            const techCount = floorRooms.filter(r => r.space_category === 'technical').length;

            return (
              <div key={floor ?? 'null'} className="flex">
                {/* Floor label column */}
                <div className="w-20 md:w-28 shrink-0 flex flex-col items-center justify-center py-4 px-2 bg-foreground/[0.02] border-r border-foreground/5">
                  <span className="text-lg md:text-xl font-black text-foreground/80">
                    {formatFloorLabel(floor)}
                  </span>
                  <div className="flex flex-col items-center gap-0.5 mt-1">
                    {roomCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">{roomCount} ch.</span>
                    )}
                    {commonCount > 0 && (
                      <span className="text-[10px] text-blue-500">{commonCount} com.</span>
                    )}
                    {techCount > 0 && (
                      <span className="text-[10px] text-amber-500">{techCount} tech.</span>
                    )}
                  </div>
                </div>

                {/* Rooms grid */}
                <div className="flex-1 p-3 md:p-4">
                  <div className="flex flex-wrap gap-2">
                    {floorRooms.map(room => (
                      <RoomCell
                        key={room.id}
                        room={room}
                        onEdit={onEdit}
                        onToggleActive={onToggleActive}
                        onViewActivity={onViewActivity}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Foundation decoration */}
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
