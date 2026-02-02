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
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  Camera, 
  X, 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  Check,
  Image as ImageIcon,
  FileText,
  Send
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIncidentDefaults } from "@/hooks/use-incident-defaults";
import { storageService } from "@/services/storageService";

const incidentSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  item_id: z.string().min(1, "Sélectionnez un article"),
  type_id: z.string().min(1, "Sélectionnez un type"),
  location_reference: z.string().min(1, "Précisez le lieu"),
  assigned_to_role_id: z.string().optional(),
  description: z.string().optional(),
});

interface IncidentReportWizardProps {
  hotelId: string;
  userType: "admin" | "housekeeper" | "governess" | "technician";
  userName?: string;
  userId?: string;
  defaultLocation?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

type WizardStep = 'photo' | 'analysis' | 'form' | 'confirm';

export function IncidentReportWizard({
  hotelId,
  userType,
  userName,
  userId,
  defaultLocation,
  trigger,
  onSuccess,
}: IncidentReportWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('photo');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
      item_id: '',
      type_id: '',
      title: '',
      description: '',
      assigned_to_role_id: '',
    },
  });

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('photo');
      setSelectedImage(null);
      setImagePreview(null);
      setAiSuggestion(null);
      setIsAnalyzing(false);
      form.reset({ location_reference: defaultLocation || '' });
    }
  }, [isOpen, form, defaultLocation]);

  // Queries
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

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // AI Analysis
  const analyzeImage = async () => {
    if (!selectedImage) return;
    
    setIsAnalyzing(true);
    setCurrentStep('analysis');
    
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedImage);
      });

      const { data, error } = await supabase.functions.invoke('recognize-incident-item', {
        body: { imageBase64: base64.split(',')[1] }
      });

      if (error) throw error;

      if (data) {
        setAiSuggestion(data);
        applyAiSuggestions(data);
      }
    } catch (error) {
      console.error('Erreur analyse IA:', error);
      toast({
        title: "Analyse IA indisponible",
        description: "Vous pouvez remplir le formulaire manuellement",
        variant: "default",
      });
    } finally {
      setIsAnalyzing(false);
      setCurrentStep('form');
    }
  };

  // Apply AI suggestions to form
  const applyAiSuggestions = (result: any) => {
    let foundItem = false;
    let usedAutreItem = false;
    
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
    
    if (!foundItem && categoriesWithItems) {
      for (const category of categoriesWithItems) {
        const autreItem = category.items.find((item: any) => 
          item.name.toLowerCase() === 'autre' || 
          item.name.toLowerCase() === 'autres'
        );
        if (autreItem) {
          form.setValue('item_id', autreItem.id);
          usedAutreItem = true;
          form.setValue('description', `[IA: ${result.item}] ${form.getValues('description') || ''}`.trim());
          break;
        }
      }
    }

    let foundType = false;
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
    
    if (!foundType && types) {
      const autreType = types.find((type: any) => 
        type.name.toLowerCase() === 'autre' || 
        type.name.toLowerCase() === 'autres'
      );
      if (autreType) {
        form.setValue('type_id', autreType.id);
      }
    }

    if (result.suggested_title) {
      form.setValue('title', result.suggested_title);
    }

    if (usedAutreItem) {
      toast({
        title: "⚠️ Élément non reconnu",
        description: `L'IA a détecté "${result.item}" - l'admin devra classifier`,
      });
    }
  };

  // Skip AI analysis
  const skipAnalysis = () => {
    setCurrentStep('form');
  };

  // Create incident mutation
  const createIncidentMutation = useMutation({
    mutationFn: async (values: z.infer<typeof incidentSchema>) => {
      const { data: user } = await supabase.auth.getUser();
      
      const housekeeperSession = storageService.getHousekeeperSession();
      const housekeeperProfile = storageService.getHousekeeperProfile();
      const governessProfile = localStorage.getItem('governess_profile');
      const technicianProfile = localStorage.getItem('technician_profile');
      
      let reportedById = user?.user?.id || userId || housekeeperProfile?.id || null;
      let reportedByName = userName 
        || user?.user?.email 
        || housekeeperProfile?.name 
        || housekeeperSession?.name;
      
      if (governessProfile) {
        const gp = JSON.parse(governessProfile);
        reportedById = reportedById || gp.id;
        reportedByName = reportedByName || gp.name;
      }
      if (technicianProfile) {
        const tp = JSON.parse(technicianProfile);
        reportedById = reportedById || tp.id;
        reportedByName = reportedByName || tp.name;
      }

      reportedByName = reportedByName || 'Utilisateur';

      const { data: item } = await supabase
        .from("incident_items")
        .select("category_id")
        .eq("id", values.item_id)
        .single();

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

      // Upload image if exists
      if (selectedImage) {
        try {
          const fileExt = selectedImage.name.split(".").pop();
          const fileName = `${incident.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("incident-images")
            .upload(fileName, selectedImage);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from("incident-images")
              .getPublicUrl(fileName);

            await supabase.from("incident_images").insert({
              incident_id: incident.id,
              image_url: publicUrl,
              uploaded_by: reportedById,
            });
          }
        } catch (imageError) {
          console.error("Erreur upload image:", imageError);
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
      setIsOpen(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStepProgress = () => {
    switch (currentStep) {
      case 'photo': return 25;
      case 'analysis': return 50;
      case 'form': return 75;
      case 'confirm': return 100;
      default: return 0;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'photo': return 'Étape 1 : Prendre une photo';
      case 'analysis': return 'Étape 2 : Analyse IA en cours...';
      case 'form': return 'Étape 3 : Vérifier et compléter';
      case 'confirm': return 'Étape 4 : Confirmation';
      default: return '';
    }
  };

  const getItemName = (itemId: string) => {
    if (!categoriesWithItems) return '';
    for (const cat of categoriesWithItems) {
      const item = cat.items.find((i: any) => i.id === itemId);
      if (item) return `${cat.icon || ''} ${item.name}`;
    }
    return '';
  };

  const getTypeName = (typeId: string) => {
    return types?.find((t: any) => t.id === typeId)?.name || '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Signaler un incident
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header avec progression */}
        <div className="p-4 border-b bg-muted/30">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {getStepTitle()}
            </DialogTitle>
          </DialogHeader>
          <Progress value={getStepProgress()} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className={currentStep === 'photo' ? 'text-primary font-medium' : ''}>📷 Photo</span>
            <span className={currentStep === 'analysis' ? 'text-primary font-medium' : ''}>🤖 IA</span>
            <span className={currentStep === 'form' ? 'text-primary font-medium' : ''}>📝 Détails</span>
            <span className={currentStep === 'confirm' ? 'text-primary font-medium' : ''}>✅ Envoi</span>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {/* ÉTAPE 1: Photo */}
          {currentStep === 'photo' && (
            <div className="space-y-4">
              <Card className="p-6 border-dashed border-2 text-center">
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-48 rounded-lg mx-auto"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <div className="py-8">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium">Prendre une photo de l'incident</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        L'IA analysera automatiquement l'image
                      </p>
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                )}
              </Card>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={skipAnalysis}
                >
                  Passer cette étape
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                {selectedImage && (
                  <Button 
                    className="flex-1"
                    onClick={analyzeImage}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyser avec l'IA
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 2: Analyse IA */}
          {currentStep === 'analysis' && (
            <div className="text-center py-12 space-y-4">
              <div className="relative inline-block">
                {imagePreview && (
                  <img 
                    src={imagePreview} 
                    alt="Analyse" 
                    className="max-h-32 rounded-lg mx-auto opacity-50"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              </div>
              <div>
                <p className="font-medium">Analyse en cours...</p>
                <p className="text-sm text-muted-foreground">
                  L'IA identifie l'élément et le type de problème
                </p>
              </div>
            </div>
          )}

          {/* ÉTAPE 3: Formulaire pré-rempli */}
          {currentStep === 'form' && (
            <div className="space-y-4">
              {/* Rapport IA */}
              {aiSuggestion && (
                <Card className="p-3 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                    <Sparkles className="h-4 w-4" />
                    Rapport IA
                    <Badge variant="secondary" className="ml-auto">
                      {Math.round(aiSuggestion.confidence * 100)}% confiance
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Catégorie:</span>
                      <span className="ml-1 font-medium">{aiSuggestion.category}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Élément:</span>
                      <span className="ml-1 font-medium">{aiSuggestion.item}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Problème:</span>
                      <span className="ml-1 font-medium">{aiSuggestion.problem_type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sévérité:</span>
                      <Badge 
                        variant="outline" 
                        className={
                          aiSuggestion.severity === 'high' ? 'border-red-300 text-red-700' :
                          aiSuggestion.severity === 'medium' ? 'border-orange-300 text-orange-700' :
                          'border-green-300 text-green-700'
                        }
                      >
                        {aiSuggestion.severity}
                      </Badge>
                    </div>
                  </div>
                </Card>
              )}

              {/* Image miniature */}
              {imagePreview && (
                <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                  <img src={imagePreview} alt="Photo" className="h-12 w-12 object-cover rounded" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Photo jointe</p>
                    <p className="text-xs text-muted-foreground">Sera envoyée avec l'incident</p>
                  </div>
                </div>
              )}

              <Form {...form}>
                <form className="space-y-3">
                  {/* Titre */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Titre *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: WC bouché" {...field} className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    {/* Élément */}
                    <FormField
                      control={form.control}
                      name="item_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Élément *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Sélectionner..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[200px]">
                              {categoriesWithItems?.map((category) => (
                                <div key={category.id}>
                                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
                                    {category.icon} {category.name}
                                  </div>
                                  {category.items.map((item: any) => (
                                    <SelectItem key={item.id} value={item.id} className="pl-5">
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
                          <FormLabel className="text-sm">Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Sélectionner..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {types?.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
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

                  <div className="grid grid-cols-2 gap-3">
                    {/* Chambre */}
                    <FormField
                      control={form.control}
                      name="location_reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Chambre *</FormLabel>
                          {registeredRooms && registeredRooms.length > 0 ? (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="N°..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[200px]">
                                {registeredRooms.map((room) => (
                                  <SelectItem key={room.id} value={room.room_number}>
                                    {room.room_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <FormControl>
                              <Input placeholder="101..." {...field} className="h-10" />
                            </FormControl>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Assigner */}
                    <FormField
                      control={form.control}
                      name="assigned_to_role_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Assigner</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Service..." />
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
                  </div>

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Détails (optionnel)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informations supplémentaires..."
                            {...field}
                            rows={2}
                            className="resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('photo')}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button 
                  onClick={() => setCurrentStep('confirm')}
                  className="flex-1"
                  disabled={!form.formState.isValid}
                >
                  Vérifier
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ÉTAPE 4: Confirmation */}
          {currentStep === 'confirm' && (
            <div className="space-y-4">
              <Card className="p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Récapitulatif de l'incident
                </h4>
                
                {imagePreview && (
                  <img src={imagePreview} alt="Photo" className="w-full h-32 object-cover rounded-lg" />
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Titre:</span>
                    <span className="font-medium">{form.getValues('title')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Élément:</span>
                    <span className="font-medium">{getItemName(form.getValues('item_id'))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">{getTypeName(form.getValues('type_id'))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chambre:</span>
                    <span className="font-medium">{form.getValues('location_reference')}</span>
                  </div>
                  {form.getValues('description') && (
                    <div>
                      <span className="text-muted-foreground">Détails:</span>
                      <p className="mt-1 text-xs bg-muted p-2 rounded">
                        {form.getValues('description')}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('form')}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
                <Button 
                  onClick={() => createIncidentMutation.mutate(form.getValues())}
                  disabled={createIncidentMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {createIncidentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Envoyer
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
