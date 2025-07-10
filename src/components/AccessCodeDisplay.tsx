import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Key, Copy, Eye, EyeOff, Users, Building, Loader2, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';

interface Housekeeper {
  id: string;
  hotel_id: string;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Hotel {
  id: string;
  name: string;
  hotel_code?: string;
}

export const AccessCodeDisplay = () => {
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCodes, setShowCodes] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');

  useEffect(() => {
    const savedHotelId = localStorage.getItem('selectedHotelId');
    if (savedHotelId) {
      setSelectedHotelId(savedHotelId);
      loadData(savedHotelId);
    }
  }, []);

  const loadData = async (hotelId: string) => {
    setIsLoading(true);
    try {
      // Charger l'hôtel
      const hotels = await SupabaseService.getHotels();
      const currentHotel = hotels.find(h => h.id === hotelId);
      
      if (currentHotel) {
        setHotel(currentHotel);
      }

      // Charger les femmes de chambre
      const housekeepersData = await SupabaseService.getHousekeepers(hotelId);
      setHousekeepers(housekeepersData.filter(h => h.is_active));
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les données"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copié !",
        description: `${label} copié dans le presse-papiers`
      });
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de copier dans le presse-papiers"
      });
    });
  };

  const copyAllCodes = () => {
    const codesText = housekeepers
      .map(h => `${h.name}: ${h.access_code}`)
      .join('\n');
    
    const fullText = `Codes d'accès - ${hotel?.name || 'Hôtel'} (${hotel?.hotel_code || 'N/A'})\n\n${codesText}`;
    
    copyToClipboard(fullText, "Tous les codes d'accès");
  };

  if (!selectedHotelId) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Hôtel requis</h3>
          <p className="text-muted-foreground">
            Veuillez d'abord configurer un hôtel
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des codes d'accès...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Codes d'Accès pour les Femmes de Chambre
        </CardTitle>
        {hotel && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            <span>{hotel.name}</span>
            <Badge variant="outline">{hotel.hotel_code}</Badge>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {housekeepers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune femme de chambre</h3>
            <p className="text-muted-foreground">
              Créez des femmes de chambre pour afficher leurs codes d'accès
            </p>
          </div>
        ) : (
          <>
            {/* En-tête avec instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Instructions pour les femmes de chambre :</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>Étape 1 :</strong> Saisir le code hôtel : <code className="bg-blue-100 px-2 py-1 rounded font-mono">{hotel?.hotel_code}</code></p>
                <p><strong>Étape 2 :</strong> Saisir leur code personnel à 4 chiffres</p>
              </div>
            </div>

            {/* Contrôles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCodes(!showCodes)}
                  className="flex items-center gap-2"
                >
                  {showCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showCodes ? 'Masquer' : 'Afficher'} les codes
                </Button>
                
                {showCodes && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAllCodes}
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copier tout
                  </Button>
                )}
              </div>
              
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {housekeepers.length} {housekeepers.length === 1 ? 'femme de chambre' : 'femmes de chambre'}
              </Badge>
            </div>

            {/* Liste des codes */}
            <div className="grid gap-3">
              {housekeepers.map((housekeeper) => (
                <div 
                  key={housekeeper.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{housekeeper.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Créé le {new Date(housekeeper.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-lg font-bold bg-white px-3 py-2 rounded border">
                      {showCodes ? housekeeper.access_code : '••••'}
                    </div>
                    
                    {showCodes && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(housekeeper.access_code, `Code de ${housekeeper.name}`)}
                        className="hover:bg-gray-200"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pied de page avec code hôtel */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                <div>
                  <p className="font-semibold text-green-900">Code Hôtel à communiquer :</p>
                  <p className="text-sm text-green-700">Les femmes de chambre doivent d'abord saisir ce code</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-xl font-bold bg-white px-4 py-2 rounded border text-green-800">
                    {hotel?.hotel_code}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(hotel?.hotel_code || '', "Code hôtel")}
                    className="hover:bg-green-100"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};