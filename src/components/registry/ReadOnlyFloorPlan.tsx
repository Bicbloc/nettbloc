import React, { useState, useEffect, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Bed, Building, Wrench } from 'lucide-react';
import { formatFloorLabel } from '@/utils/floorUtils';
import { supabase } from '@/integrations/supabase/client';
import { SpaceActivityLog } from '@/components/SpaceActivityLog';

interface RoomRegistryItem {
  id: string;
  room_number: string;
  floor: number | null;
  room_type: string | null;
  building: string | null;
  zone: string | null;
  is_active: boolean | null;
  space_category?: string | null;
}

interface ReadOnlyFloorPlanProps {
  hotelId: string;
  highlightedRooms?: string[]; // room_numbers to highlight
}

const getCategoryIcon = (cat: string | null | undefined) => {
  switch (cat) {
    case 'common': return <Building className="h-3.5 w-3.5" />;
    case 'technical': return <Wrench className="h-3.5 w-3.5" />;
    default: return <Bed className="h-3.5 w-3.5" />;
  }
};

const getCategoryColor = (cat: string | null | undefined, isActive: boolean, isHighlighted: boolean) => {
  if (!isActive) return 'bg-muted/60 border-muted-foreground/20 text-muted-foreground opacity-60';
  if (isHighlighted) {
    switch (cat) {
      case 'common': return 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400/40';
      case 'technical': return 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 ring-2 ring-amber-400/40';
      default: return 'bg-primary/15 border-primary/40 text-foreground ring-2 ring-primary/40';
    }
  }
  switch (cat) {
    case 'common': return 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20';
    case 'technical': return 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20';
    default: return 'bg-primary/5 border-primary/20 text-foreground hover:bg-primary/10';
  }
};

export const ReadOnlyFloorPlan: React.FC<ReadOnlyFloorPlanProps> = ({ hotelId, highlightedRooms = [] }) => {
  const [rooms, setRooms] = useState<RoomRegistryItem[]>([]);
  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<{ roomNumber: string } | null>(null);

  // Load registry rooms
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('hotel_rooms_registry')
          .select('id, room_number, floor, room_type, building, zone, is_active, space_category')
          .eq('hotel_id', hotelId)
          .order('floor', { ascending: false })
          .order('room_number');
        if (error) {
          console.error('❌ ReadOnlyFloorPlan: Error loading rooms registry:', error.message);
        }
        if (data) {
          console.log(`✅ ReadOnlyFloorPlan: Loaded ${data.length} rooms for hotel ${hotelId}`);
          setRooms(data);
        }
      } catch (err) {
        console.error('❌ ReadOnlyFloorPlan: Exception:', err);
      }
      setIsLoading(false);
    };
    if (hotelId) load();
  }, [hotelId]);

  // Load activity counts (last 24h)
  useEffect(() => {
    const loadActivity = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('daily_action_logs')
        .select('room_number')
        .eq('hotel_id', hotelId)
        .gte('created_at', since)
        .not('room_number', 'is', null);

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach(log => {
          if (log.room_number) {
            counts[log.room_number] = (counts[log.room_number] || 0) + 1;
          }
        });
        setActivityCounts(counts);
      }
    };
    loadActivity();
  }, [hotelId]);

  const highlightSet = useMemo(() => new Set(highlightedRooms), [highlightedRooms]);

  const floorGroups = useMemo(() => {
    const groups = new Map<string, RoomRegistryItem[]>();
    rooms.forEach(room => {
      const key = room.floor?.toString() ?? 'null';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(room);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'null') return 1;
      if (b[0] === 'null') return -1;
      return Number(b[0]) - Number(a[0]);
    });
  }, [rooms]);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement du plan...</div>;
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="font-medium">Aucun espace enregistré</p>
        <p className="text-xs">Le plan sera disponible une fois les espaces configurés</p>
      </div>
    );
  }

  return (
    <>
      <div className="border-2 border-foreground/10 rounded-xl overflow-hidden bg-gradient-to-b from-background to-muted/20">
        <div className="h-3 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
        <div className="divide-y divide-foreground/5">
          {floorGroups.map(([floorKey, floorRooms]) => {
            const floorNum = floorKey === 'null' ? null : Number(floorKey);
            return (
              <div key={floorKey} className="flex">
                <div className="w-16 md:w-24 shrink-0 flex flex-col items-center justify-center py-3 px-2 bg-foreground/[0.02] border-r border-foreground/5">
                  <span className="text-base md:text-lg font-black text-foreground/80">
                    {formatFloorLabel(floorNum)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{floorRooms.length}</span>
                </div>
                <div className="flex-1 p-2 md:p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {floorRooms.map(room => {
                      const isActive = room.is_active ?? true;
                      const isHighlighted = highlightSet.has(room.room_number);
                      const count = activityCounts[room.room_number] || 0;
                      return (
                        <TooltipProvider key={room.id} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setSelectedRoom({ roomNumber: room.room_number })}
                                className={`group relative border-2 rounded-lg p-2 transition-all duration-200 min-w-[80px] select-none cursor-pointer ${getCategoryColor(room.space_category, isActive, isHighlighted)}`}
                              >
                                <div className="flex items-center gap-1 mb-0.5">
                                  {getCategoryIcon(room.space_category)}
                                  <span className="font-bold text-sm truncate">{room.room_number}</span>
                                </div>
                                {room.room_type && (
                                  <span className="text-[10px] opacity-70 truncate block">{room.room_type}</span>
                                )}
                                {count > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 text-[10px] animate-pulse"
                                  >
                                    {count}
                                  </Badge>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-semibold">{room.room_number}</p>
                              {room.room_type && <p>Type: {room.room_type}</p>}
                              {count > 0 && <p className="text-destructive">{count} action(s) récente(s)</p>}
                              <p className="text-muted-foreground">Cliquez pour voir l'historique</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-2 bg-gradient-to-r from-foreground/10 via-foreground/20 to-foreground/10" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 bg-primary/5 border-primary/20" />
          <span>Chambre</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 bg-blue-500/10 border-blue-500/30" />
          <span>Commun</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 bg-amber-500/10 border-amber-500/30" />
          <span>Technique</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="destructive" className="h-4 px-1 text-[9px]">3</Badge>
          <span>Actions récentes</span>
        </div>
      </div>

      {/* Activity Log Sheet */}
      {selectedRoom && (
        <SpaceActivityLog
          open={!!selectedRoom}
          onOpenChange={(open) => !open && setSelectedRoom(null)}
          hotelId={hotelId}
          roomNumber={selectedRoom.roomNumber}
          spaceName={selectedRoom.roomNumber}
        />
      )}
    </>
  );
};
