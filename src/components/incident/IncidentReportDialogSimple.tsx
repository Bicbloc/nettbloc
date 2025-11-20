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
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Camera, Upload, X } from "lucide-react";

const incidentSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  category_id: z.string().min(1, "Sélectionnez une catégorie"),
  item_id: z.string().min(1, "Sélectionnez un article"),
  type_id: z.string().min(1, "Sélectionnez un type"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  location_type: z.string().min(1, "Sélectionnez un lieu"),
  location_reference: z.string().min(1, "Précisez le lieu"),
  description: z.string().optional(),
});

interface IncidentReportDialogSimpleProps {
  hotelId: string;
  userType: "admin" | "housekeeper";
}

export function IncidentReportDialogSimple({
  hotelId,
  userType,
}: IncidentReportDialogSimpleProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const form = useForm<z.infer<typeof incidentSchema>>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      priority: "medium",
      location_type: "room",
    },
  });

  // Fetch registered rooms from PDF imports
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

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["incident-categories", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Fetch items filtered by category
  const { data: items } = useQuery({
    queryKey: ["incident-items", hotelId, selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return [];
      const { data, error } = await supabase
        .from("incident_items")
        .select("*")
        .eq("category_id", selectedCategoryId)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCategoryId,
  });

  // Fetch types
  const { data: types } = useQuery({
    queryKey: ["incident-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_types")
        .select("*")
        .eq("is_active", true)
        .order("severity", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (values: z.infer<typeof incidentSchema>) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Non authentifié");

      // Create incident
      const { data: incident, error: incidentError } = await supabase
        .from("incidents")
        .insert({
          hotel_id: hotelId,
          title: values.title,
          description: values.description,
          category_id: values.category_id,
          item_id: values.item_id,
          type_id: values.type_id,
          priority: values.priority,
          location_type: values.location_type,
          location_reference: values.location_reference,
          reported_by: user.user.id,
          reported_by_name: user.user.email || "Utilisateur",
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
            uploaded_by: user.user.id,
          });
        }
      }

      return incident;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast({
        title: "✅ Incident signalé",
        description: "L'incident a été enregistré avec succès",
      });
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
        <Button className="gap-2">
          <AlertTriangle className="h-4 w-4" />
          Signaler un incident
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Signaler un incident
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              createIncidentMutation.mutate(values)
            )}
            className="space-y-4"
          >
            {/* Quick Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre court</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: WC bouché chambre 101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Où est le problème ?</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedCategoryId(value);
                      form.setValue("item_id", "");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Item */}
            {selectedCategoryId && (
              <FormField
                control={form.control}
                name="item_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quel élément ?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {items?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Type */}
            <FormField
              control={form.control}
              name="type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de problème</FormLabel>
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
                              style={{ backgroundColor: type.color }}
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

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urgence</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">
                        <Badge variant="outline">Faible</Badge>
                      </SelectItem>
                      <SelectItem value="medium">
                        <Badge className="bg-yellow-500">Moyen</Badge>
                      </SelectItem>
                      <SelectItem value="high">
                        <Badge className="bg-orange-500">Élevé</Badge>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <Badge variant="destructive">🚨 Urgent</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de lieu</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="room">Chambre</SelectItem>
                        <SelectItem value="common_area">Zone commune</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="technical">Technique</SelectItem>
                        <SelectItem value="parking">Parking</SelectItem>
                        <SelectItem value="restaurant">Restaurant</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location_reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch("location_type") === "room" ? "Numéro de chambre" : "Référence"}
                    </FormLabel>
                    {form.watch("location_type") === "room" && registeredRooms && registeredRooms.length > 0 ? (
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
                              {room.room_type && ` (${room.room_type})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input placeholder="Ex: 101, RDC, Parking B..." {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnelle)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Détails supplémentaires..."
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
              <FormLabel>Photos (optionnelles)</FormLabel>
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
      </DialogContent>
    </Dialog>
  );
}