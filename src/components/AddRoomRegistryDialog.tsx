import React from 'react';
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

interface AddRoomRegistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId?: string;
}

export function AddRoomRegistryDialog({ open, onOpenChange, hotelId }: AddRoomRegistryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      room_number: '',
      floor: '',
      room_type: '',
      building: '',
      zone: '',
    },
  });

  const addRoomMutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (!hotelId) throw new Error('Hotel ID manquant');

      const { error } = await supabase
        .from('hotel_rooms_registry')
        .insert({
          hotel_id: hotelId,
          room_number: values.room_number,
          floor: values.floor ? parseInt(values.floor) : null,
          room_type: values.room_type || null,
          building: values.building || null,
          zone: values.zone || null,
          source: 'manual',
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-registry'] });
      toast({
        title: "Chambre ajoutée",
        description: "La chambre a été ajoutée au registre",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter la chambre",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormData) => {
    addRoomMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter une chambre</DialogTitle>
          <DialogDescription>
            Ajoutez une nouvelle chambre au registre de l'établissement
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
              <Button type="submit" disabled={addRoomMutation.isPending}>
                {addRoomMutation.isPending ? 'Ajout...' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
