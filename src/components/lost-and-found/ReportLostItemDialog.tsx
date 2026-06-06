import { useState, useEffect } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Package, Camera, User, Calendar, ArrowRight, ArrowLeft } from "lucide-react";

export interface GuestInfo {
  firstName?: string;
  lastName?: string;
  checkIn?: string;
  checkOut?: string;
  type?: 'arrival' | 'departure' | 'staying';
}

interface ReportLostItemDialogProps {
  hotelId: string;
  reporterName: string;
  reporterType: "housekeeper" | "governess" | "staff" | "admin";
  roomNumber?: string;
  /** Guest info for arrival (checking in today) */
  guestArrival?: GuestInfo;
  /** Guest info for departure (checking out today) */
  guestDeparture?: GuestInfo;
  /** Guest info when there's only one guest (staying) */
  guestStaying?: GuestInfo;
  trigger?: React.ReactNode;
}

const LOCATION_TYPES = [
  { value: "room", label: "Chambre" },
  { value: "corridor", label: "Couloir" },
  { value: "lobby", label: "Lobby" },
  { value: "restaurant", label: "Restaurant" },
  { value: "pool", label: "Piscine" },
  { value: "gym", label: "Salle de sport" },
  { value: "parking", label: "Parking" },
  { value: "other", label: "Autre" },
];

const OBJECT_CATEGORIES = [
  { value: "electronics", label: "Électronique" },
  { value: "clothing", label: "Vêtements" },
  { value: "jewelry", label: "Bijoux" },
  { value: "documents", label: "Documents" },
  { value: "personal", label: "Effets personnels" },
  { value: "other", label: "Autre" },
];

