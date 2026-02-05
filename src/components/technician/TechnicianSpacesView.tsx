import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Loader2,
  X,
  Clock,
  CheckCircle,
  Calendar,
  Package,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TechnicianSpacesViewProps {
  hotelId: string;
  onIncidentClick?: (incident: Incident) => void;
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
  title: string;
  description: string | null;
  location_reference: string | null;
  status: string;
  priority: string;
  created_at: string;
  due_date: string | null;
  incident_types?: { name: string; color: string } | null;
  incident_categories?: { name: string; icon: string } | null;
  incident_items?: { name: string } | null;
}

// Special zones configuration
const SPECIAL_ZONES = [
  { key: 'chaufferie', label: 'Chaufferie', icon: Flame, color: 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-950 dark:border-orange-700' },
  { key: 'ascenseur', label: 'Ascenseur', icon: DoorOpen, color: 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700' },
  { key: 'reception', label: 'Réception', icon: Building2, color: 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:border-purple-700' },
  { key: 'ssi', label: 'SSI', icon: AlertTriangle, color: 'bg-red-100 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700' },
  { key: 'climatisation', label: 'Climatisation', icon: Wind, color: 'bg-cyan-100 border-cyan-300 text-cyan-700 dark:bg-cyan-950 dark:border-cyan-700' },
  { key: 'electricite', label: 'Électricité', icon: Zap, color: 'bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-700' },
  { key: 'technique', label: 'Local technique', icon: Settings, color: 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600' },
];

export function TechnicianSpacesView({ hotelId, onIncidentClick }: TechnicianSpacesViewProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeTab, setActiveTab] = useState<'floors' | 'zones'>('floors');
  
  // Space detail dialog
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [showSpaceDialog, setShowSpaceDialog] = useState(false);

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

      // Load all incidents (not just active)
      const { data: incidentsData } = await supabase
        .from('incidents')
        .select(`
          id, 
          title, 
          description,
          location_reference, 
          status, 
          priority,
          created_at,
          due_date,
          incident_types(name, color),
          incident_categories(name, icon),
          incident_items(name)
        `)
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

      setSpaces(registryData || []);
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

  // Get incidents for a space (all incidents, not filtered by status)
  const getSpaceIncidents = (roomNumber: string) => {
    return incidents.filter(i => i.location_reference === roomNumber);
  };

  // Get active incidents for a space (for badge display)
  const getActiveIncidents = (roomNumber: string) => {
    return incidents.filter(i => 
      i.location_reference === roomNumber && 
      ['new', 'in_progress', 'postponed', 'parts_ordered'].includes(i.status)
    );
  };

  // Get floor label
  const getFloorLabel = (floor: number) => {
    if (floor === 0) return 'RDC';
    if (floor === -1) return 'Non défini';
    return `Étage ${floor}`;
  };

  // Handle space click - show dialog with incidents
  const handleSpaceClick = (space: Space) => {
    setSelectedSpace(space);
    setShowSpaceDialog(true);
  };

  // Status config for display
  const statusConfig: Record<string, { color: string; label: string; emoji: string }> = {
    new: { color: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Nouveau', emoji: '📌' },
    in_progress: { color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'En cours', emoji: '⏳' },
    resolved: { color: 'bg-green-100 text-green-700 border-green-300', label: 'Résolu', emoji: '✅' },
    postponed: { color: 'bg-purple-100 text-purple-700 border-purple-300', label: 'Reporté', emoji: '📅' },
    parts_ordered: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Pièce commandée', emoji: '📦' },
  };

  const priorityConfig: Record<string, { color: string; emoji: string }> = {
    urgent: { color: 'bg-destructive text-destructive-foreground', emoji: '🔴' },
    high: { color: 'bg-orange-500 text-white', emoji: '🟠' },
    medium: { color: 'bg-yellow-500 text-white', emoji: '🟡' },
    low: { color: 'bg-blue-500 text-white', emoji: '🔵' },
  };

  // Render space card
  const SpaceCard = ({ space }: { space: Space }) => {
    const activeIncidents = getActiveIncidents(space.room_number);
    const totalIncidents = getSpaceIncidents(space.room_number);
    const hasActiveIncidents = activeIncidents.length > 0;
    const urgentIncidents = activeIncidents.filter(i => i.priority === 'urgent' || i.priority === 'high');

    // Determine zone config if special
    const zoneConfig = SPECIAL_ZONES.find(z => 
      space.zone?.toLowerCase().includes(z.key) ||
      space.room_number.toLowerCase().includes(z.key)
    );

    const Icon = zoneConfig?.icon || Home;

    return (
      <button
        onClick={() => handleSpaceClick(space)}
        className={cn(
          "p-3 rounded-lg border-2 text-left transition-all hover:scale-105 hover:shadow-md w-full",
          hasActiveIncidents 
            ? urgentIncidents.length > 0
              ? "border-destructive bg-destructive/10"
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
              hasActiveIncidents ? "text-orange-600" : "text-muted-foreground"
            )} />
            <span className="font-bold text-sm">{space.room_number}</span>
          </div>
          <div className="flex items-center gap-1">
            {hasActiveIncidents && (
              <Badge 
                variant="destructive" 
                className={cn(
                  "text-xs px-1.5 py-0",
                  urgentIncidents.length > 0 && "animate-pulse"
                )}
              >
                {activeIncidents.length}
              </Badge>
            )}
            {totalIncidents.length > 0 && !hasActiveIncidents && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {totalIncidents.length}
              </Badge>
            )}
          </div>
        </div>
        {space.room_type && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {space.room_type}
          </p>
        )}
      </button>
    );
  };

  // Render incident item in dialog
  const IncidentItem = ({ incident }: { incident: Incident }) => {
    const status = statusConfig[incident.status] || statusConfig.new;
    const priority = priorityConfig[incident.priority] || priorityConfig.medium;

    return (
      <div
        onClick={() => onIncidentClick?.(incident)}
        className={cn(
          "p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors",
          incident.status === 'resolved' && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm flex-1">{incident.title}</h4>
          <Badge className={priority.color} variant="secondary">
            {priority.emoji}
          </Badge>
        </div>
        
        {incident.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {incident.description}
          </p>
        )}
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs", status.color)}>
            {status.emoji} {status.label}
          </Badge>
          
          {incident.incident_categories && (
            <Badge variant="secondary" className="text-xs">
              {incident.incident_categories.icon} {incident.incident_categories.name}
            </Badge>
          )}
          
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(incident.created_at).toLocaleDateString('fr-FR')}
          </span>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedSpaceIncidents = selectedSpace ? getSpaceIncidents(selectedSpace.room_number) : [];
  const selectedSpaceActiveIncidents = selectedSpaceIncidents.filter(i => 
    ['new', 'in_progress', 'postponed', 'parts_ordered'].includes(i.status)
  );
  const selectedSpaceResolvedIncidents = selectedSpaceIncidents.filter(i => i.status === 'resolved');

  return (
    <>
      <div className="space-y-4">
        {/* View Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
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

        {/* Content - Floors */}
        {activeTab === 'floors' && (
          <div className="space-y-6">
            {Object.entries(spacesByFloor)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([floor, floorSpaces]) => {
                const floorActiveIncidents = floorSpaces.reduce((count, space) => 
                  count + getActiveIncidents(space.room_number).length, 0
                );
                
                return (
                  <Card key={floor}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {getFloorLabel(Number(floor))}
                        </span>
                        <div className="flex items-center gap-2">
                          {floorActiveIncidents > 0 && (
                            <Badge variant="destructive">
                              {floorActiveIncidents} incident{floorActiveIncidents > 1 ? 's' : ''}
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            {floorSpaces.length} espace{floorSpaces.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {viewMode === 'kanban' ? (
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                          {floorSpaces.map((space) => (
                            <SpaceCard key={space.id} space={space} />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {floorSpaces.map((space) => {
                            const activeIncidents = getActiveIncidents(space.room_number);
                            const totalIncidents = getSpaceIncidents(space.room_number);
                            return (
                              <button
                                key={space.id}
                                onClick={() => handleSpaceClick(space)}
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
                                <div className="flex items-center gap-2">
                                  {activeIncidents.length > 0 && (
                                    <Badge variant="destructive">
                                      {activeIncidents.length} actif{activeIncidents.length > 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                  {totalIncidents.length > 0 && (
                                    <Badge variant="secondary">
                                      {totalIncidents.length} total
                                    </Badge>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

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

        {/* Content - Technical Zones */}
        {activeTab === 'zones' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SPECIAL_ZONES.map((zone) => {
              const zoneSpaces = spaces.filter(s => 
                s.zone?.toLowerCase().includes(zone.key) ||
                s.room_number.toLowerCase().includes(zone.key)
              );
              const zoneIncidents = incidents.filter(i =>
                (zoneSpaces.some(s => s.room_number === i.location_reference) ||
                i.location_reference?.toLowerCase().includes(zone.key)) &&
                ['new', 'in_progress', 'postponed', 'parts_ordered'].includes(i.status)
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
                        <div className={cn("p-2 rounded-lg border", zone.color)}>
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
                        {zoneSpaces.map((space) => {
                          const spaceIncidents = getActiveIncidents(space.room_number);
                          return (
                            <Badge 
                              key={space.id} 
                              variant={spaceIncidents.length > 0 ? "destructive" : "outline"}
                              className="cursor-pointer hover:bg-accent"
                              onClick={() => handleSpaceClick(space)}
                            >
                              {space.room_number}
                              {spaceIncidents.length > 0 && ` (${spaceIncidents.length})`}
                            </Badge>
                          );
                        })}
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

      {/* Space Detail Dialog */}
      <Dialog open={showSpaceDialog} onOpenChange={setShowSpaceDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              {selectedSpace?.room_number}
              {selectedSpace?.room_type && (
                <Badge variant="secondary">{selectedSpace.room_type}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-xl font-bold">{selectedSpaceActiveIncidents.length}</p>
                      <p className="text-xs text-muted-foreground">Actifs</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xl font-bold">{selectedSpaceResolvedIncidents.length}</p>
                      <p className="text-xs text-muted-foreground">Résolus</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Active Incidents */}
              {selectedSpaceActiveIncidents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Incidents actifs ({selectedSpaceActiveIncidents.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedSpaceActiveIncidents.map((incident) => (
                      <IncidentItem key={incident.id} incident={incident} />
                    ))}
                  </div>
                </div>
              )}

              {/* Resolved Incidents */}
              {selectedSpaceResolvedIncidents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Historique résolu ({selectedSpaceResolvedIncidents.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedSpaceResolvedIncidents.slice(0, 5).map((incident) => (
                      <IncidentItem key={incident.id} incident={incident} />
                    ))}
                    {selectedSpaceResolvedIncidents.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{selectedSpaceResolvedIncidents.length - 5} autres incidents résolus
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* No Incidents */}
              {selectedSpaceIncidents.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <h4 className="font-medium">Aucun incident</h4>
                  <p className="text-sm text-muted-foreground">
                    Cet espace n'a pas d'incident enregistré
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
