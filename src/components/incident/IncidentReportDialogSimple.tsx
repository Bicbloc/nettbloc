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
import { storageService } from "@/services/storageService";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Camera, X, Sparkles, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIncidentDefaults } from "@/hooks/use-incident-defaults";
import { ImageRecognitionButton } from "./ImageRecognitionButton";
import { NativeCameraInput } from "@/components/NativeCameraInput";

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
  defaultItemId?: string;
  defaultTypeId?: string;
  defaultTitle?: string;
}

export function IncidentReportDialogSimple({
  hotelId,
  userType,
  defaultLocation,
  defaultItemId,
  defaultTypeId,
  defaultTitle,
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
      item_id: defaultItemId || '',
      type_id: defaultTypeId || '',
      title: defaultTitle || '',
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

  // Handle AI recognition result - with "Autre" fallback and urgent notification
  const handleAiResult = async (result: any) => {
    setAiSuggestion(result);
    
    let foundItem = false;
    let usedAutreItem = false;
    
    // Try to find matching item
    if (categoriesWithItems && result.item) {
      for (const category of categoriesWithItems) {
        const matchingItem = category.items.find((item: any) => 
          item.name.toLowerCase().includes(result.item.toLowerCase()) ||
          result.item.toLowerCase().includes(item.name.toLowerCase())
        );
        if (matchingItem) {
          form.setValue('item_id', matchingItem.id);
          foundItem = true;
          break;
        }
      }
    }
    
    // If no matching item found, try to find "Autre" item
    if (!foundItem && categoriesWithItems) {
      for (const category of categoriesWithItems) {
        const autreItem = category.items.find((item: any) => 
          item.name.toLowerCase() === 'autre' || 
          item.name.toLowerCase() === 'autres'
        );
        if (autreItem) {
          form.setValue('item_id', autreItem.id);
          usedAutreItem = true;
          // Add AI detected name to description for admin review
          const currentDesc = form.getValues('description') || '';
          form.setValue('description', `[IA: ${result.item}] ${currentDesc}`.trim());
          break;
        }
      }
    }

    let foundType = false;
    let usedAutreType = false;
    
    // Try to find matching type
    if (types && result.problem_type) {
      const matchingType = types.find((type: any) =>
        type.name.toLowerCase().includes(result.problem_type.toLowerCase()) ||
        result.problem_type.toLowerCase().includes(type.name.toLowerCase())
      );
      if (matchingType) {
        form.setValue('type_id', matchingType.id);
        foundType = true;
      }
    }
    
    // If no matching type found, try to find "Autre" type
    if (!foundType && types) {
      const autreType = types.find((type: any) => 
        type.name.toLowerCase() === 'autre' || 
        type.name.toLowerCase() === 'autres'
      );
      if (autreType) {
        form.setValue('type_id', autreType.id);
        usedAutreType = true;
      }
    }

    // Set suggested title
    if (result.suggested_title && !form.getValues('title')) {
      form.setValue('title', result.suggested_title);
    }
    
    // Notify user if "Autre" was used (requires admin attention)
    if (usedAutreItem || usedAutreType) {
      toast({
        title: "⚠️ Élément non reconnu",
        description: `L'IA a détecté "${result.item}" mais l'élément n'existe pas. L'admin devra le classifier.`,
        variant: "default",
      });
    }
  };

  const createIncidentMutation = useMutation({
    mutationFn: async (values: z.infer<typeof incidentSchema>) => {
      const { data: user } = await supabase.auth.getUser();
      
      const housekeeperSession = storageService.getHousekeeperSession();
      const housekeeperProfile = storageService.getHousekeeperProfile();
      
      const reportedById = user?.user?.id || housekeeperProfile?.id || null;
      const reportedByName = user?.user?.email 
        || housekeeperProfile?.name 
        || housekeeperSession?.name 
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
      // Log to activity journal
      supabase.from("daily_action_logs").insert({
        hotel_id: hotelId,
        action_type: "incident_created",
        description: `Incident signalé: ${incident.title} (Chambre ${incident.location_reference})`,
        room_number: incident.location_reference,
        actor_name: userType === 'admin' ? 'Admin' : 'Utilisateur',
        actor_type: userType,
      }).then(() => {});

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

  const handleImageCapture = (file: File) => {
    setSelectedImages((prev) => [...prev, file]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto h-10">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs sm:text-sm">Incident</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
            Signaler un incident
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2 sm:pr-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                createIncidentMutation.mutate(values)
              )}
              className="space-y-3 sm:space-y-4"
            >
              {/* Photos with AI Recognition - Compact */}
              <div className="space-y-2">
                <FormLabel className="flex items-center gap-2 text-sm">
                  <Camera className="h-3.5 w-3.5" />
                  Photo (optionnel) - IA pré-remplit le formulaire
                </FormLabel>
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Preview ${index}`}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border-2 border-border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <NativeCameraInput
                    onCapture={handleImageCapture}
                    source="prompt"
                    className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent hover:border-primary transition-all active:scale-95"
                  >
                    <div className="text-center">
                      <Camera className="h-5 w-5 mx-auto text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Photo</span>
                    </div>
                  </NativeCameraInput>
                </div>

                {/* AI Recognition Button - Auto-trigger on image */}
                {selectedImages.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <ImageRecognitionButton
                      imageFile={selectedImages[0]}
                      onResult={handleAiResult}
                    />
                    {aiSuggestion && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Sparkles className="h-3 w-3" />
                        {Math.round(aiSuggestion.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                )}

                {/* AI Suggestion Display - Compact */}
                {aiSuggestion && (
                  <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                      <Sparkles className="h-3 w-3" />
                      Suggestion IA appliquée
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <span className="text-muted-foreground truncate">{aiSuggestion.category} → {aiSuggestion.item}</span>
                      <span className="text-muted-foreground truncate">{aiSuggestion.problem_type}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Title - Compact */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-sm">Titre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: WC bouché" {...field} className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Two columns on larger screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Item organized by category */}
                <FormField
                  control={form.control}
                  name="item_id"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm">Élément *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[250px]">
                          {categoriesWithItems?.map((category) => (
                            <div key={category.id}>
                              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
                                {category.icon} {category.name}
                              </div>
                              {category.items.map((item: any) => (
                                <SelectItem key={item.id} value={item.id} className="pl-5 text-sm">
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
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm">Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {types?.map((type) => (
                            <SelectItem key={type.id} value={type.id} className="text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
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
              </div>

              {/* Location and Assignment in row on mobile */}
              <div className="grid grid-cols-2 gap-3">
                {/* Location */}
                <FormField
                  control={form.control}
                  name="location_reference"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm">Chambre *</FormLabel>
                      {registeredRooms && registeredRooms.length > 0 ? (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="N°..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[200px]">
                            {registeredRooms.map((room) => (
                              <SelectItem key={room.id} value={room.room_number} className="text-sm">
                                {room.room_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <FormControl>
                          <Input placeholder="101..." {...field} className="h-9" />
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
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm">Assigner</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Service..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {staffRoles?.map((role) => (
                            <SelectItem key={role.id} value={role.id} className="text-sm">
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description - Collapsible on mobile */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-sm">Détails (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informations supplémentaires..."
                        {...field}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold"
                disabled={createIncidentMutation.isPending}
              >
                {createIncidentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Signaler l'incident
                  </>
                )}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
