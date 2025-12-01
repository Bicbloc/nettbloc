import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Camera, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIncidentDefaults } from "@/hooks/use-incident-defaults";

const incidentSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  item_id: z.string().min(1, "Sélectionnez un article"),
  type_id: z.string().min(1, "Sélectionnez un type"),
  location_reference: z.string().min(1, "Précisez le lieu"),
  assigned_to_role_id: z.string().optional(),
  description: z.string().optional(),
});

interface IncidentReportDialogSimpleProps {
  hotelId: string;
  userType: "admin" | "housekeeper";
  defaultLocation?: string;
}

export function IncidentReportDialogSimple({
  hotelId,
  userType,
  defaultLocation,
}: IncidentReportDialogSimpleProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  
  // Initialiser les données par défaut si nécessaire
  useIncidentDefaults(hotelId);

  const form = useForm<z.infer<typeof incidentSchema>>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      location_reference: defaultLocation || '',
    },
  });

  // Fetch registered rooms
  const { data: registeredRooms } = useQuery({
    queryKey: ["registered-rooms", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_rooms_registry")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("room_number");
      if (error) throw error;
      return data;
    },
  });

  // Fetch categories with items
  const { data: categoriesWithItems } = useQuery({
    queryKey: ["categories-with-items", hotelId],
    queryFn: async () => {
      const { data: categories, error: catError } = await supabase
        .from("incident_categories")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("display_order");
      
      if (catError) throw catError;

      // Fetch all items for this hotel
      const { data: items, error: itemError } = await supabase
        .from("incident_items")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("display_order");
      
      if (itemError) throw itemError;

      // Group items by category
      return categories.map(cat => ({
        ...cat,
        items: items.filter(item => item.category_id === cat.id)
      }));
    },
  });

  // Fetch types
  const { data: types } = useQuery({
    queryKey: ["incident-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_types")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("severity", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch staff roles for this hotel
  const { data: staffRoles } = useQuery({
    queryKey: ["staff-roles", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_roles")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (values: z.infer<typeof incidentSchema>) => {
      // Essayer d'abord Supabase auth, sinon utiliser localStorage
      const { data: user } = await supabase.auth.getUser();
      
      // Récupérer les données de la femme de chambre depuis localStorage si pas auth
      const housekeeperData = localStorage.getItem('housekeeper') 
        ? JSON.parse(localStorage.getItem('housekeeper')!) 
        : null;
      const housekeeperProfile = localStorage.getItem('housekeeperProfile')
        ? JSON.parse(localStorage.getItem('housekeeperProfile')!)
        : null;
      
      // Déterminer qui rapporte l'incident
      const reportedById = user?.user?.id || housekeeperProfile?.id || null;
      const reportedByName = user?.user?.email 
        || housekeeperProfile?.name 
        || housekeeperData?.name 
        || 'Femme de chambre';

      // Get item details to extract category
      const { data: item } = await supabase
        .from("incident_items")
        .select("category_id")
        .eq("id", values.item_id)
        .single();

      // Create incident
      const { data: incident, error: incidentError } = await supabase
        .from("incidents")
        .insert({
          hotel_id: hotelId,
          title: values.title,
          description: values.description,
          category_id: item?.category_id,
          item_id: values.item_id,
          type_id: values.type_id,
          assigned_to_role_id: values.assigned_to_role_id || null,
          priority: "medium",
          location_type: "room",
          location_reference: values.location_reference,
          reported_by: reportedById,
          reported_by_name: reportedByName,
          reported_by_type: userType,
          status: "new",
        })
        .select()
        .single();

      if (incidentError) throw incidentError;

      // Upload images if any
      if (selectedImages.length > 0) {
        for (const image of selectedImages) {
          const fileExt = image.name.split(".").pop();
          const fileName = `${incident.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("incident-images")
            .upload(fileName, image);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("incident-images")
            .getPublicUrl(fileName);

          await supabase.from("incident_images").insert({
            incident_id: incident.id,
            image_url: publicUrl,
            uploaded_by: reportedById || housekeeperProfile?.id,
          });
        }
      }

      return incident;
    },
    onSuccess: async (incident) => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast({
        title: "✅ Incident signalé",
        description: "L'incident a été enregistré avec succès",
      });
      
      // Ajouter notification pour l'admin
      const { useNotificationContext } = await import('@/contexts/NotificationContext');
      try {
        const notificationContext = useNotificationContext();
        if (notificationContext?.addNotification) {
          await notificationContext.addNotification({
            title: `Incident signalé - CH ${incident.location_reference}`,
            description: `${userType === 'housekeeper' ? 'Femme de chambre' : 'Admin'} - ${incident.title}`,
            type: 'incident',
            room_number: incident.location_reference,
            user_type: 'admin'
          });
        }
      } catch (error) {
        console.log('Notification non disponible dans ce contexte');
      }
      
      form.reset();
      setSelectedImages([]);
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedImages([...selectedImages, ...Array.from(e.target.files)]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs sm:text-sm">Incident</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Signaler un incident
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                createIncidentMutation.mutate(values)
              )}
              className="space-y-4"
            >
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre court *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: WC bouché chambre 101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Item organized by category */}
              <FormField
                control={form.control}
                name="item_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quel élément ? *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner l'élément..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {categoriesWithItems?.map((category) => (
                          <div key={category.id}>
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50">
                              {category.icon} {category.name}
                            </div>
                            {category.items.map((item: any) => (
                              <SelectItem key={item.id} value={item.id} className="pl-6">
                                {item.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type */}
              <FormField
                control={form.control}
                name="type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de problème *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {types?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: type.color || '#gray' }}
                              />
                              {type.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location */}
              <FormField
                control={form.control}
                name="location_reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de chambre *</FormLabel>
                    {registeredRooms && registeredRooms.length > 0 ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[200px]">
                          {registeredRooms.map((room) => (
                            <SelectItem key={room.id} value={room.room_number}>
                              {room.room_number}
                              {room.floor && ` - Étage ${room.floor}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input placeholder="Ex: 101, 205..." {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assign to role */}
              <FormField
                control={form.control}
                name="assigned_to_role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigner à (optionnel)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un service..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {staffRoles?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Détails (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informations supplémentaires..."
                        {...field}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Photos */}
              <div className="space-y-2">
                <FormLabel>Photos (optionnel)</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Preview ${index}`}
                        className="w-20 h-20 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed rounded cursor-pointer hover:bg-accent">
                    <div className="text-center">
                      <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Ajouter</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createIncidentMutation.isPending}
              >
                {createIncidentMutation.isPending ? "Envoi..." : "Envoyer le signalement"}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
