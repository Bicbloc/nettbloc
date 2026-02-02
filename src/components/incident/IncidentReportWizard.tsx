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
  FileText,
  Send,
  MapPin,
  Wrench,
  Tag,
  Users
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

// Step-by-step wizard: Photo → AI → Location → Item → Type → Title → Assignment → Description → Confirm
type WizardStep = 
  | 'photo' 
  | 'analysis' 
  | 'location' 
  | 'item' 
  | 'type' 
  | 'title' 
  | 'assignment' 
  | 'description' 
  | 'confirm';

const STEPS: WizardStep[] = ['photo', 'analysis', 'location', 'item', 'type', 'title', 'assignment', 'description', 'confirm'];

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
      setCurrentStep('location');
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
    setCurrentStep('location');
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

  // Navigation
  const getStepIndex = () => STEPS.indexOf(currentStep);
  const getStepProgress = () => ((getStepIndex() + 1) / STEPS.length) * 100;

  const goNext = () => {
    const idx = getStepIndex();
    if (idx < STEPS.length - 1) {
      // Skip analysis step if no image
      if (STEPS[idx + 1] === 'analysis' && !selectedImage) {
        setCurrentStep('location');
      } else {
        setCurrentStep(STEPS[idx + 1]);
      }
    }
  };

  const goBack = () => {
    const idx = getStepIndex();
    if (idx > 0) {
      // Skip analysis step when going back
      if (STEPS[idx - 1] === 'analysis') {
        setCurrentStep('photo');
      } else {
        setCurrentStep(STEPS[idx - 1]);
      }
    }
  };

  const getStepConfig = () => {
    switch (currentStep) {
      case 'photo':
        return { icon: Camera, title: "Photo de l'incident", subtitle: "Prenez une photo pour l'analyse IA" };
      case 'analysis':
        return { icon: Sparkles, title: "Analyse IA", subtitle: "Identification automatique..." };
      case 'location':
        return { icon: MapPin, title: "Où est le problème ?", subtitle: "Sélectionnez la chambre ou le lieu" };
      case 'item':
        return { icon: Tag, title: "Quel élément ?", subtitle: "Identifiez l'élément concerné" };
      case 'type':
        return { icon: Wrench, title: "Type de problème", subtitle: "Quel type d'intervention ?" };
      case 'title':
        return { icon: FileText, title: "Titre du signalement", subtitle: "Décrivez brièvement le problème" };
      case 'assignment':
        return { icon: Users, title: "Assigner à", subtitle: "Quel service doit intervenir ? (optionnel)" };
      case 'description':
        return { icon: FileText, title: "Détails supplémentaires", subtitle: "Informations complémentaires (optionnel)" };
      case 'confirm':
        return { icon: Check, title: "Confirmation", subtitle: "Vérifiez et envoyez" };
      default:
        return { icon: AlertTriangle, title: "", subtitle: "" };
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

  const canProceed = () => {
    switch (currentStep) {
      case 'location': return !!form.watch('location_reference');
      case 'item': return !!form.watch('item_id');
      case 'type': return !!form.watch('type_id');
      case 'title': return form.watch('title')?.length >= 3;
      case 'assignment': return true; // Optional
      case 'description': return true; // Optional
      default: return true;
    }
  };

  const stepConfig = getStepConfig();
  const StepIcon = stepConfig.icon;

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
      <DialogContent className="w-[95vw] max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header compact */}
        <div className="p-4 border-b bg-muted/30">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <StepIcon className="h-5 w-5 text-primary" />
              {stepConfig.title}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{stepConfig.subtitle}</p>
          </DialogHeader>
          <Progress value={getStepProgress()} className="h-1.5 mt-3" />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            Étape {getStepIndex() + 1} / {STEPS.length}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* AI Banner if available */}
            {aiSuggestion && currentStep !== 'photo' && currentStep !== 'analysis' && currentStep !== 'confirm' && (
              <Card className="p-2 mb-4 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-2 text-xs">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-primary font-medium">IA</span>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(aiSuggestion.confidence * 100)}%
                  </Badge>
                </div>
              </Card>
            )}

            {/* Image preview compact */}
            {imagePreview && currentStep !== 'photo' && currentStep !== 'analysis' && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg mb-4">
                <img src={imagePreview} alt="Photo" className="h-10 w-10 object-cover rounded" />
                <span className="text-xs text-muted-foreground">Photo jointe</span>
              </div>
            )}

            {/* STEP: Photo */}
            {currentStep === 'photo' && (
              <div className="space-y-4">
                <Card className="p-8 border-dashed border-2 text-center">
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
                      <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium">Prenez une photo</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        L'IA identifiera automatiquement le problème
                      </p>
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
                    variant="ghost" 
                    className="flex-1"
                    onClick={skipAnalysis}
                  >
                    Passer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  {selectedImage && (
                    <Button 
                      className="flex-1"
                      onClick={analyzeImage}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyser
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* STEP: Analysis */}
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
                <p className="font-medium">Analyse en cours...</p>
              </div>
            )}

            {/* STEP: Location */}
            {currentStep === 'location' && (
              <div className="space-y-4">
                {registeredRooms && registeredRooms.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {registeredRooms.map((room) => (
                      <Button
                        key={room.id}
                        variant={form.watch('location_reference') === room.room_number ? "default" : "outline"}
                        className="h-14 text-lg font-bold"
                        onClick={() => form.setValue('location_reference', room.room_number)}
                      >
                        {room.room_number}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Input 
                    placeholder="Numéro de chambre ou lieu..." 
                    value={form.watch('location_reference')}
                    onChange={(e) => form.setValue('location_reference', e.target.value)}
                    className="h-14 text-lg text-center"
                  />
                )}
              </div>
            )}

            {/* STEP: Item */}
            {currentStep === 'item' && (
              <div className="space-y-3">
                {categoriesWithItems?.map((category) => (
                  <div key={category.id}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      {category.icon} {category.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {category.items.map((item: any) => (
                        <Button
                          key={item.id}
                          variant={form.watch('item_id') === item.id ? "default" : "outline"}
                          className="h-12 justify-start text-left"
                          onClick={() => form.setValue('item_id', item.id)}
                        >
                          {item.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP: Type */}
            {currentStep === 'type' && (
              <div className="grid grid-cols-1 gap-2">
                {types?.map((type) => (
                  <Button
                    key={type.id}
                    variant={form.watch('type_id') === type.id ? "default" : "outline"}
                    className="h-14 justify-start text-left gap-3"
                    onClick={() => form.setValue('type_id', type.id)}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: type.color || '#gray' }}
                    />
                    <span className="font-medium">{type.name}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* STEP: Title */}
            {currentStep === 'title' && (
              <div className="space-y-4">
                <Input 
                  placeholder="Ex: WC bouché, Ampoule grillée..." 
                  value={form.watch('title')}
                  onChange={(e) => form.setValue('title', e.target.value)}
                  className="h-14 text-lg"
                  autoFocus
                />
                {aiSuggestion?.suggested_title && form.watch('title') !== aiSuggestion.suggested_title && (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => form.setValue('title', aiSuggestion.suggested_title)}
                  >
                    <Sparkles className="h-4 w-4" />
                    Utiliser la suggestion IA: "{aiSuggestion.suggested_title}"
                  </Button>
                )}
              </div>
            )}

            {/* STEP: Assignment */}
            {currentStep === 'assignment' && (
              <div className="space-y-2">
                <Button
                  variant={!form.watch('assigned_to_role_id') ? "default" : "outline"}
                  className="w-full h-12 justify-start"
                  onClick={() => form.setValue('assigned_to_role_id', '')}
                >
                  Aucune assignation
                </Button>
                {staffRoles?.map((role) => (
                  <Button
                    key={role.id}
                    variant={form.watch('assigned_to_role_id') === role.id ? "default" : "outline"}
                    className="w-full h-12 justify-start"
                    onClick={() => form.setValue('assigned_to_role_id', role.id)}
                  >
                    {role.name}
                  </Button>
                ))}
              </div>
            )}

            {/* STEP: Description */}
            {currentStep === 'description' && (
              <div className="space-y-4">
                <Textarea
                  placeholder="Informations supplémentaires (optionnel)..."
                  value={form.watch('description')}
                  onChange={(e) => form.setValue('description', e.target.value)}
                  rows={4}
                  className="resize-none text-base"
                  autoFocus
                />
              </div>
            )}

            {/* STEP: Confirm */}
            {currentStep === 'confirm' && (
              <div className="space-y-4">
                <Card className="p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Récapitulatif
                  </h4>
                  
                  {imagePreview && (
                    <img src={imagePreview} alt="Photo" className="w-full h-32 object-cover rounded-lg" />
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Chambre:</span>
                      <span className="font-medium">{form.getValues('location_reference')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Élément:</span>
                      <span className="font-medium">{getItemName(form.getValues('item_id'))}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-medium">{getTypeName(form.getValues('type_id'))}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Titre:</span>
                      <span className="font-medium">{form.getValues('title')}</span>
                    </div>
                    {form.getValues('assigned_to_role_id') && (
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">Assigné à:</span>
                        <span className="font-medium">
                          {staffRoles?.find(r => r.id === form.getValues('assigned_to_role_id'))?.name}
                        </span>
                      </div>
                    )}
                    {form.getValues('description') && (
                      <div className="pt-1">
                        <span className="text-muted-foreground">Détails:</span>
                        <p className="mt-1 text-xs bg-muted p-2 rounded">
                          {form.getValues('description')}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer navigation */}
        {currentStep !== 'photo' && currentStep !== 'analysis' && (
          <div className="p-4 border-t bg-background flex gap-2">
            <Button 
              variant="outline" 
              onClick={goBack}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            {currentStep === 'confirm' ? (
              <Button 
                onClick={() => createIncidentMutation.mutate(form.getValues())}
                disabled={createIncidentMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {createIncidentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Envoyer
              </Button>
            ) : (
              <Button 
                onClick={goNext}
                disabled={!canProceed()}
                className="flex-1"
              >
                Suivant
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
