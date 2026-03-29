import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Search, Trash2, Building, Bed, Wrench, LayoutGrid, Table as TableIcon, Grid3X3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddRoomRegistryDialog } from '@/components/AddRoomRegistryDialog';
import { EditRoomRegistryDialog } from '@/components/EditRoomRegistryDialog';
import { SpaceActivityLog } from '@/components/SpaceActivityLog';
import { FloorPlanView } from '@/components/registry/FloorPlanView';
import { FloorPlanGrid } from '@/components/registry/FloorPlanGrid';
import { formatFloorLabel } from '@/utils/floorUtils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Edit, ClipboardList, Power, PowerOff } from 'lucide-react';

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

const RoomRegistry = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<RoomRegistryItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activityRoom, setActivityRoom] = useState<RoomRegistryItem | null>(null);
  const [viewMode, setViewMode] = useState<'plan' | 'table' | 'grid'>('plan');

  const { data: hotel } = useQuery({
    queryKey: ['hotel', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms-registry', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_rooms_registry')
        .select('*')
        .eq('hotel_id', hotel?.id)
        .order('room_number', { ascending: true });
      if (error) throw error;
      return data as RoomRegistryItem[];
    },
    enabled: !!hotel?.id,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('hotel_rooms_registry')
        .update({ is_active: !is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-registry'] });
      toast({ title: "Statut modifié" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('hotel_rooms_registry')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-registry'] });
      setSelectedIds(new Set());
      toast({ title: "Suppression effectuée", description: `${selectedIds.size} espace(s) supprimé(s)` });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    },
  });

  const filteredRooms = useMemo(() => {
    let result = rooms || [];
    if (categoryFilter !== 'all') {
      result = result.filter(r => (r.space_category || 'room') === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.room_number.toLowerCase().includes(q) ||
        r.room_type?.toLowerCase().includes(q) ||
        r.building?.toLowerCase().includes(q) ||
        r.zone?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rooms, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    const all = rooms || [];
    return {
      total: all.length,
      rooms: all.filter(r => (r.space_category || 'room') === 'room').length,
      common: all.filter(r => r.space_category === 'common').length,
      technical: all.filter(r => r.space_category === 'technical').length,
    };
  }, [rooms]);

  const allFilteredSelected = filteredRooms.length > 0 && filteredRooms.every(r => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRooms.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const getCategoryBadge = (cat: string | null | undefined) => {
    switch (cat) {
      case 'common': return <Badge variant="outline" className="text-blue-600 border-blue-300">Commun</Badge>;
      case 'technical': return <Badge variant="outline" className="text-orange-600 border-orange-300">Technique</Badge>;
      default: return <Badge variant="secondary">Chambre</Badge>;
    }
  };

  const handleEdit = (room: RoomRegistryItem) => {
    setSelectedRoom(room);
    setIsEditDialogOpen(true);
  };

  const handleToggleActive = (room: RoomRegistryItem) => {
    toggleActiveMutation.mutate({ id: room.id, is_active: room.is_active ?? true });
  };

  const handleViewActivity = (room: RoomRegistryItem) => {
    setActivityRoom(room);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Plan des Espaces</h1>
              <p className="text-sm text-muted-foreground">
                Vue architecturale — chambres, espaces communs et techniques
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un espace
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              Total
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bed className="h-4 w-4" />
              Chambres
            </div>
            <div className="text-2xl font-bold">{stats.rooms}</div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              Communs
            </div>
            <div className="text-2xl font-bold">{stats.common}</div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wrench className="h-4 w-4" />
              Techniques
            </div>
            <div className="text-2xl font-bold">{stats.technical}</div>
          </Card>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto grid grid-cols-4">
              <TabsTrigger value="all">Tout</TabsTrigger>
              <TabsTrigger value="room">Chambres</TabsTrigger>
              <TabsTrigger value="common">Communs</TabsTrigger>
              <TabsTrigger value="technical">Techniques</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex border rounded-lg overflow-hidden shrink-0">
            <Button
              variant={viewMode === 'plan' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('plan')}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Plan
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4 mr-1" />
              Grille
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4 mr-1" />
              Liste
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Chargement...</div>
        ) : viewMode === 'plan' ? (
          <FloorPlanView
            rooms={filteredRooms}
            hotelId={hotel?.id}
            onEdit={handleEdit}
            onToggleActive={handleToggleActive}
            onViewActivity={handleViewActivity}
          />
        ) : viewMode === 'grid' ? (
          <FloorPlanGrid
            rooms={filteredRooms}
            hotelId={hotel?.id}
            onEdit={handleEdit}
            onToggleActive={handleToggleActive}
            onViewActivity={handleViewActivity}
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Nom / N°</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Étage</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Source</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRooms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">Aucun espace trouvé</TableCell>
                    </TableRow>
                  ) : (
                    filteredRooms.map((room) => (
                      <TableRow key={room.id} className={selectedIds.has(room.id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(room.id)}
                            onCheckedChange={() => toggleSelect(room.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{room.room_number}</TableCell>
                        <TableCell>{getCategoryBadge(room.space_category)}</TableCell>
                        <TableCell>{formatFloorLabel(room.floor)}</TableCell>
                        <TableCell className="hidden md:table-cell">{room.room_type ?? '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {room.source === 'pdf_import' ? (
                            <Badge variant="outline">PDF</Badge>
                          ) : room.source === 'manual' ? (
                            <Badge variant="secondary">Manuel</Badge>
                          ) : (
                            <Badge variant="secondary">{room.source || '-'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {room.is_active ? (
                            <Badge className="bg-green-500 text-white">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(room)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleViewActivity(room)}>
                              <ClipboardList className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(room)}>
                              {room.is_active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-green-500" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Floating bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-xl rounded-full px-6 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </span>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Annuler
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddRoomRegistryDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        hotelId={hotel?.id}
      />

      {selectedRoom && (
        <EditRoomRegistryDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          room={selectedRoom}
        />
      )}

      {activityRoom && hotel?.id && (
        <SpaceActivityLog
          open={!!activityRoom}
          onOpenChange={(o) => !o && setActivityRoom(null)}
          hotelId={hotel.id}
          roomNumber={activityRoom.room_number}
          spaceName={activityRoom.room_number}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer {selectedIds.size} espace{selectedIds.size > 1 ? 's' : ''} du registre ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                bulkDeleteMutation.mutate(Array.from(selectedIds));
                setShowDeleteConfirm(false);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoomRegistry;
