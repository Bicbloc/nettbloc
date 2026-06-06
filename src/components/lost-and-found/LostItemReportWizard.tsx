import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/services/notificationService";
import { useAiFeatures } from "@/hooks/use-ai-features";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeCameraInput } from "@/components/NativeCameraInput";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Package, 
  Camera, 
  X, 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  Check,
  User,
  Calendar,
  MapPin,
  Send,
  Tag,
  FileText,
  Search
} from "lucide-react";
import { fetchRoomGuestOptions, type RoomGuestOption } from "@/components/lost-and-found/roomGuestLookup";

export interface GuestInfo {
  firstName?: string;
  lastName?: string;
  checkIn?: string;
  checkOut?: string;
  type?: 'arrival' | 'departure' | 'staying';
}

export interface LostItemReportWizardProps {
  hotelId: string;
  reporterName: string;
  reporterType: "housekeeper" | "governess" | "staff" | "admin" | "technician";
  roomNumber?: string;
  guestArrival?: GuestInfo;
  guestDeparture?: GuestInfo;
  guestStaying?: GuestInfo;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const LOCATION_TYPES = [
  { value: "room", label: "Chambre", icon: "🚪" },
  { value: "corridor", label: "Couloir", icon: "🚶" },
  { value: "lobby", label: "Lobby", icon: "🏨" },
  { value: "restaurant", label: "Restaurant", icon: "🍽️" },
  { value: "pool", label: "Piscine", icon: "🏊" },
  { value: "gym", label: "Salle de sport", icon: "🏋️" },
  { value: "parking", label: "Parking", icon: "🅿️" },
  { value: "other", label: "Autre", icon: "📍" },
];

const OBJECT_CATEGORIES = [
  { value: "electronics", label: "Électronique", icon: "📱" },
  { value: "clothing", label: "Vêtements", icon: "👕" },
  { value: "jewelry", label: "Bijoux", icon: "💍" },
  { value: "documents", label: "Documents", icon: "📄" },
  { value: "personal", label: "Effets personnels", icon: "👜" },
  { value: "valuables", label: "Objets de valeur", icon: "💎" },
  { value: "other", label: "Autre", icon: "📦" },
];

// Step-by-step wizard
type WizardStep = 
  | 'photo' 
  | 'analysis' 
  | 'location_type'
  | 'room_number'
  | 'location_details'
  | 'description' 
  | 'category' 
  | 'guest_name'
  | 'guest_dates'
  | 'confirm';

const STEPS: WizardStep[] = [
  'photo', 
  'analysis', 
  'location_type', 
  'room_number',
  'location_details',
  'description', 
  'category',
  'guest_name',
  'guest_dates',
  'confirm'
];

export function LostItemReportWizard({
  hotelId,
  reporterName,
  reporterType,
  roomNumber: defaultRoomNumber,
  guestArrival,
  guestDeparture,
  guestStaying,
  trigger,
  onSuccess,
}: LostItemReportWizardProps) {
  const { aiEnabled } = useAiFeatures(hotelId);
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('photo');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Form fields
  const [objectDescription, setObjectDescription] = useState("");
  const [objectCategory, setObjectCategory] = useState("other");
  const [locationType, setLocationType] = useState(defaultRoomNumber ? "room" : "");
  const [roomNumber, setRoomNumber] = useState(defaultRoomNumber || "");
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [locationDetails, setLocationDetails] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestCheckIn, setGuestCheckIn] = useState("");
  const [guestCheckOut, setGuestCheckOut] = useState("");
  const [selectedGuest, setSelectedGuest] = useState("");
  const [fetchedGuestOptions, setFetchedGuestOptions] = useState<RoomGuestOption[]>([]);

