import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Search, Edit, Power, PowerOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddRoomRegistryDialog } from '@/components/AddRoomRegistryDialog';
import { EditRoomRegistryDialog } from '@/components/EditRoomRegistryDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RoomRegistry {
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
}

const RoomRegistry = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<RoomRegistry | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch hotel ID
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

  // Fetch rooms registry
  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms-registry', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_rooms_registry')
        .select('*')
        .eq('hotel_id', hotel?.id)
        .order('room_number', { ascending: true });
      
      if (error) throw error;
      return data as RoomRegistry[];
    },
    enabled: !!hotel?.id,
  });

  // Toggle room active status
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
      toast({
        title: "Statut modifié",
        description: "Le statut de la chambre a été mis à jour",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut de la chambre",
        variant: "destructive",
      });
      console.error('Error toggling room status:', error);
    },
  });

  const filteredRooms = rooms?.filter(room =>
    room.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.floor?.toString().includes(searchQuery) ||
    room.room_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.building?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.zone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (room: RoomRegistry) => {
    setSelectedRoom(room);
    setIsEditDialogOpen(true);
  };

  const handleToggleActive = (room: RoomRegistry) => {
    toggleActiveMutation.mutate({ id: room.id, is_active: room.is_active ?? true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Registre des Chambres</h1>
              <p className="text-muted-foreground">
                Gérez toutes les chambres de votre établissement
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une chambre
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{rooms?.length || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Actives</div>
            <div className="text-2xl font-bold text-green-600">
              {rooms?.filter(r => r.is_active).length || 0}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Inactives</div>
            <div className="text-2xl font-bold text-red-600">
              {rooms?.filter(r => !r.is_active).length || 0}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Étages</div>
            <div className="text-2xl font-bold">
              {new Set(rooms?.map(r => r.floor).filter(Boolean)).size}
            </div>
          </Card>
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro, étage, type, bâtiment ou zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Étage</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Bâtiment</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredRooms?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Aucune chambre trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredRooms?.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.room_number}</TableCell>
                    <TableCell>{room.floor ?? '-'}</TableCell>
                    <TableCell>{room.room_type ?? '-'}</TableCell>
                    <TableCell>{room.building ?? '-'}</TableCell>
                    <TableCell>{room.zone ?? '-'}</TableCell>
                    <TableCell>
                      {room.source === 'pdf_import' ? (
                        <Badge variant="outline">PDF</Badge>
                      ) : room.source === 'manual' ? (
                        <Badge variant="secondary">Manuel</Badge>
                      ) : (
                        <Badge variant="secondary">{room.source}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {room.is_active ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(room)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(room)}
                        >
                          {room.is_active ? (
                            <PowerOff className="h-4 w-4 text-red-500" />
                          ) : (
                            <Power className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
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
    </div>
  );
};

export default RoomRegistry;
