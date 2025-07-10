import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building, Mail, Plus, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';
import { generateHotelId, isValidUUID } from '@/lib/utils';
import { TestNotificationButton } from '@/components/TestNotificationButton';

interface Hotel {
  id: string;
  name: string;
  email: string;
  hotel_code: string;
  created_at: string;
  updated_at: string;
}

export const HotelSetup = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelEmail, setNewHotelEmail] = useState('');
  const [newHotelCode, setNewHotelCode] = useState('');
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
    if (!newHotelName.trim() || !newHotelEmail.trim() || !newHotelCode.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir tous les champs"
      });
      return;
    }

    setIsLoading(true);
    const hotel = await SupabaseService.createHotel(newHotelName, newHotelEmail, newHotelCode);
    
    if (hotel) {
      toast({
        title: "Hôtel créé",
        description: `L'hôtel "${newHotelName}" a été créé avec le code ${newHotelCode}`
      });
      setNewHotelName('');
      setNewHotelEmail('');
      setNewHotelCode('');
      await loadHotels();
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer l'hôtel (le code existe peut-être déjà)"
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
      title: "Hôtel sélectionné",
      description: `${hotel.name} (${hotel.hotel_code}) - ID: ${hotel.id.slice(0, 8)}...`
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Configuration Hôtel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hotel-name">Nom de l'hôtel</Label>
              <Input
                id="hotel-name"
                placeholder="Ex: Hôtel Bellevue"
                value={newHotelName}
                onChange={(e) => setNewHotelName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotel-code">Code établissement (pour l'accès mobile)</Label>
              <Input
                id="hotel-code"
                placeholder="Ex: HOTEL2024"
                value={newHotelCode}
                onChange={(e) => setNewHotelCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotel-email">Email de contact</Label>
              <Input
                id="hotel-email"
                type="email"
                placeholder="contact@hotel-bellevue.com"
                value={newHotelEmail}
                onChange={(e) => setNewHotelEmail(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleCreateHotel}
            disabled={isLoading}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isLoading ? 'Création en cours...' : 'Créer l\'hôtel'}
          </Button>
        </CardContent>
      </Card>

      {hotels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hôtels existants</CardTitle>
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
                    <div>
                      <div className="font-medium">{hotel.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {hotel.email}
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
            <h3 className="text-lg font-semibold mb-2">Aucun hôtel configuré</h3>
            <p className="text-muted-foreground">
              Créez votre premier hôtel pour commencer à utiliser le système
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};