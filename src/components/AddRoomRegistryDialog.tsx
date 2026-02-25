import React, { useState } from 'react';
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

interface AddRoomRegistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId?: string;
  defaultCategory?: string;
}

export function AddRoomRegistryDialog({ open, onOpenChange, hotelId, defaultCategory = 'room' }: AddRoomRegistryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customFloor, setCustomFloor] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      space_category: defaultCategory,
      room_number: '',
      floor: '',
      room_type: '',
      building: '',
      zone: '',
    },
  });

  const category = form.watch('space_category');
  const isSpace = category === 'common' || category === 'technical';

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
          space_category: values.space_category,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-registry'] });
      toast({ title: "Espace ajouté", description: "L'espace a été ajouté au registre" });
      form.reset({ space_category: defaultCategory, room_number: '', floor: '', room_type: '', building: '', zone: '' });
      setCustomFloor(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible d'ajouter", variant: "destructive" });
    },
  });

  const onSubmit = (values: FormData) => {
    addRoomMutation.mutate(values);
  };

  const placeholder = isSpace ? "Ex: Couloir 1er, Chaufferie..." : "101";
  const categoryLabel = category === 'room' ? 'chambre' : category === 'common' ? 'espace commun' : 'espace technique';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un espace</DialogTitle>
          <DialogDescription>
            Ajoutez une chambre ou un espace au registre
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="space_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégorie *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <FormMessage />
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
                    <Input placeholder={placeholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isSpace && (
              <FormField
                control={form.control}
                name="room_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type d'espace</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPACE_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!isSpace && (
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