  // Search query for categories
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  // AI Results
  const [aiSuggestion, setAiSuggestion] = useState<{
    object_name: string;
    category: string;
    description: string;
    estimated_value: string;
    brand: string | null;
    color: string;
    condition: string;
    confidence: number;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clearGuestFields = useCallback(() => {
    setGuestFirstName("");
    setGuestName("");
    setGuestCheckIn("");
    setGuestCheckOut("");
  }, []);

  const fallbackGuestOptions = useMemo(() => [
    guestDeparture ? { key: 'departure', label: 'Départ (check-out)', info: guestDeparture } : null,
    guestStaying ? { key: 'staying', label: 'En cours (séjour)', info: guestStaying } : null,
    guestArrival ? { key: 'arrival', label: 'Arrivée', info: guestArrival } : null,
  ].filter(Boolean) as RoomGuestOption[], [guestArrival, guestDeparture, guestStaying]);

  const shouldUseFallbackGuestOptions =
    !!defaultRoomNumber && roomNumber.trim().toLowerCase() === defaultRoomNumber.trim().toLowerCase();

  const guestOptions = useMemo(() => {
    if (fetchedGuestOptions.length > 0) return fetchedGuestOptions;
    if (shouldUseFallbackGuestOptions) return fallbackGuestOptions;
    return [] as RoomGuestOption[];
  }, [fetchedGuestOptions, shouldUseFallbackGuestOptions, fallbackGuestOptions]);

  useEffect(() => {
    if (!open || locationType !== "room") return;

    setFetchedGuestOptions([]);

    const normalizedRoom = roomNumber.trim();
    if (!normalizedRoom) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const options = await fetchRoomGuestOptions(hotelId, normalizedRoom);
      if (!cancelled) {
        setFetchedGuestOptions(options);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, hotelId, locationType, roomNumber]);

  useEffect(() => {
    if (!open || locationType !== "room") return;
    if (selectedGuest === 'manual') return;

    let guestToUse: GuestInfo | undefined;
    if (guestOptions.length > 1) {
      guestToUse = guestOptions.find((guest) => guest.key === selectedGuest)?.info;
    } else {
      guestToUse = guestOptions[0]?.info;
    }

    if (guestToUse) {
      setGuestFirstName(guestToUse.firstName || "");
      setGuestName(guestToUse.lastName || "");
      setGuestCheckIn(guestToUse.checkIn || "");
      setGuestCheckOut(guestToUse.checkOut || "");
    } else {
      clearGuestFields();
    }
  }, [open, locationType, selectedGuest, guestOptions, clearGuestFields]);

  useEffect(() => {
    if (!open || locationType !== "room") return;

    if (guestOptions.length === 0) {
      setSelectedGuest("");
      return;
    }

    if (!guestOptions.some((guest) => guest.key === selectedGuest)) {
      setSelectedGuest(guestOptions[0].key);
    }
  }, [open, locationType, guestOptions, selectedGuest]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCurrentStep('photo');
      setSelectedImage(null);
      setImagePreview(null);
      setAiSuggestion(null);
      setIsAnalyzing(false);
      setImageUrl("");
      setObjectDescription("");
      setObjectCategory("other");
      setLocationType(defaultRoomNumber ? "room" : "");
      setRoomNumber(defaultRoomNumber || "");
      setAvailableRooms([]);
      setLocationDetails("");
      setGuestName("");
      setGuestFirstName("");
      setGuestCheckIn("");
      setGuestCheckOut("");
      setSelectedGuest("");
      setFetchedGuestOptions([]);
      setCategorySearchQuery("");
    }
  }, [open, defaultRoomNumber]);

