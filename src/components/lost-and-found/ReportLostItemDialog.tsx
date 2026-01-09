import { useState } from "react";
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
import { Package, Camera, Upload } from "lucide-react";

interface ReportLostItemDialogProps {
  hotelId: string;
  reporterName: string;
  reporterType: "housekeeper" | "governess" | "staff" | "admin";
  roomNumber?: string;
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

  const { toast } = useToast();
  const queryClient = useQueryClient();

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

          {/* Guest Info (if room) */}
          {locationType === "room" && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm">Informations client (si connues)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guestFirstName">Prénom</Label>
                  <Input
                    id="guestFirstName"
                    value={guestFirstName}
                    onChange={(e) => setGuestFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestName">Nom</Label>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOut">Départ</Label>
                  <Input
                    id="checkOut"
                    type="date"
                    value={guestCheckOut}
                    onChange={(e) => setGuestCheckOut(e.target.value)}
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
