import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { 
  User, Loader2, RefreshCw, CheckCircle, Clock, XCircle, 
  Home, AlertCircle
} from 'lucide-react';

interface GovernessStaffPanelProps {
  hotelId: string;
}

interface Housekeeper {
  id: string;
  name: string;
  is_active: boolean;
}

interface Assignment {
  housekeeper_name: string;
  housekeeper_id: string | null;
  status: string;
  room_id: string;
  rooms?: {
    room_number: string;
  };
}

interface StaffStats {
  total: number;
  inProgress: number;
  completed: number;
  pending: number;
}

export const GovernessStaffPanel: React.FC<GovernessStaffPanelProps> = ({ hotelId }) => {
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // Charger toutes les femmes de chambre (actives et inactives)
      const { data: housekeepersData, error: hkError } = await supabase
        .from('housekeepers')
        .select('id, name, is_active')
        .eq('hotel_id', hotelId)
        .order('is_active', { ascending: false })
        .order('name');

      if (hkError) throw hkError;
      setHousekeepers(housekeepersData || []);

      // Charger les assignations du jour
      const today = new Date().toISOString().split('T')[0];
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select(`
          housekeeper_name,
          housekeeper_id,
          status,
          room_id,
          rooms:room_id (room_number)
        `)
        .eq('hotel_id', hotelId)
        .gte('assigned_at', today);

      setAssignments(assignmentsData || []);

    } catch (error) {
      console.error('Erreur chargement personnel:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync({
    hotelId,
    tables: ['housekeepers', 'assignments'],
    onUpdate: loadData
  });

  const getStaffStats = (housekeeperName: string): StaffStats => {
    const staffAssignments = assignments.filter(a => a.housekeeper_name === housekeeperName);
    return {
      total: staffAssignments.length,
      inProgress: staffAssignments.filter(a => a.status === 'in_progress').length,
      completed: staffAssignments.filter(a => a.status === 'completed').length,
      pending: staffAssignments.filter(a => a.status === 'assigned').length
    };
  };

  const getStaffRooms = (housekeeperName: string) => {
    return assignments
      .filter(a => a.housekeeper_name === housekeeperName)
      .map(a => ({
        roomNumber: a.rooms?.room_number || 'N/A',
        status: a.status
      }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeHousekeepers = housekeepers.filter(h => h.is_active);
  const inactiveHousekeepers = housekeepers.filter(h => !h.is_active);

  return (
    <div className="space-y-6">
      {/* Refresh */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{housekeepers.length} femme(s) de chambre</Badge>
          <Badge className="bg-green-100 text-green-800">{activeHousekeepers.length} active(s)</Badge>
          {inactiveHousekeepers.length > 0 && (
            <Badge variant="secondary">{inactiveHousekeepers.length} inactive(s)</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Personnel actif */}
      {activeHousekeepers.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">Personnel actif</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {activeHousekeepers.map(hk => {
              const stats = getStaffStats(hk.name);
              const rooms = getStaffRooms(hk.name);

              return (
                <Card key={hk.id} className="border-green-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                          <User className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{hk.name}</h4>
                          <p className="text-xs text-green-600">En service</p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        {stats.total} chambre(s)
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <div className="flex items-center justify-center gap-1 text-orange-600">
                          <Clock className="h-3 w-3" />
                          <span className="font-bold">{stats.pending}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">En attente</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <div className="flex items-center justify-center gap-1 text-blue-600">
                          <AlertCircle className="h-3 w-3" />
                          <span className="font-bold">{stats.inProgress}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">En cours</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <div className="flex items-center justify-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span className="font-bold">{stats.completed}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Terminées</div>
                      </div>
                    </div>

                    {/* Chambres assignées */}
                    {rooms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {rooms.map((room, idx) => (
                          <Badge 
                            key={idx}
                            variant="outline"
                            className={`text-xs ${
                              room.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                              room.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' :
                              ''
                            }`}
                          >
                            <Home className="h-2.5 w-2.5 mr-1" />
                            {room.roomNumber}
                            {room.status === 'in_progress' && <Loader2 className="h-2.5 w-2.5 ml-1 animate-spin" />}
                            {room.status === 'completed' && <CheckCircle className="h-2.5 w-2.5 ml-1" />}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {rooms.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Aucune chambre assignée
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Personnel inactif */}
      {inactiveHousekeepers.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">Personnel hors service</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {inactiveHousekeepers.map(hk => (
              <Card key={hk.id} className="border-gray-200 bg-gray-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-gray-200 p-2 rounded-full">
                      <User className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-600">{hk.name}</h4>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <XCircle className="h-3 w-3" />
                        Hors service
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {housekeepers.length === 0 && (
        <Card className="p-8 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Aucun personnel</h3>
          <p className="text-muted-foreground">
            Aucune femme de chambre n'est enregistrée pour cet hôtel
          </p>
        </Card>
      )}
    </div>
  );
};
