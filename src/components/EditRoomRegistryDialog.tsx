import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  room_number: z.string().min(1, "Le numéro de chambre est requis"),
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
}

interface EditRoomRegistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: RoomRegistry;
}

export function EditRoomRegistryDialog({ open, onOpenChange, room }: EditRoomRegistryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      room_number: room.room_number,
      floor: room.floor?.toString() || '',
      room_type: room.room_type || '',
      building: room.building || '',
      zone: room.zone || '',
    },
  });

  // Update form when room changes
  useEffect(() => {
    form.reset({
      room_number: room.room_number,
      floor: room.floor?.toString() || '',
      room_type: room.room_type || '',
      building: room.building || '',
      zone: room.zone || '',
    });
  }, [room, form]);

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
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-registry'] });
      toast({
        title: "Chambre modifiée",
        description: "Les informations de la chambre ont été mises à jour",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier la chambre",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormData) => {
    updateRoomMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier la chambre</DialogTitle>
          <DialogDescription>
            Modifiez les informations de la chambre {room.room_number}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="room_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro de chambre *</FormLabel>
                  <FormControl>
                    <Input placeholder="101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="floor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Étage</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="room_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de chambre</FormLabel>
                  <FormControl>
                    <Input placeholder="Standard, Suite, Deluxe..." {...field} />
                  </FormControl>
                  <FormMessage />
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
                  <FormMessage />
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
                  <FormMessage />
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
