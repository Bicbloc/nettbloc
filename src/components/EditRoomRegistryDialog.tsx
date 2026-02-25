import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FLOOR_OPTIONS, SPACE_TYPES } from '@/utils/floorUtils';

const formSchema = z.object({
  space_category: z.string().default('room'),
  room_number: z.string().min(1, "Le nom/numéro est requis"),
  floor: z.string().optional(),
  room_type: z.string().optional(),
  building: z.string().optional(),
  zone: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RoomRegistry {
  id: string;
  room_number: string;
  floor: number | null;
  room_type: string | null;
  building: string | null;
  zone: string | null;
  space_category?: string | null;
}

interface EditRoomRegistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: RoomRegistry;
}

export function EditRoomRegistryDialog({ open, onOpenChange, room }: EditRoomRegistryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customFloor, setCustomFloor] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      space_category: room.space_category || 'room',
      room_number: room.room_number,
      floor: room.floor?.toString() || '',
      room_type: room.room_type || '',
      building: room.building || '',
      zone: room.zone || '',
    },
  });

  useEffect(() => {
    const floorStr = room.floor?.toString() || '';
    const isStandard = FLOOR_OPTIONS.some(o => o.value === floorStr);
    setCustomFloor(!isStandard && floorStr !== '');
    form.reset({
      space_category: room.space_category || 'room',
      room_number: room.room_number,
      floor: floorStr,
      room_type: room.room_type || '',
      building: room.building || '',
      zone: room.zone || '',
    });
  }, [room, form]);

  const category = form.watch('space_category');
  const isSpace = category === 'common' || category === 'technical';

  const updateRoomMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const { error } = await supabase
        .from('hotel_rooms_registry')
        .update({
          room_number: values.room_number,
          floor: values.floor ? parseInt(values.floor) : null,
          room_type: values.room_type || null,
          building: values.building || null,
          zone: values.zone || null,
          space_category: values.space_category,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', room.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-registry'] });
      toast({ title: "Espace modifié", description: "Les informations ont été mises à jour" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible de modifier", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'espace</DialogTitle>
          <DialogDescription>
            Modifier les informations de {room.room_number}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => updateRoomMutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="space_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégorie</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="room">🛏️ Chambre</SelectItem>
                      <SelectItem value="common">🏢 Espace commun</SelectItem>
                      <SelectItem value="technical">⚙️ Espace technique</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="room_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isSpace ? "Nom de l'espace *" : "Numéro de chambre *"}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isSpace ? (
              <FormField
                control={form.control}
                name="room_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type d'espace</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPACE_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="room_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de chambre</FormLabel>
                    <FormControl>
                      <Input placeholder="Standard, Suite, Deluxe..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="floor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Étage</FormLabel>
                  {customFloor ? (
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type="number" placeholder="-2, 0, 5..." {...field} />
                      </FormControl>
                      <Button type="button" variant="outline" size="sm" onClick={() => setCustomFloor(false)}>
                        Liste
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FLOOR_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="sm" onClick={() => setCustomFloor(true)}>
                        Autre
                      </Button>
                    </div>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="building"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bâtiment</FormLabel>
                  <FormControl>
                    <Input placeholder="A, B, Principal..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zone</FormLabel>
                  <FormControl>
                    <Input placeholder="Nord, Sud, Est, Ouest..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateRoomMutation.isPending}>
                {updateRoomMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
