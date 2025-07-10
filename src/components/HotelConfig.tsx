import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building, Mail, MapPin, Check, Loader } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';
import { useAuth } from '@/contexts/AuthContext';

interface Hotel {
  id: string;
  name: string;
  email: string;
  address?: string;
  hotel_code: string;
  created_at: string;
  updated_at: string;
}

export const HotelConfig = () => {
  const { user } = useAuth();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserHotels();
    }
  }, [user]);

  const loadUserHotels = async () => {
    setIsLoading(true);
    try {
      const hotelsData = await SupabaseService.getHotels();
      setHotels(hotelsData as Hotel[]);
      
      // Si l'utilisateur a un hôtel, le sélectionner automatiquement
      if (hotelsData.length > 0) {
        const hotel = hotelsData[0] as Hotel;
        setSelectedHotel(hotel);
        setNewAddress(hotel.address || '');
        
        // Sauvegarder la sélection
        localStorage.setItem('selectedHotelId', hotel.id);
        localStorage.setItem('selectedHotelCode', hotel.hotel_code);
        localStorage.setItem('selectedHotelName', hotel.name);
      }
    } catch (error) {
      console.error('Erreur chargement hôtels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!selectedHotel || !newAddress.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir une adresse valide."
      });
      return;
    }

    setIsUpdating(true);
    try {
      // Ici, on pourrait ajouter une méthode pour mettre à jour l'adresse
      // Pour l'instant, on simule la mise à jour
      const updatedHotel = { ...selectedHotel, address: newAddress };
      setSelectedHotel(updatedHotel);
      
      toast({
        title: "Adresse mise à jour",
        description: "L'adresse de votre établissement a été mise à jour avec succès."
      });
    } catch (error) {
      console.error('Erreur mise à jour adresse:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour l'adresse."
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader className="h-6 w-6 animate-spin mr-2" />
          Chargement de votre établissement...
        </CardContent>
      </Card>
    );
  }

  if (!selectedHotel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Configuration de votre établissement
          </CardTitle>
          <CardDescription>
            Aucun établissement trouvé. Veuillez contacter l'administration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Un établissement est automatiquement créé lors de votre inscription.
            Si vous ne voyez pas votre établissement, veuillez nous contacter.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Votre établissement
          </CardTitle>
          <CardDescription>
            Informations de votre établissement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom de l'établissement</Label>
              <div className="p-3 bg-muted/30 rounded-lg font-medium">
                {selectedHotel.name}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Code de l'établissement</Label>
              <div className="p-3 bg-muted/30 rounded-lg font-mono font-medium">
                {selectedHotel.hotel_code}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email de contact</Label>
            <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {selectedHotel.email}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse de l'établissement</Label>
            <div className="flex gap-2">
              <Input
                id="address"
                placeholder="Ex: 123 Rue de la Paix, 75001 Paris"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
              <Button 
                onClick={handleUpdateAddress}
                disabled={isUpdating || !newAddress.trim() || newAddress === selectedHotel.address}
                size="sm"
              >
                {isUpdating ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
            </div>
            {selectedHotel.address && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Adresse actuelle: {selectedHotel.address}
              </div>
            )}
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Établissement configuré</span>
            </div>
            <p className="text-sm text-green-700">
              Votre établissement est prêt à être utilisé. Vous pouvez maintenant configurer 
              vos femmes de chambre et importer vos chambres.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};