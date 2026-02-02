import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Send
} from "lucide-react";

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

type WizardStep = 'photo' | 'analysis' | 'form' | 'confirm';

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
  const [locationDetails, setLocationDetails] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestCheckIn, setGuestCheckIn] = useState("");
  const [guestCheckOut, setGuestCheckOut] = useState("");

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

  // Determine best guest info to use
  const bestGuest = useMemo(() => {
    // Priority: departure (most likely left something) > staying > arrival
    if (guestDeparture) return guestDeparture;
    if (guestStaying) return guestStaying;
    if (guestArrival) return guestArrival;
    return null;
  }, [guestArrival, guestDeparture, guestStaying]);

  // Auto-fill guest info when opening or when room is selected
  useEffect(() => {
    if (open && locationType === "room" && bestGuest) {
      setGuestFirstName(bestGuest.firstName || "");
      setGuestName(bestGuest.lastName || "");
      setGuestCheckIn(bestGuest.checkIn || "");
      setGuestCheckOut(bestGuest.checkOut || "");
    }
  }, [open, locationType, bestGuest]);

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
      setLocationDetails("");
      setGuestName("");
      setGuestFirstName("");
      setGuestCheckIn("");
      setGuestCheckOut("");
    }
  }, [open, defaultRoomNumber]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
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
      // Upload image first
      const uploadedUrl = await uploadImage(selectedImage);
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
      }

      // Convert to base64 for AI
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedImage);
      });

      const { data, error } = await supabase.functions.invoke('recognize-lost-item', {
        body: { imageBase64: base64.split(',')[1] }
      });

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
      setCurrentStep('form');
    }
  };

  // Apply AI suggestions to form
  const applyAiSuggestions = (result: any) => {
    if (result.object_name) {
      let description = result.object_name;
      if (result.brand) description += ` - ${result.brand}`;
      if (result.color) description += ` (${result.color})`;
      if (result.description) description += `. ${result.description}`;
      setObjectDescription(description);
    }

    if (result.category && OBJECT_CATEGORIES.find(c => c.value === result.category)) {
      setObjectCategory(result.category);
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
    setCurrentStep('form');
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

  const getCategoryLabel = (value: string) => {
    return OBJECT_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getLocationLabel = (value: string) => {
    return LOCATION_TYPES.find(l => l.value === value)?.label || value;
  };

  const canProceedToConfirm = objectDescription && locationType;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Package className="h-4 w-4" />
            Signaler un objet trouvé
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header avec progression */}
        <div className="p-4 border-b bg-muted/30">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-amber-600" />
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
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                      <Camera className="h-8 w-8 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">Photographiez l'objet trouvé</p>
                      <p className="text-sm text-muted-foreground">
                        L'IA identifiera automatiquement l'objet
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
                id="lost-item-photo"
              />
              <label htmlFor="lost-item-photo">
                <Button variant="outline" className="w-full gap-2" asChild>
                  <span>
                    <Camera className="h-4 w-4" />
                    {imagePreview ? "Reprendre la photo" : "Prendre une photo"}
                  </span>
                </Button>
              </label>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={skipAnalysis}
                  disabled={uploading}
                >
                  Passer →
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={analyzeImage}
                  disabled={!selectedImage || uploading}
                >
                  <Sparkles className="h-4 w-4" />
                  {uploading ? "Envoi..." : "Analyser avec l'IA"}
                </Button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2: Analyse IA */}
          {currentStep === 'analysis' && (
            <div className="py-12 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 animate-spin opacity-20" />
                <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-amber-600 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Analyse en cours...</h3>
                <p className="text-muted-foreground">
                  L'IA identifie l'objet pour faciliter la restitution
                </p>
              </div>
              {imagePreview && (
                <img 
                  src={imagePreview} 
                  alt="Analysing" 
                  className="max-h-32 rounded-lg mx-auto opacity-50"
                />
              )}
            </div>
          )}

          {/* ÉTAPE 3: Formulaire */}
          {currentStep === 'form' && (
            <div className="space-y-4">
              {/* AI Results Banner */}
              {aiSuggestion && (
                <Card className="p-3 bg-amber-50 border-amber-200">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-amber-900">Analyse IA</span>
                        <Badge 
                          variant="outline" 
                          className={
                            aiSuggestion.confidence > 0.8 
                              ? "bg-green-100 text-green-800 border-green-300"
                              : aiSuggestion.confidence > 0.5
                              ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                              : "bg-orange-100 text-orange-800 border-orange-300"
                          }
                        >
                          {Math.round(aiSuggestion.confidence * 100)}% confiance
                        </Badge>
                      </div>
                      <p className="text-sm text-amber-800 mt-1">
                        {aiSuggestion.object_name}
                        {aiSuggestion.brand && ` - ${aiSuggestion.brand}`}
                        {aiSuggestion.color && ` (${aiSuggestion.color})`}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Image preview */}
              {imagePreview && (
                <div className="flex justify-center">
                  <img 
                    src={imagePreview} 
                    alt="Objet trouvé" 
                    className="max-h-24 rounded-lg shadow-sm"
                  />
                </div>
              )}

              {/* Object Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description de l'objet *</Label>
                <Textarea
                  id="description"
                  placeholder="Ex: Téléphone Samsung noir, montre dorée..."
                  value={objectDescription}
                  onChange={(e) => setObjectDescription(e.target.value)}
                  className="min-h-[80px]"
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={objectCategory} onValueChange={setObjectCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {OBJECT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Type */}
              <div className="space-y-2">
                <Label>Lieu de découverte *</Label>
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Où avez-vous trouvé l'objet ?" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.icon} {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Room Number (if room) */}
              {locationType === "room" && (
                <div className="space-y-2">
                  <Label htmlFor="roomNumber">Numéro de chambre</Label>
                  <Input
                    id="roomNumber"
                    placeholder="Ex: 101"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                  />
                </div>
              )}

              {/* Location Details */}
              <div className="space-y-2">
                <Label htmlFor="locationDetails">Précisions sur le lieu</Label>
                <Input
                  id="locationDetails"
                  placeholder="Ex: Sous le lit, dans la salle de bain..."
                  value={locationDetails}
                  onChange={(e) => setLocationDetails(e.target.value)}
                />
              </div>

              {/* Guest Info (if room) */}
              {locationType === "room" && (
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      Informations client
                      {bestGuest && <Badge variant="outline" className="ml-2 text-xs">Pré-rempli</Badge>}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="guestFirstName" className="text-xs">Prénom</Label>
                      <Input
                        id="guestFirstName"
                        value={guestFirstName}
                        onChange={(e) => setGuestFirstName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="guestName" className="text-xs">Nom</Label>
                      <Input
                        id="guestName"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <Label htmlFor="checkIn" className="text-xs">Arrivée</Label>
                      <Input
                        id="checkIn"
                        type="date"
                        value={guestCheckIn}
                        onChange={(e) => setGuestCheckIn(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="checkOut" className="text-xs">Départ</Label>
                      <Input
                        id="checkOut"
                        type="date"
                        value={guestCheckOut}
                        onChange={(e) => setGuestCheckOut(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                </Card>
              )}

              {/* Navigation */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('photo')}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => setCurrentStep('confirm')}
                  disabled={!canProceedToConfirm}
                >
                  Continuer
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ÉTAPE 4: Confirmation */}
          {currentStep === 'confirm' && (
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

                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 text-amber-700 mt-0.5" />
                    <div>
                      <span className="font-medium">Objet : </span>
                      <span>{objectDescription}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-medium">Catégorie : </span>
                    <Badge variant="secondary">
                      {OBJECT_CATEGORIES.find(c => c.value === objectCategory)?.icon} {getCategoryLabel(objectCategory)}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-amber-700 mt-0.5" />
                    <div>
                      <span className="font-medium">Lieu : </span>
                      <span>
                        {getLocationLabel(locationType)}
                        {roomNumber && ` - Chambre ${roomNumber}`}
                        {locationDetails && ` (${locationDetails})`}
                      </span>
                    </div>
                  </div>

                  {(guestFirstName || guestName) && (
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-amber-700 mt-0.5" />
                      <div>
                        <span className="font-medium">Client : </span>
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

              {/* Navigation */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('form')}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => createItemMutation.mutate()}
                  disabled={createItemMutation.isPending}
                >
                  {createItemMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enregistrer l'objet
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
