import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Filter, Bed, RefreshCw } from 'lucide-react';
import { RoomCard } from '@/components/RoomCard';
import { RoomFilters } from '@/components/RoomFilters';
import { Room } from '@/services/pdfService';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RoomStatusTabs, RoomFilterTab, filterRoomsByTab, calculateRoomCounts } from '@/components/RoomStatusTabs';

interface RoomsGridSectionProps {
  rooms: Room[];
  filteredRooms: Room[] | null;
  onAddRoom: () => void;
  onRoomUpdate: (room: Room) => void;
  onFilterChange: (filtered: Room[] | null) => void;
  hotelId?: string;
}

export function RoomsGridSection({
  rooms,
  filteredRooms,
  onAddRoom,
  onRoomUpdate,
  onFilterChange,
  hotelId
}: RoomsGridSectionProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<RoomFilterTab>('all');
  const queryClient = useQueryClient();
  
  // Auto-refresh every 5 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (hotelId) {
        queryClient.invalidateQueries({ queryKey: ['room-incident-counts', hotelId] });
        queryClient.invalidateQueries({ queryKey: ['rooms', hotelId] });
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [hotelId, queryClient]);

  // Récupérer le nombre d'incidents actifs par chambre
  const { data: incidentCounts, refetch: refetchIncidents } = useQuery({
    queryKey: ['room-incident-counts', hotelId],
    queryFn: async () => {
      if (!hotelId) return {};
      
      const { data, error } = await supabase
        .from('incidents')
        .select('location_reference')
        .eq('hotel_id', hotelId)
        .neq('status', 'resolved');
      
      if (error) throw error;
      
      // Compter les incidents par numéro de chambre
      const counts: Record<string, number> = {};
      data?.forEach((incident) => {
        if (incident.location_reference) {
          counts[incident.location_reference] = (counts[incident.location_reference] || 0) + 1;
        }
      });
      
      return counts;
    },
    enabled: !!hotelId,
    staleTime: 5000, // Refresh toutes les 5 secondes
    refetchInterval: 5000
  });
  
  // Calculate room counts for tabs
  const roomCounts = useMemo(() => {
    const baseRooms = filteredRooms || rooms;
    return calculateRoomCounts(baseRooms.map(r => ({
      status: r.status,
      cleaningType: r.cleaningType
    })));
  }, [rooms, filteredRooms]);
  
  // Apply tab filter
  const displayRooms = useMemo(() => {
    const baseRooms = filteredRooms || rooms;
    return filterRoomsByTab(baseRooms.map(r => ({
      ...r,
      cleaningType: r.cleaningType
    })), activeTab);
  }, [rooms, filteredRooms, activeTab]);

  const handleRefresh = () => {
    refetchIncidents();
    queryClient.invalidateQueries({ queryKey: ['rooms', hotelId] });
  };

  return (
    <div className="space-y-4">
      {/* Header avec actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-card/50 p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Bed className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            Chambres ({displayRooms.length})
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </Button>
          <Button
            size="sm"
            onClick={onAddRoom}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Onglets de filtrage par statut */}
      <RoomStatusTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={roomCounts}
      />

      {/* Filtres avancés */}
      {showFilters && (
        <Card className="p-4 bg-muted/50">
          <RoomFilters
            rooms={rooms}
            onFiltersChange={onFilterChange}
          />
        </Card>
      )}

      {/* Grille des chambres */}
      {displayRooms.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {displayRooms.map((room) => (
            <RoomCard
              key={room.number}
              room={room}
              onUpdate={onRoomUpdate}
              hotelId={hotelId}
              incidentCount={incidentCounts?.[room.number] || 0}
            />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-dashed">
          <Bed className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            {rooms.length === 0 ? 'Aucune chambre' : 'Aucune chambre ne correspond aux filtres'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {rooms.length === 0 
              ? 'Importez des chambres depuis un PDF ou ajoutez-les manuellement'
              : 'Essayez de modifier les filtres ou l\'onglet'
            }
          </p>
          {rooms.length === 0 && (
            <Button onClick={onAddRoom} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter une chambre
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