export function ReportLostItemDialog({
  hotelId,
  reporterName,
  reporterType,
  roomNumber: defaultRoomNumber,
  guestArrival,
  guestDeparture,
  guestStaying,
  trigger,
}: ReportLostItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [objectDescription, setObjectDescription] = useState("");
  const [objectCategory, setObjectCategory] = useState("other");
  const [locationType, setLocationType] = useState(defaultRoomNumber ? "room" : "");
  const [roomNumber, setRoomNumber] = useState(defaultRoomNumber || "");
  const [locationDetails, setLocationDetails] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestCheckIn, setGuestCheckIn] = useState("");
  const [guestCheckOut, setGuestCheckOut] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<string>("");
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [manualRoom, setManualRoom] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Charger les chambres existantes de l'hôtel pour les proposer dans une liste
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("rooms")
        .select("room_number")
        .eq("hotel_id", hotelId)
        .order("room_number");
      if (!cancelled && data) {
        setAvailableRooms(data.map((r) => r.room_number));
      }
    })();
    return () => { cancelled = true; };
  }, [open, hotelId]);

  // Options de clients à proposer (départ = check-out, en cours = staying, arrivée)
  const guestOptions = [
    guestDeparture ? { key: 'departure', label: 'Départ (check-out)', info: guestDeparture } : null,
    guestStaying ? { key: 'staying', label: 'En cours (séjour)', info: guestStaying } : null,
    guestArrival ? { key: 'arrival', label: 'Arrivée', info: guestArrival } : null,
  ].filter(Boolean) as { key: string; label: string; info: GuestInfo }[];

  // Determine available guests
  const hasMultipleGuests = guestArrival && guestDeparture;
  const hasSingleGuest = guestStaying || (guestArrival && !guestDeparture) || (guestDeparture && !guestArrival);

  // Pre-fill guest info when dialog opens or guest selection changes
  useEffect(() => {
    if (!open) return;
    if (selectedGuest === 'manual') return;

    // Si plusieurs clients sont proposés, on suit la sélection radio
    let guestToUse: GuestInfo | undefined;
    if (guestOptions.length > 1) {
      guestToUse = guestOptions.find((g) => g.key === selectedGuest)?.info;
    } else if (guestOptions.length === 1) {
      guestToUse = guestOptions[0].info;
    }

    if (guestToUse) {
      setGuestFirstName(guestToUse.firstName || "");
      setGuestName(guestToUse.lastName || "");
      setGuestCheckIn(guestToUse.checkIn || "");
      setGuestCheckOut(guestToUse.checkOut || "");
    }
  }, [open, selectedGuest, guestArrival, guestDeparture, guestStaying]);

  // Sélection par défaut : le client en départ (check-out), le plus probable propriétaire
  useEffect(() => {
    if (open && guestOptions.length > 1 && !selectedGuest) {
      setSelectedGuest(guestOptions[0].key);
    }
  }, [open, selectedGuest, guestArrival, guestDeparture, guestStaying]);


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
        title: "Objet signalé",
        description: "L'objet trouvé a été enregistré avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["lost-and-found", hotelId] });
      resetForm();
      setOpen(false);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${hotelId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("lost-items")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("lost-items")
        .getPublicUrl(fileName);

      setImageUrl(urlData.publicUrl);
      toast({
        title: "Image téléchargée",
        description: "L'image a été ajoutée avec succès.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger l'image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setObjectDescription("");
    setObjectCategory("other");
    setLocationType(defaultRoomNumber ? "room" : "");
    setRoomNumber(defaultRoomNumber || "");
    setLocationDetails("");
    setGuestName("");
    setGuestFirstName("");
    setGuestCheckIn("");
    setGuestCheckOut("");
    setImageUrl("");
    setSelectedGuest("");
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    } catch {
      return dateStr;
    }
  };

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Signaler un objet trouvé
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Object Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description de l'objet *</Label>
            <Textarea
              id="description"
              placeholder="Ex: Téléphone Samsung noir, montre dorée..."
              value={objectDescription}
              onChange={(e) => setObjectDescription(e.target.value)}
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
                    {cat.label}
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
                    {loc.label}
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

          {/* Guest Selection (when multiple guests) */}
          {locationType === "room" && hasMultipleGuests && (
            <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Sélectionner le client concerné
              </h4>
              <RadioGroup value={selectedGuest} onValueChange={setSelectedGuest} className="space-y-2">
                {/* Departure guest option */}
                <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 cursor-pointer">
                  <RadioGroupItem value="departure" id="guest-departure" />
                  <Label htmlFor="guest-departure" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Départ</span>
                        <span className="text-muted-foreground">
                          {guestDeparture?.firstName} {guestDeparture?.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(guestDeparture?.checkOut)}
                      </div>
                    </div>
                  </Label>
                </div>
                
                {/* Arrival guest option */}
                <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 cursor-pointer">
                  <RadioGroupItem value="arrival" id="guest-arrival" />
                  <Label htmlFor="guest-arrival" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Arrivée</span>
                        <span className="text-muted-foreground">
                          {guestArrival?.firstName} {guestArrival?.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(guestArrival?.checkIn)}
                      </div>
                    </div>
                  </Label>
                </div>

                {/* Manual entry option */}
                <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 cursor-pointer">
                  <RadioGroupItem value="manual" id="guest-manual" />
                  <Label htmlFor="guest-manual" className="flex-1 cursor-pointer">
                    <span className="font-medium">Saisir manuellement</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Guest Info (if room) - Pre-filled or manual */}
          {locationType === "room" && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Informations client {hasSingleGuest && "(pré-remplies)"}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guestFirstName">Prénom</Label>
                  <Input
                    id="guestFirstName"
                    value={guestFirstName}
                    onChange={(e) => setGuestFirstName(e.target.value)}
                    readOnly={hasMultipleGuests && selectedGuest !== 'manual'}
                    className={hasMultipleGuests && selectedGuest !== 'manual' ? 'bg-muted' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestName">Nom</Label>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    readOnly={hasMultipleGuests && selectedGuest !== 'manual'}
                    className={hasMultipleGuests && selectedGuest !== 'manual' ? 'bg-muted' : ''}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkIn">Arrivée</Label>
                  <Input
                    id="checkIn"
                    type="date"
                    value={guestCheckIn}
                    onChange={(e) => setGuestCheckIn(e.target.value)}
                    readOnly={hasMultipleGuests && selectedGuest !== 'manual'}
                    className={hasMultipleGuests && selectedGuest !== 'manual' ? 'bg-muted' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOut">Départ</Label>
                  <Input
                    id="checkOut"
                    type="date"
                    value={guestCheckOut}
                    onChange={(e) => setGuestCheckOut(e.target.value)}
                    readOnly={hasMultipleGuests && selectedGuest !== 'manual'}
                    className={hasMultipleGuests && selectedGuest !== 'manual' ? 'bg-muted' : ''}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Photo de l'objet</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={uploading}
                  asChild
                >
                  <span>
                    {uploading ? (
                      "Téléchargement..."
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        {imageUrl ? "Changer la photo" : "Ajouter une photo"}
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Objet trouvé"
                className="w-full h-32 object-cover rounded-lg mt-2"
              />
            )}
          </div>

          {/* Submit */}
          <Button
            onClick={() => createItemMutation.mutate()}
            disabled={!objectDescription || !locationType || createItemMutation.isPending}
            className="w-full"
          >
            {createItemMutation.isPending ? "Enregistrement..." : "Signaler l'objet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
