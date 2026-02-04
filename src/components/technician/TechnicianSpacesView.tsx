import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  LayoutGrid, 
  List, 
  Home, 
  Flame, 
  Zap, 
  Wind,
  DoorOpen,
  Building2,
  AlertTriangle,
  Settings,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TechnicianSpacesViewProps {
  hotelId: string;
  onSpaceClick?: (space: Space) => void;
}

interface Space {
  id: string;
  room_number: string;
  floor: number | null;
  zone: string | null;
  building: string | null;
  room_type: string | null;
  is_active: boolean;
}

interface Incident {
  id: string;
  location_reference: string;
  status: string;
  priority: string;
}

// Special zones configuration
const SPECIAL_ZONES = [
  { key: 'chaufferie', label: 'Chaufferie', icon: Flame, color: 'bg-orange-100 border-orange-300 text-orange-700' },
  { key: 'ascenseur', label: 'Ascenseur', icon: DoorOpen, color: 'bg-blue-100 border-blue-300 text-blue-700' },
  { key: 'reception', label: 'Réception', icon: Building2, color: 'bg-purple-100 border-purple-300 text-purple-700' },
  { key: 'ssi', label: 'SSI', icon: AlertTriangle, color: 'bg-red-100 border-red-300 text-red-700' },
  { key: 'climatisation', label: 'Climatisation', icon: Wind, color: 'bg-cyan-100 border-cyan-300 text-cyan-700' },
  { key: 'electricite', label: 'Électricité', icon: Zap, color: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
  { key: 'technique', label: 'Local technique', icon: Settings, color: 'bg-gray-100 border-gray-300 text-gray-700' },
];

export function TechnicianSpacesView({ hotelId, onSpaceClick }: TechnicianSpacesViewProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeTab, setActiveTab] = useState<'floors' | 'zones'>('floors');

  useEffect(() => {
    loadData();
  }, [hotelId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load registry spaces
      const { data: registryData } = await supabase
        .from('hotel_rooms_registry')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('floor', { ascending: true })
        .order('room_number', { ascending: true });

      // Load active rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('id, room_number, status, cleaning_type, notes')
        .eq('hotel_id', hotelId)
        .order('room_number');

      // Load active incidents
      const { data: incidentsData } = await supabase
        .from('incidents')
        .select('id, location_reference, status, priority')
        .eq('hotel_id', hotelId)
        .in('status', ['new', 'in_progress', 'postponed', 'parts_ordered']);

      setSpaces(registryData || []);
      setRooms(roomsData || []);
      setIncidents(incidentsData || []);
    } catch (error) {
      console.error('Error loading spaces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group spaces by floor
  const spacesByFloor = spaces.reduce((acc, space) => {
    const floor = space.floor ?? -1;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(space);
    return acc;
  }, {} as Record<number, Space[]>);

  // Also include rooms that may not be in registry
  const allRoomNumbers = new Set([
    ...spaces.map(s => s.room_number),
    ...rooms.map(r => r.room_number)
  ]);

  // Get room status from rooms table
  const getRoomData = (roomNumber: string) => {
    return rooms.find(r => r.room_number === roomNumber);
  };

  // Get incidents for a space
  const getSpaceIncidents = (roomNumber: string) => {
    return incidents.filter(i => i.location_reference === roomNumber);
  };

  // Get floor label
  const getFloorLabel = (floor: number) => {
    if (floor === 0) return 'RDC';
    if (floor === -1) return 'Non défini';
    return `Étage ${floor}`;
  };

  // Get special zones from spaces
  const specialZones = spaces.filter(s => 
    s.zone && SPECIAL_ZONES.some(z => 
      s.zone?.toLowerCase().includes(z.key) || 
      s.room_number.toLowerCase().includes(z.key)
    )
  );

  // Render space card
  const SpaceCard = ({ space }: { space: Space }) => {
    const roomData = getRoomData(space.room_number);
    const spaceIncidents = getSpaceIncidents(space.room_number);
    const hasIncidents = spaceIncidents.length > 0;
    const urgentIncidents = spaceIncidents.filter(i => i.priority === 'urgent' || i.priority === 'high');

    // Determine zone config if special
    const zoneConfig = SPECIAL_ZONES.find(z => 
      space.zone?.toLowerCase().includes(z.key) ||
      space.room_number.toLowerCase().includes(z.key)
    );

    const Icon = zoneConfig?.icon || Home;

    return (
      <button
        onClick={() => onSpaceClick?.(space)}
        className={cn(
          "p-3 rounded-lg border-2 text-left transition-all hover:scale-105 hover:shadow-md",
          hasIncidents 
            ? urgentIncidents.length > 0
              ? "border-red-400 bg-red-50 dark:bg-red-950"
              : "border-orange-400 bg-orange-50 dark:bg-orange-950"
            : zoneConfig 
              ? zoneConfig.color
              : "border-border bg-card hover:border-primary/50"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={cn(
              "h-4 w-4",
              hasIncidents ? "text-orange-600" : "text-muted-foreground"
            )} />
            <span className="font-bold text-sm">{space.room_number}</span>
          </div>
          {hasIncidents && (
            <Badge 
              variant="destructive" 
              className={cn(
                "text-xs px-1.5 py-0",
                urgentIncidents.length > 0 && "animate-pulse"
              )}
            >
              {spaceIncidents.length}
            </Badge>
          )}
        </div>
        {space.room_type && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {space.room_type}
          </p>
        )}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="floors" className="gap-2">
              <Building2 className="h-4 w-4" />
              Par étage
            </TabsTrigger>
            <TabsTrigger value="zones" className="gap-2">
              <Settings className="h-4 w-4" />
              Zones techniques
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'floors' && (
        <div className="space-y-6">
          {Object.entries(spacesByFloor)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([floor, floorSpaces]) => (
              <Card key={floor}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {getFloorLabel(Number(floor))}
                    </span>
                    <Badge variant="secondary">
                      {floorSpaces.length} espace{floorSpaces.length > 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewMode === 'kanban' ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                      {floorSpaces.map((space) => (
                        <SpaceCard key={space.id} space={space} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {floorSpaces.map((space) => {
                        const spaceIncidents = getSpaceIncidents(space.room_number);
                        return (
                          <button
                            key={space.id}
                            onClick={() => onSpaceClick?.(space)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Home className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{space.room_number}</span>
                              {space.room_type && (
                                <span className="text-sm text-muted-foreground">
                                  ({space.room_type})
                                </span>
                              )}
                            </div>
                            {spaceIncidents.length > 0 && (
                              <Badge variant="destructive">
                                {spaceIncidents.length} incident{spaceIncidents.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

          {Object.keys(spacesByFloor).length === 0 && (
            <Card className="p-8 text-center">
              <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Aucun espace enregistré</h3>
              <p className="text-muted-foreground">
                Le registre des chambres est vide pour cet établissement
              </p>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'zones' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SPECIAL_ZONES.map((zone) => {
            const zoneSpaces = spaces.filter(s => 
              s.zone?.toLowerCase().includes(zone.key) ||
              s.room_number.toLowerCase().includes(zone.key)
            );
            const zoneIncidents = incidents.filter(i =>
              zoneSpaces.some(s => s.room_number === i.location_reference) ||
              i.location_reference?.toLowerCase().includes(zone.key)
            );
            const Icon = zone.icon;

            return (
              <Card 
                key={zone.key}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg",
                  zoneIncidents.length > 0 && "border-orange-400"
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className={cn("p-2 rounded-lg", zone.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {zone.label}
                    </span>
                    {zoneIncidents.length > 0 && (
                      <Badge variant="destructive">
                        {zoneIncidents.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {zoneSpaces.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {zoneSpaces.map((space) => (
                        <Badge 
                          key={space.id} 
                          variant="outline"
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => onSpaceClick?.(space)}
                        >
                          {space.room_number}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun espace enregistré
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
