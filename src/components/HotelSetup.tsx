import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building, Mail, Plus, Check, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';
import { generateHotelId, isValidUUID } from '@/lib/utils';
import { TestNotificationButton } from '@/components/TestNotificationButton';
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

export const HotelSetup = () => {
  const { user } = useAuth();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelAddress, setNewHotelAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');

  useEffect(() => {
    loadHotels();
    // Charger l'hôtel sélectionné depuis localStorage
    const savedHotelId = localStorage.getItem('selectedHotelId');
    if (savedHotelId) {
      setSelectedHotelId(savedHotelId);
    }
  }, []);

  const loadHotels = async () => {
    const hotelsData = await SupabaseService.getHotels();
    setHotels(hotelsData as Hotel[]);
  };

  const handleCreateHotel = async () => {
    if (!newHotelName.trim() || !newHotelAddress.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir le nom et l'adresse de l'hôtel"
      });
      return;
    }

    if (!user?.email) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Vous devez être connecté pour créer un hôtel"
      });
      return;
    }

    setIsLoading(true);
    const hotel = await SupabaseService.createSimpleHotel(newHotelName, newHotelAddress, user.email);
    
    if (hotel) {
      toast({
        title: "Établissement créé",
        description: `L'établissement "${newHotelName}" a été créé avec le code ${hotel.hotel_code}`
      });
      setNewHotelName('');
      setNewHotelAddress('');
      await loadHotels();
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer l'établissement"
      });
    }
    setIsLoading(false);
  };

  const handleSelectHotel = (hotel: Hotel) => {
    // Utiliser l'ID réel de l'hôtel depuis la base de données
    setSelectedHotelId(hotel.id);
    localStorage.setItem('selectedHotelId', hotel.id);
    localStorage.setItem('selectedHotelCode', hotel.hotel_code);
    localStorage.setItem('selectedHotelName', hotel.name);
    
    console.log('✅ Hôtel sélectionné avec ID réel:', {
      name: hotel.name,
      code: hotel.hotel_code,
      realId: hotel.id
    });
    
    toast({
      title: "Établissement sélectionné",
      description: `${hotel.name} (${hotel.hotel_code})`
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Créer votre établissement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hotel-name">Nom de l'établissement</Label>
              <Input
                id="hotel-name"
                placeholder="Ex: Hôtel Bellevue"
                value={newHotelName}
                onChange={(e) => setNewHotelName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotel-address">Adresse de l'établissement</Label>
              <Input
                id="hotel-address"
                placeholder="Ex: 123 Rue de la Paix, 75001 Paris"
                value={newHotelAddress}
                onChange={(e) => setNewHotelAddress(e.target.value)}
              />
            </div>
          </div>
          
          {user?.email && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <span className="font-medium">Email de contact :</span> {user.email}
            </div>
          )}
          
          <Button 
            onClick={handleCreateHotel}
            disabled={isLoading}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isLoading ? 'Création en cours...' : 'Créer l\'établissement'}
          </Button>
        </CardContent>
      </Card>

      {hotels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vos établissements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hotels.map((hotel) => (
                <div 
                  key={hotel.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{hotel.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                        <Mail className="h-3 w-3" />
                        {hotel.email}
                      </div>
                      {hotel.address && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {hotel.address}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        Code: {hotel.hotel_code}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {selectedHotelId === hotel.id && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Sélectionné
                      </Badge>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant={selectedHotelId === hotel.id ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => handleSelectHotel(hotel)}
                      >
                        {selectedHotelId === hotel.id ? 'Actuel' : 'Sélectionner'}
                      </Button>
                      {selectedHotelId === hotel.id && (
                        <TestNotificationButton hotelId={hotel.id} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hotels.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun établissement configuré</h3>
            <p className="text-muted-foreground">
              Créez votre premier établissement pour commencer à utiliser le système
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};