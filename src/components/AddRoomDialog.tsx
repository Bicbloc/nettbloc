import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from "lucide-react";
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
  linkedRooms: z.array(z.string()).default([]),
});

type FormData = z.infer<typeof formSchema>;

interface AddRoomDialogProps {
  onAddRoom: (room: Room) => void;
  existingRooms: Room[];
}

export function AddRoomDialog({ onAddRoom, existingRooms }: AddRoomDialogProps) {
  const [open, setOpen] = useState(false);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: '',
      status: '',
      cleaningType: 'a_blanc',
      priority: 'medium',
      floor: '',
      isTwin: false,
      isUrgent: false,
      notUrgent: false,
      notes: '',
      linkedRooms: [],
    },
  });

  const onSubmit = (data: FormData) => {
    // Vérifier si la chambre existe déjà
    const roomExists = existingRooms.some(room => room.number === data.number);
    if (roomExists) {
      toast({
        title: "Erreur",
        description: "Une chambre avec ce numéro existe déjà",
        variant: "destructive",
      });
      return;
    }

    const newRoom: Room = {
      number: data.number,
      status: data.status,
      cleaningType: data.cleaningType,
      priority: data.priority,
      floor: data.floor ? parseInt(data.floor) : undefined,
      isTwin: data.isTwin,
      isUrgent: data.isUrgent,
      notUrgent: data.notUrgent,
      notes: data.notes,
      linkedRooms: data.linkedRooms || [],
    };

    onAddRoom(newRoom);
    
    toast({
      title: "Succès",
      description: `Chambre ${data.number} ajoutée avec succès. Elle apparaît maintenant dans l'interface et sera incluse dans tous les rapports.`,
    });

    form.reset();
    setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter une chambre
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter une chambre manuellement</DialogTitle>
          <DialogDescription>
            Créez une nouvelle chambre si les données PDF ne sont pas correctement récupérées.
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                Ajouter la chambre
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}