import { useState, useEffect } from "react";
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
import { AlertTriangle, Camera, X, Sparkles, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIncidentDefaults } from "@/hooks/use-incident-defaults";
import { ImageRecognitionButton } from "./ImageRecognitionButton";

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
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: string;
    item: string;
    problem_type: string;
    severity: string;
    suggested_title: string;
    confidence: number;
  } | null>(null);
  
  useIncidentDefaults(hotelId);

  const form = useForm<z.infer<typeof incidentSchema>>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      location_reference: defaultLocation || '',
    },
  });

  // Reset AI suggestion when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setAiSuggestion(null);
    }
  }, [isOpen]);

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

      const { data: items, error: itemError } = await supabase
        .from("incident_items")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("display_order");
      
      if (itemError) throw itemError;

      return categories.map(cat => ({
        ...cat,
        items: items.filter(item => item.category_id === cat.id)
      }));
    },
  });

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

  // Handle AI recognition result
  const handleAiResult = (result: any) => {
    setAiSuggestion(result);
    
    // Try to find matching item
    if (categoriesWithItems && result.item) {
      for (const category of categoriesWithItems) {
        const matchingItem = category.items.find((item: any) => 
          item.name.toLowerCase().includes(result.item.toLowerCase()) ||
          result.item.toLowerCase().includes(item.name.toLowerCase())
        );
        if (matchingItem) {
          form.setValue('item_id', matchingItem.id);
          break;
        }
      }
    }

    // Try to find matching type
    if (types && result.problem_type) {
      const matchingType = types.find((type: any) =>
        type.name.toLowerCase().includes(result.problem_type.toLowerCase()) ||
        result.problem_type.toLowerCase().includes(type.name.toLowerCase())
      );
      if (matchingType) {
        form.setValue('type_id', matchingType.id);
      }
    }

    // Set suggested title
    if (result.suggested_title && !form.getValues('title')) {
      form.setValue('title', result.suggested_title);
    }
  };

  const createIncidentMutation = useMutation({
    mutationFn: async (values: z.infer<typeof incidentSchema>) => {
      const { data: user } = await supabase.auth.getUser();
      
      const housekeeperData = localStorage.getItem('housekeeper') 
        ? JSON.parse(localStorage.getItem('housekeeper')!) 
        : null;
      const housekeeperProfile = localStorage.getItem('housekeeperProfile')
        ? JSON.parse(localStorage.getItem('housekeeperProfile')!)
        : null;
      
      const reportedById = user?.user?.id || housekeeperProfile?.id || null;
      const reportedByName = user?.user?.email 
        || housekeeperProfile?.name 
        || housekeeperData?.name 
        || 'Femme de chambre';

      const { data: item } = await supabase
        .from("incident_items")
        .select("category_id")
        .eq("id", values.item_id)
        .single();

      // Determine priority from AI suggestion or default
      const priority = aiSuggestion?.severity || "medium";

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
          priority,
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

      if (selectedImages.length > 0) {
        for (const image of selectedImages) {
          try {
            const fileExt = image.name.split(".").pop();
            const fileName = `${incident.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("incident-images")
              .upload(fileName, image);

            if (uploadError) {
              console.error("❌ Erreur upload image:", uploadError);
              throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
              .from("incident-images")
              .getPublicUrl(fileName);

            const { error: insertError } = await supabase.from("incident_images").insert({
              incident_id: incident.id,
              image_url: publicUrl,
              uploaded_by: reportedById || housekeeperProfile?.id || null,
            });

            if (insertError) {
              console.error("❌ Erreur insertion image:", insertError);
            }
          } catch (imageError) {
            console.error("❌ Erreur traitement image:", imageError);
          }
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
      
      form.reset();
      setSelectedImages([]);
      setAiSuggestion(null);
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
              {/* Photos with AI Recognition */}
              <div className="space-y-3">
                <FormLabel className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photos (optionnel)
                </FormLabel>
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Preview ${index}`}
                        className="w-24 h-24 object-cover rounded-lg border-2 border-border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <label className="w-24 h-24 flex items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent hover:border-primary transition-all">
                    <div className="text-center">
                      <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Ajouter</span>
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                </div>

                {/* AI Recognition Button */}
                {selectedImages.length > 0 && (
                  <div className="flex items-center gap-2">
                    <ImageRecognitionButton
                      imageFile={selectedImages[0]}
                      onResult={handleAiResult}
                    />
                    {aiSuggestion && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        {Math.round(aiSuggestion.confidence * 100)}% confiance
                      </Badge>
                    )}
                  </div>
                )}

                {/* AI Suggestion Display */}
                {aiSuggestion && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Sparkles className="h-4 w-4" />
                      Suggestion IA
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Catégorie:</span>{" "}
                        <span className="font-medium">{aiSuggestion.category}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Élément:</span>{" "}
                        <span className="font-medium">{aiSuggestion.item}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Problème:</span>{" "}
                        <span className="font-medium">{aiSuggestion.problem_type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gravité:</span>{" "}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                          {aiSuggestion.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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

              <Button
                type="submit"
                className="w-full"
                disabled={createIncidentMutation.isPending}
              >
                {createIncidentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Signaler l'incident"
                )}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
