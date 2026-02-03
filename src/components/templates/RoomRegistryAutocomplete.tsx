import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronsUpDown, Plus, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface RoomRegistryAutocompleteProps {
  hotelId: string;
  value: string;
  onChange: (value: string) => void;
  locationType: string;
  placeholder?: string;
}

interface RoomRegistry {
  id: string;
  room_number: string;
  floor: number | null;
  room_type: string | null;
  building: string | null;
  zone: string | null;
}

const LOCATION_TYPES = [
  { value: 'room', label: 'Chambre', icon: '🛏️' },
  { value: 'corridor', label: 'Couloir', icon: '🚪' },
  { value: 'lobby', label: 'Lobby', icon: '🏨' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'spa', label: 'Spa/Piscine', icon: '🏊' },
  { value: 'technical', label: 'Local technique', icon: '🔧' },
  { value: 'other', label: 'Autre', icon: '📍' },
];

export function RoomRegistryAutocomplete({
  hotelId,
  value,
  onChange,
  locationType,
  placeholder = "Rechercher un espace..."
}: RoomRegistryAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newFloor, setNewFloor] = useState<string>("");
  const [newZone, setNewZone] = useState("");
  const queryClient = useQueryClient();

  // Fetch rooms from registry
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["room-registry", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_rooms_registry")
        .select("id, room_number, floor, room_type, building, zone")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("room_number");

      if (error) throw error;
      return data as RoomRegistry[];
    },
    enabled: !!hotelId,
  });

  // Filter rooms based on search
  const filteredRooms = rooms?.filter(room => 
    room.room_number.toLowerCase().includes(search.toLowerCase()) ||
    room.zone?.toLowerCase().includes(search.toLowerCase()) ||
    room.building?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Check if the search term exists in the registry
  const searchExistsInRegistry = rooms?.some(
    room => room.room_number.toLowerCase() === search.toLowerCase()
  );

  // Create new space mutation
  const createSpaceMutation = useMutation({
    mutationFn: async (spaceName: string) => {
      // Determine room_type based on location_type
      let roomType = locationType;
      if (locationType === 'lobby') roomType = 'Lobby';
      else if (locationType === 'corridor') roomType = 'Couloir';
      else if (locationType === 'restaurant') roomType = 'Restaurant';
      else if (locationType === 'spa') roomType = 'Spa/Piscine';
      else if (locationType === 'technical') roomType = 'Local technique';
      else if (locationType === 'room') roomType = 'Chambre';
      else roomType = 'Autre';

      const { data, error } = await supabase
        .from("hotel_rooms_registry")
        .insert({
          hotel_id: hotelId,
          room_number: spaceName,
          floor: newFloor ? parseInt(newFloor) : null,
          zone: newZone || null,
          room_type: roomType,
          source: 'manual',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["room-registry", hotelId] });
      onChange(data.room_number);
      setShowCreateDialog(false);
      setNewSpaceName("");
      setNewFloor("");
      setNewZone("");
      setOpen(false);
      toast({ title: "Espace créé et ajouté au registre" });
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast({ variant: "destructive", title: "Cet espace existe déjà" });
      } else {
        toast({ variant: "destructive", title: "Erreur lors de la création" });
      }
    },
  });

  const handleSelectRoom = (roomNumber: string) => {
    onChange(roomNumber);
    setOpen(false);
  };

  const handleCreateSpace = () => {
    if (!newSpaceName.trim()) {
      toast({ variant: "destructive", title: "Nom requis" });
      return;
    }
    createSpaceMutation.mutate(newSpaceName.trim());
  };

  const openCreateDialog = () => {
    setNewSpaceName(search);
    setShowCreateDialog(true);
  };

  const locTypeInfo = LOCATION_TYPES.find(l => l.value === locationType);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value ? (
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {value}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Rechercher..." 
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    <div className="py-3 px-4 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        Aucun espace trouvé
                      </p>
                      {search && !searchExistsInRegistry && (
                        <Button 
                          size="sm" 
                          onClick={openCreateDialog}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Créer "{search}"
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                  <CommandGroup heading="Espaces enregistrés">
                    {filteredRooms.map((room) => (
                      <CommandItem
                        key={room.id}
                        value={room.room_number}
                        onSelect={() => handleSelectRoom(room.room_number)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === room.room_number ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{room.room_number}</span>
                          {(room.floor !== null || room.zone) && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {room.floor !== null && `Étage ${room.floor}`}
                              {room.floor !== null && room.zone && ' • '}
                              {room.zone}
                            </span>
                          )}
                        </div>
                        {room.room_type && (
                          <Badge variant="secondary" className="text-xs">
                            {room.room_type}
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  
                  {/* Create new option */}
                  {search && !searchExistsInRegistry && filteredRooms.length > 0 && (
                    <CommandGroup>
                      <CommandItem
                        value={`create-${search}`}
                        onSelect={openCreateDialog}
                        className="text-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Créer "{search}"
                      </CommandItem>
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create new space dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Créer un nouvel espace
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              L'espace sera ajouté au registre des chambres de l'hôtel.
            </p>

            <div className="space-y-2">
              <Label>Nom de l'espace *</Label>
              <Input
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder={locTypeInfo ? `Ex: ${locTypeInfo.label} 1` : "Ex: Lobby principal"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Étage</Label>
                <Select value={newFloor} onValueChange={setNewFloor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optionnel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">-1</SelectItem>
                    <SelectItem value="0">RDC</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Zone</Label>
                <Input
                  value={newZone}
                  onChange={(e) => setNewZone(e.target.value)}
                  placeholder="Ex: Aile Nord"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-lg">{locTypeInfo?.icon || '📍'}</span>
              <div>
                <p className="text-sm font-medium">Type: {locTypeInfo?.label || 'Autre'}</p>
                <p className="text-xs text-muted-foreground">
                  Basé sur le type de lieu sélectionné
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleCreateSpace} 
              disabled={createSpaceMutation.isPending}
            >
              {createSpaceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer et sélectionner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
