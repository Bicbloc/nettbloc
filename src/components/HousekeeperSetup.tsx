import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserIcon, Plus, Key, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';

interface Housekeeper {
  id: string;
  hotel_id: string | null;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const HousekeeperSetup = () => {
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');

  useEffect(() => {
    // Charger l'hôtel sélectionné
    const savedHotelId = localStorage.getItem('selectedHotelId');
    if (savedHotelId) {
      setSelectedHotelId(savedHotelId);
      loadHousekeepers(savedHotelId);
    }
  }, []);

  const loadHousekeepers = async (hotelId: string) => {
    const housekeepersData = await SupabaseService.getHousekeepers(hotelId);
    setHousekeepers(housekeepersData as Housekeeper[]);
  };

  const handleCreateHousekeeper = async () => {
    if (!newHousekeeperName.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir un nom"
      });
      return;
    }

    if (!selectedHotelId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez d'abord sélectionner un hôtel dans l'onglet Configuration"
      });
      return;
    }

    setIsLoading(true);
    const housekeeper = await SupabaseService.createHousekeeper(selectedHotelId, newHousekeeperName);
    
    if (housekeeper) {
      toast({
        title: "Femme de chambre créée",
        description: `"${newHousekeeperName}" a été créée avec le code d'accès ${housekeeper.access_code}`
      });
      setNewHousekeeperName('');
      await loadHousekeepers(selectedHotelId);
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la femme de chambre"
      });
    }
    setIsLoading(false);
  };

  const handleDeactivateHousekeeper = async (id: string, name: string) => {
    const success = await SupabaseService.deactivateHousekeeper(id);
    
    if (success) {
      toast({
        title: "Femme de chambre désactivée",
        description: `"${name}" a été désactivée`
      });
      await loadHousekeepers(selectedHotelId);
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de désactiver la femme de chambre"
      });
    }
  };

  if (!selectedHotelId) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <UserIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Hôtel requis</h3>
          <p className="text-muted-foreground">
            Veuillez d'abord sélectionner un hôtel dans l'onglet "Configuration Hôtel"
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Gestion des Femmes de Chambre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="housekeeper-name">Nom de la femme de chambre</Label>
            <Input
              id="housekeeper-name"
              placeholder="Ex: Marie Dupont"
              value={newHousekeeperName}
              onChange={(e) => setNewHousekeeperName(e.target.value)}
            />
          </div>
          
          <Button 
            onClick={handleCreateHousekeeper}
            disabled={isLoading}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isLoading ? 'Création en cours...' : 'Ajouter une femme de chambre'}
          </Button>
        </CardContent>
      </Card>

      {housekeepers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Femmes de chambre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {housekeepers.map((housekeeper) => (
                <div 
                  key={housekeeper.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{housekeeper.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        Code d'accès: {housekeeper.access_code}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={housekeeper.is_active ? "secondary" : "outline"}>
                      {housekeeper.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {housekeeper.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeactivateHousekeeper(housekeeper.id, housekeeper.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {housekeepers.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <UserIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune femme de chambre</h3>
            <p className="text-muted-foreground">
              Ajoutez des femmes de chambre pour commencer la distribution des chambres
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};