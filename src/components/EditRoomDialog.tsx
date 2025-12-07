import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Room } from "@/services/pdfService";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  number: z.string().min(1, "Le numéro de chambre est requis"),
  status: z.string().min(1, "Le statut est requis"),
  cleaningType: z.enum(['a_blanc', 'recouche', 'none', 'full', 'quick'], {
    required_error: "Le type de nettoyage est requis",
  }),
  priority: z.enum(['high', 'medium', 'low'], {
    required_error: "La priorité est requise",
  }),
  floor: z.string().optional(),
  isTwin: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
  notUrgent: z.boolean().default(false),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  onEditRoom: (updatedRoom: Room) => void;
  existingRooms: Room[];
}

export function EditRoomDialog({ open, onOpenChange, room, onEditRoom, existingRooms }: EditRoomDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: room.number || '',
      status: room.status || '',
      cleaningType: room.cleaningType || 'a_blanc',
      priority: room.priority || 'medium',
      floor: room.floor?.toString() || '',
      isTwin: room.isTwin || false,
      isUrgent: room.isUrgent || false,
      notUrgent: room.notUrgent || false,
      notes: room.notes || '',
    },
  });

  const onSubmit = (data: FormData) => {
    // Vérifier si le nouveau numéro existe déjà (sauf pour la chambre actuelle)
    const roomExists = existingRooms.some(existingRoom => 
      existingRoom.number === data.number && existingRoom.number !== room.number
    );
    
    if (roomExists) {
      toast({
        title: "Erreur",
        description: "Une chambre avec ce numéro existe déjà",
        variant: "destructive",
      });
      return;
    }

    const updatedRoom: Room = {
      ...room,
      number: data.number,
      status: data.status,
      cleaningType: data.cleaningType,
      priority: data.priority,
      floor: data.floor ? parseInt(data.floor) : undefined,
      isTwin: data.isTwin,
      isUrgent: data.isUrgent,
      notUrgent: data.notUrgent,
      notes: data.notes,
    };

    onEditRoom(updatedRoom);
    
    toast({
      title: "Succès",
      description: `Chambre ${data.number} modifiée avec succès`,
    });

    onOpenChange(false);
  };

  const statusOptions = [
    { value: 'DIRTY', label: 'Sale' },
    { value: 'CLEAN', label: 'Propre' },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'OOO', label: 'Hors service' },
    { value: 'DEPARTURE', label: 'Départ' },
    { value: 'ARRIVAL', label: 'Arrivée' },
    { value: 'STAY', label: 'Occupée' },
    { value: 'VACANT', label: 'Libre' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier la chambre {room.number}</DialogTitle>
          <DialogDescription>
            Modifiez les détails de cette chambre.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de chambre *</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: 101" {...field} />
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
                      <Input type="number" placeholder="ex: 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez le statut" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cleaningType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de nettoyage *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Type de nettoyage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="a_blanc">À Blanc (départ)</SelectItem>
                        <SelectItem value="recouche">Recouche (client reste)</SelectItem>
                        <SelectItem value="none">Aucun nettoyage</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorité *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez la priorité" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="high">Haute</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="low">Basse</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="isTwin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Chambre twin</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isUrgent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Urgent</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notUrgent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Non urgent</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Remarques ou informations supplémentaires..."
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit">
                Sauvegarder les modifications
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}