  useEffect(() => {
    if (!open || !hotelId) return;

    let cancelled = false;

    (async () => {
      const [roomsRes, registryRes] = await Promise.all([
        supabase
          .from("rooms")
          .select("room_number")
          .eq("hotel_id", hotelId)
          .order("room_number"),
        supabase
          .from("hotel_rooms_registry")
          .select("room_number")
          .eq("hotel_id", hotelId)
          .eq("is_active", true)
          .order("room_number"),
      ]);

      if (cancelled) return;

      const mergedRooms = [
        ...(roomsRes.data || []).map((room) => room.room_number),
        ...(registryRes.data || []).map((room) => room.room_number),
      ]
        .filter((value): value is string => !!value)
        .map((value) => value.trim())
        .filter(Boolean);

      const uniqueSortedRooms = Array.from(new Set(mergedRooms)).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );

      setAvailableRooms(uniqueSortedRooms);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, hotelId]);

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return OBJECT_CATEGORIES;
    return OBJECT_CATEGORIES.filter(cat => 
      cat.label.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );
  }, [categorySearchQuery]);

  // Handle image selection - auto-trigger analysis after capture
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageCapture(e.target.files[0]);
    }
    e.target.value = '';
  };

  // Used by native camera (APK) — accepts a File directly
  const handleImageCapture = (file: File) => {
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    setTimeout(() => {
      analyzeImageWithFile(file);
    }, 300);
  };

  // Analyze with explicit file param (for auto-trigger after capture)
  const analyzeImageWithFile = async (file: File) => {
    setIsAnalyzing(true);
    setCurrentStep('analysis');
    
    try {
      const uploadedUrl = await uploadImage(file);
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
      }

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const { data, error } = aiEnabled
        ? await supabase.functions.invoke('recognize-lost-item', {
            body: { imageBase64: base64.split(',')[1], context: { hotelId } }
          })
        : { data: null, error: null };

      if (error) throw error;

      if (data && data.success) {
        setAiSuggestion(data);
        applyAiSuggestions(data);
      }
    } catch (error) {
      console.error('Erreur analyse IA:', error);
      toast({
        title: "Analyse IA indisponible",
        description: "Vous pouvez remplir le formulaire manuellement",
      });
    } finally {
      setIsAnalyzing(false);
      setCurrentStep('location_type');
    }
  };

  // Upload image and get URL
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${hotelId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("lost-items")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("lost-items")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // AI Analysis
  const analyzeImage = async () => {
    if (!selectedImage) return;
    
    setIsAnalyzing(true);
    setCurrentStep('analysis');
    
    try {
      const uploadedUrl = await uploadImage(selectedImage);
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
      }

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedImage);
      });

      const { data, error } = aiEnabled
        ? await supabase.functions.invoke('recognize-lost-item', {
            body: { imageBase64: base64.split(',')[1], context: { hotelId } }
          })
        : { data: null, error: null };

      if (error) throw error;

      if (data && data.success) {
        setAiSuggestion(data);
        applyAiSuggestions(data);
      }
    } catch (error) {
      console.error('Erreur analyse IA:', error);
      toast({
        title: "Analyse IA indisponible",
        description: "Vous pouvez remplir le formulaire manuellement",
      });
    } finally {
      setIsAnalyzing(false);
      setCurrentStep('location_type');
    }
  };

  // Apply AI suggestions to form - PRE-SELECT category and description
  const applyAiSuggestions = (result: any) => {
    // Build rich description from AI
    if (result.object_name) {
      let description = result.object_name;
      if (result.brand) description += ` - ${result.brand}`;
      if (result.color) description += ` (${result.color})`;
      if (result.description) description += `. ${result.description}`;
      setObjectDescription(description);
    }

    // PRE-SELECT the category detected by AI
    if (result.category) {
      const matchingCategory = OBJECT_CATEGORIES.find(c => 
        c.value === result.category ||
        c.label.toLowerCase().includes(result.category.toLowerCase()) ||
        result.category.toLowerCase().includes(c.label.toLowerCase())
      );
      if (matchingCategory) {
        setObjectCategory(matchingCategory.value);
        toast({
          title: "✨ Détection IA réussie",
          description: `Catégorie: ${matchingCategory.label}. Vérifiez la présélection.`,
        });
      } else {
        // Default to "other" but notify user
        setObjectCategory("other");
        toast({
          title: "⚠️ Catégorie non reconnue",
          description: `L'IA a détecté "${result.category}" - sélectionnez manuellement`,
        });
      }
    }
  };

  // Skip AI analysis
  const skipAnalysis = async () => {
    if (selectedImage) {
      const uploadedUrl = await uploadImage(selectedImage);
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
      }
    }
    setCurrentStep('location_type');
  };

  // Create lost item mutation
  const createItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lost_and_found").insert({
        hotel_id: hotelId,
        object_description: objectDescription,
        object_category: objectCategory,
        location_type: locationType,
        room_number: locationType === "room" ? roomNumber : null,
        location_details: locationDetails || null,
        guest_name: guestName || null,
        guest_first_name: guestFirstName || null,
        guest_check_in: guestCheckIn || null,
        guest_check_out: guestCheckOut || null,
        image_url: imageUrl || null,
        reported_by: reporterName,
        reported_by_type: reporterType,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      // Log to activity journal
      supabase.from("daily_action_logs").insert({
        hotel_id: hotelId,
        action_type: "lost_item_reported",
        description: `Objet trouvé signalé: ${objectDescription} (${locationType === 'room' ? 'Chambre ' + roomNumber : locationType})`,
        room_number: locationType === 'room' ? roomNumber : null,
        actor_name: reporterName,
        actor_type: reporterType,
      }).then(() => {});

      // Notification à l'établissement
      createNotification({
        hotelId,
        title: "🧳 Objet trouvé signalé",
        description: `${objectDescription}${locationType === 'room' && roomNumber ? ` — Chambre ${roomNumber}` : ''} (par ${reporterName})`,
        type: "lost_item",
        roomNumber: locationType === 'room' ? roomNumber : undefined,
        housekeeperName: reporterName,
      });

      toast({
        title: "✅ Objet signalé",
        description: "L'objet trouvé a été enregistré avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["lost-and-found", hotelId] });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer l'objet trouvé.",
        variant: "destructive",
      });
      console.error("Error creating lost item:", error);
    },
  });

  // Get applicable steps based on location type
  const getApplicableSteps = (): WizardStep[] => {
    const steps: WizardStep[] = ['photo', 'analysis', 'location_type'];
    
    if (locationType === 'room') {
      steps.push('room_number');
    }
    
    steps.push('location_details', 'description', 'category');
    
    if (locationType === 'room') {
      steps.push('guest_name', 'guest_dates');
    }
    
    steps.push('confirm');
    return steps;
  };

  const applicableSteps = getApplicableSteps();
  const getStepIndex = () => applicableSteps.indexOf(currentStep);
  const getStepProgress = () => ((getStepIndex() + 1) / applicableSteps.length) * 100;

  const goNext = () => {
    const steps = getApplicableSteps();
    const idx = steps.indexOf(currentStep);
    if (idx < steps.length - 1) {
      // Skip analysis if no image
      if (steps[idx + 1] === 'analysis' && !selectedImage) {
        setCurrentStep('location_type');
      } else {
        setCurrentStep(steps[idx + 1]);
      }
    }
  };

  const goBack = () => {
    const steps = getApplicableSteps();
    const idx = steps.indexOf(currentStep);
    if (idx > 0) {
      if (steps[idx - 1] === 'analysis') {
        setCurrentStep('photo');
      } else {
        setCurrentStep(steps[idx - 1]);
      }
    }
  };

  const getStepConfig = () => {
    switch (currentStep) {
      case 'photo':
        return { icon: Camera, title: "Photo de l'objet", subtitle: "Prenez une photo pour l'analyse IA" };
      case 'analysis':
        return { icon: Sparkles, title: "Analyse IA", subtitle: "Identification automatique..." };
      case 'location_type':
        return { icon: MapPin, title: "Lieu de découverte", subtitle: "Où avez-vous trouvé l'objet ?" };
      case 'room_number':
        return { icon: MapPin, title: "Numéro de chambre", subtitle: "Quelle chambre ?" };
      case 'location_details':
        return { icon: MapPin, title: "Précisions", subtitle: "Où exactement ? (optionnel)" };
      case 'description':
        return { icon: FileText, title: "Description", subtitle: "Décrivez l'objet trouvé" };
      case 'category':
        return { icon: Tag, title: "Catégorie", subtitle: "Type d'objet" };
      case 'guest_name':
        return { icon: User, title: "Nom du client", subtitle: "Propriétaire potentiel (optionnel)" };
      case 'guest_dates':
        return { icon: Calendar, title: "Dates de séjour", subtitle: "Arrivée et départ (optionnel)" };
      case 'confirm':
        return { icon: Check, title: "Confirmation", subtitle: "Vérifiez et envoyez" };
      default:
        return { icon: Package, title: "", subtitle: "" };
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'location_type': return !!locationType;
      case 'room_number': return !!roomNumber;
      case 'location_details': return true; // Optional
      case 'description': return objectDescription.length >= 3;
      case 'category': return !!objectCategory;
      case 'guest_name': return true; // Optional
      case 'guest_dates': return true; // Optional
      default: return true;
    }
  };

  const getCategoryLabel = (value: string) => {
    return OBJECT_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getLocationLabel = (value: string) => {
    return LOCATION_TYPES.find(l => l.value === value)?.label || value;
  };

  const stepConfig = getStepConfig();
  const StepIcon = stepConfig.icon;
  const hasUnsavedProgress = Boolean(
    selectedImage ||
    imagePreview ||
    imageUrl ||
    objectDescription ||
    objectCategory ||
    locationType ||
    roomNumber ||
    locationDetails ||
    guestName ||
    guestFirstName ||
    guestCheckIn ||
    guestCheckOut
  );

  const handleExplicitClose = () => {
    if (isAnalyzing || uploading || createItemMutation.isPending) return;
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && ((isAnalyzing || uploading || createItemMutation.isPending) || hasUnsavedProgress)) return;
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Package className="h-4 w-4" />
            Signaler un objet trouvé
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[85vh] w-[95vw] max-w-md flex-col overflow-hidden p-0 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header compact */}
        <div className="border-b bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <DialogHeader className="pb-2 text-left">
              <DialogTitle className="flex items-center gap-2 text-base">
                <StepIcon className="h-5 w-5 text-warning" />
                {stepConfig.title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{stepConfig.subtitle}</p>
            </DialogHeader>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleExplicitClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={getStepProgress()} className="h-1.5 mt-3" />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            Étape {getStepIndex() + 1} / {applicableSteps.length}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* AI Banner if available */}
            {aiSuggestion && currentStep !== 'photo' && currentStep !== 'analysis' && currentStep !== 'confirm' && (
              <Card className="p-2 mb-4 bg-amber-50 border-amber-200">
                <div className="flex items-center gap-2 text-xs">
                  <Sparkles className="h-3 w-3 text-amber-600" />
                  <span className="text-amber-700 font-medium">IA</span>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(aiSuggestion.confidence * 100)}%
                  </Badge>
                </div>
              </Card>
            )}

            {/* Image preview compact */}
            {imagePreview && currentStep !== 'photo' && currentStep !== 'analysis' && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg mb-4">
                <img src={imagePreview} alt="Photo de l'objet trouvé" className="h-10 w-10 object-cover rounded" />
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
                        alt="Aperçu de l'objet trouvé" 
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
                    <NativeCameraInput
                      onCapture={handleImageCapture}
                      source="camera"
                      className="cursor-pointer block w-full"
                    >
                      <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium">Photographiez l'objet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        L'IA identifiera automatiquement l'objet
                      </p>
                    </NativeCameraInput>
                  )}
                </Card>

                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    className="flex-1"
                    onClick={skipAnalysis}
                    disabled={uploading}
                  >
                    Passer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  {selectedImage && (
                    <Button 
                      className="flex-1"
                      onClick={analyzeImage}
                      disabled={uploading}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {uploading ? "Envoi..." : "Analyser"}
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
                      alt="Analyse de l'image" 
                      className="max-h-32 rounded-lg mx-auto opacity-50"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-amber-600" />
                  </div>
                </div>
                <p className="font-medium">Analyse en cours...</p>
              </div>
            )}

            {/* STEP: Location Type */}
            {currentStep === 'location_type' && (
              <ScrollArea className="h-[300px] pr-2">
                <div className="grid grid-cols-2 gap-2">
                  {LOCATION_TYPES.map((loc) => (
                    <Button
                      key={loc.value}
                      variant={locationType === loc.value ? "default" : "outline"}
                      className="h-16 flex-col gap-1"
                      onClick={() => setLocationType(loc.value)}
                    >
                      <span className="text-xl">{loc.icon}</span>
                      <span className="text-sm">{loc.label}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* STEP: Room Number */}
            {currentStep === 'room_number' && (
              <div className="space-y-4">
                <Input 
                  placeholder="Numéro de chambre..." 
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="h-14 text-xl text-center font-bold"
                  list="lost-item-room-suggestions"
                  autoFocus
                />
                <datalist id="lost-item-room-suggestions">
                  {availableRooms.map((room) => (
                    <option key={room} value={room} />
                  ))}
                </datalist>

                {availableRooms.length > 0 && (
                  <ScrollArea className="h-[240px] rounded-md border border-border p-2">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {availableRooms.map((room) => (
                        <Button
                          key={room}
                          type="button"
                          variant={roomNumber === room ? "default" : "outline"}
                          className="h-11"
                          onClick={() => setRoomNumber(room)}
                        >
                          {room}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* STEP: Location Details */}
            {currentStep === 'location_details' && (
              <div className="space-y-4">
                <Input 
                  placeholder="Ex: Sous le lit, dans la salle de bain..." 
                  value={locationDetails}
                  onChange={(e) => setLocationDetails(e.target.value)}
                  className="h-12"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Précisez l'emplacement exact (optionnel)
                </p>
              </div>
            )}

            {/* STEP: Description */}
            {currentStep === 'description' && (
              <div className="space-y-4">
                <Textarea
                  placeholder="Ex: Téléphone Samsung noir, montre dorée..."
                  value={objectDescription}
                  onChange={(e) => setObjectDescription(e.target.value)}
                  rows={4}
                  className="resize-none text-base"
                  autoFocus
                />
                {aiSuggestion?.object_name && objectDescription !== aiSuggestion.object_name && (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 text-left"
                    onClick={() => {
                      let desc = aiSuggestion.object_name;
                      if (aiSuggestion.brand) desc += ` - ${aiSuggestion.brand}`;
                      if (aiSuggestion.color) desc += ` (${aiSuggestion.color})`;
                      setObjectDescription(desc);
                    }}
                  >
                    <Sparkles className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Suggestion: {aiSuggestion.object_name}</span>
                  </Button>
                )}
              </div>
            )}

            {/* STEP: Category */}
            {currentStep === 'category' && (
              <div className="space-y-3">
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher une catégorie..."
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>

                {/* Categories with scroll */}
                <ScrollArea className="h-[280px] pr-2">
                  <div className="grid grid-cols-2 gap-2">
                    {filteredCategories.map((cat) => (
                      <Button
                        key={cat.value}
                        variant={objectCategory === cat.value ? "default" : "outline"}
                        className="h-14 flex-col gap-1"
                        onClick={() => setObjectCategory(cat.value)}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-xs">{cat.label}</span>
                      </Button>
                    ))}
                    {filteredCategories.length === 0 && (
                      <div className="col-span-2 text-center py-8 text-muted-foreground">
                        Aucune catégorie trouvée
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* STEP: Guest Name */}
            {currentStep === 'guest_name' && (
              <div className="space-y-4">
                {guestOptions.length > 0 && (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Quel client a oublié l'objet ?
                    </h4>
                    <RadioGroup value={selectedGuest} onValueChange={setSelectedGuest} className="space-y-2">
                      {guestOptions.map((guest) => (
                        <div key={guest.key} className="flex items-center space-x-3 rounded-lg border border-border bg-background p-3">
                          <RadioGroupItem value={guest.key} id={`wizard-guest-${guest.key}`} />
                          <label htmlFor={`wizard-guest-${guest.key}`} className="flex-1 cursor-pointer text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                {guest.key === 'departure' ? (
                                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                                ) : guest.key === 'arrival' ? (
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <User className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium">{guest.label}</span>
                                <span className="text-muted-foreground">
                                  {guest.info.firstName} {guest.info.lastName}
                                </span>
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                      <div className="flex items-center space-x-3 rounded-lg border border-border bg-background p-3">
                        <RadioGroupItem value="manual" id="wizard-guest-manual" />
                        <label htmlFor="wizard-guest-manual" className="flex-1 cursor-pointer text-sm font-medium">
                          Saisir manuellement
                        </label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Prénom</label>
                    <Input 
                      placeholder="Prénom..."
                      value={guestFirstName}
                      onChange={(e) => setGuestFirstName(e.target.value)}
                      readOnly={!!selectedGuest && selectedGuest !== 'manual'}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Nom</label>
                    <Input 
                      placeholder="Nom..."
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      readOnly={!!selectedGuest && selectedGuest !== 'manual'}
                      className="h-12"
                    />
                  </div>
                </div>
                {guestOptions.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    💡 Informations pré-remplies depuis les données de la chambre
                  </p>
                )}
              </div>
            )}

            {/* STEP: Guest Dates */}
            {currentStep === 'guest_dates' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Arrivée</label>
                    <Input 
                      type="date"
                      value={guestCheckIn}
                      onChange={(e) => setGuestCheckIn(e.target.value)}
                      readOnly={!!selectedGuest && selectedGuest !== 'manual'}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Départ</label>
                    <Input 
                      type="date"
                      value={guestCheckOut}
                      onChange={(e) => setGuestCheckOut(e.target.value)}
                      readOnly={!!selectedGuest && selectedGuest !== 'manual'}
                      className="h-12"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP: Confirm */}
            {currentStep === 'confirm' && (
              <ScrollArea className="h-[300px] pr-2">
                <div className="space-y-4">
                  <Card className="p-4 bg-amber-50 border-amber-200">
                    <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Récapitulatif
                    </h4>
                    
                    <div className="space-y-3 text-sm">
                      {imagePreview && (
                        <div className="flex justify-center pb-2">
                          <img 
                            src={imagePreview} 
                            alt="Objet trouvé" 
                            className="max-h-24 rounded-lg"
                          />
                        </div>
                      )}

                      <div className="flex items-start gap-2 py-1 border-b border-amber-200">
                        <Package className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium">Objet: </span>
                          <span>{objectDescription}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 py-1 border-b border-amber-200">
                        <Tag className="h-4 w-4 text-amber-700 flex-shrink-0" />
                        <span className="font-medium">Catégorie: </span>
                        <Badge variant="secondary">
                          {OBJECT_CATEGORIES.find(c => c.value === objectCategory)?.icon} {getCategoryLabel(objectCategory)}
                        </Badge>
                      </div>

                      <div className="flex items-start gap-2 py-1 border-b border-amber-200">
                        <MapPin className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Lieu: </span>
                          <span>
                            {getLocationLabel(locationType)}
                            {roomNumber && ` - Chambre ${roomNumber}`}
                            {locationDetails && ` (${locationDetails})`}
                          </span>
                        </div>
                      </div>

                      {(guestFirstName || guestName) && (
                        <div className="flex items-start gap-2 py-1">
                          <User className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Client: </span>
                            <span>{guestFirstName} {guestName}</span>
                            {(guestCheckIn || guestCheckOut) && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Calendar className="h-3 w-3" />
                                {guestCheckIn && `Du ${new Date(guestCheckIn).toLocaleDateString('fr-FR')}`}
                                {guestCheckOut && ` au ${new Date(guestCheckOut).toLocaleDateString('fr-FR')}`}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {aiSuggestion && aiSuggestion.confidence < 0.6 && (
                    <Card className="p-3 bg-orange-50 border-orange-200">
                      <div className="flex items-center gap-2 text-orange-800 text-sm">
                        <Sparkles className="h-4 w-4" />
                        <span>L'IA n'a pas pu identifier l'objet avec certitude - l'admin vérifiera</span>
                      </div>
                    </Card>
                  )}
                </div>
              </ScrollArea>
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
                onClick={() => createItemMutation.mutate()}
                disabled={createItemMutation.isPending}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {createItemMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enregistrer
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
