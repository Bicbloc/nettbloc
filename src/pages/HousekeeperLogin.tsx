import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, User, ArrowLeft, Users, Loader2 } from "lucide-react";
import { SupabaseService } from "@/services/supabaseService";

export default function HousekeeperLogin() {
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
  const [allHousekeepers, setAllHousekeepers] = useState<Array<{id: string, name: string, access_code: string}>>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Charger toutes les femmes de chambre actives au chargement de la page
  useEffect(() => {
    const loadAllHousekeepers = async () => {
      setIsLoadingCodes(true);
      try {
        console.log('🔍 Chargement de toutes les femmes de chambre actives...');
        const dbHousekeepers = await SupabaseService.getHousekeepers(); // Sans filtrage par hotelId
        console.log('📊 Données brutes reçues:', dbHousekeepers.length, 'femmes de chambre');
        
        const activeHousekeepers = dbHousekeepers.filter(h => h.is_active);
        console.log('🔍 Filtrées actives:', activeHousekeepers.length);
        
        const mappedHousekeepers = activeHousekeepers.map(h => ({
          id: h.id,
          name: h.name,
          access_code: h.access_code
        }));
        
        console.log('🗂️ Codes mappés:', mappedHousekeepers.map(h => `${h.name}: ${h.access_code}`));
        setAllHousekeepers(mappedHousekeepers);
        
        console.log('✅ État mis à jour avec', mappedHousekeepers.length, 'femmes de chambre actives');
      } catch (error) {
        console.error('❌ Erreur chargement femmes de chambre:', error);
        toast({
          variant: "destructive",
          title: "Erreur de chargement",
          description: "Impossible de charger les codes d'accès."
        });
      } finally {
        setIsLoadingCodes(false);
      }
    };

    loadAllHousekeepers();
  }, [toast]);

  useEffect(() => {
    if (allHousekeepers.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune femme de chambre créée",
        description: "Aucune femme de chambre n'a été créée. Allez dans l'interface admin pour en créer."
      });
    }
  }, [allHousekeepers, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code d'accès requis",
        description: "Veuillez saisir votre code d'accès."
      });
      return;
    }

    if (allHousekeepers.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune femme de chambre créée",
        description: "Aucune femme de chambre n'a été créée. Allez dans l'interface admin pour en créer."
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Authentifier avec la base de données
      const authenticatedHousekeeper = await SupabaseService.authenticateHousekeeper(accessCode);

      if (authenticatedHousekeeper) {
        // Sauvegarder les données utilisateur dans localStorage
        localStorage.setItem('housekeeper', JSON.stringify({
          id: authenticatedHousekeeper.id,
          name: authenticatedHousekeeper.name,
          accessCode: authenticatedHousekeeper.access_code
        }));
        
        // Récupérer et sauvegarder l'hôtel associé automatiquement
        try {
          const hotels = await SupabaseService.getHotels();
          const housekeeperDetails = await SupabaseService.getHousekeepers();
          const currentHousekeeper = housekeeperDetails.find(h => h.id === authenticatedHousekeeper.id);
          
          if (currentHousekeeper) {
            const associatedHotel = hotels.find(hotel => hotel.id === currentHousekeeper.hotel_id);
            
            if (associatedHotel) {
              localStorage.setItem('selectedHotelId', associatedHotel.id);
              localStorage.setItem('selectedHotelName', associatedHotel.name);
              localStorage.setItem('selectedHotelCode', associatedHotel.hotel_code || '');
              console.log('✅ Hôtel associé automatiquement:', associatedHotel.name);
            }
          }
        } catch (error) {
          console.error('⚠️ Erreur récupération hôtel associé:', error);
        }
        
        console.log('✅ Connexion femme de chambre réussie:', authenticatedHousekeeper.name);
        navigate('/housekeeper');
      } else {
        toast({
          variant: "destructive",
          title: "Code d'accès invalide",
          description: "Le code d'accès que vous avez saisi n'est pas reconnu."
        });
      }
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Une erreur est survenue lors de la connexion."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600/10 p-3 rounded-full">
              <Smartphone className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">NettoBloc Mobile</CardTitle>
          <CardDescription>
            Interface Femme de Chambre
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Section d'affichage des codes d'accès */}
          {isLoadingCodes ? (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-blue-700">Chargement des codes d'accès...</p>
            </div>
          ) : allHousekeepers.length > 0 ? (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">Codes d'accès disponibles</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {allHousekeepers.map((housekeeper) => (
                  <div key={housekeeper.id} className="flex justify-between items-center p-2 bg-white rounded border">
                    <span className="text-sm font-medium text-gray-700">{housekeeper.name}</span>
                    <span className="text-lg font-mono font-bold text-green-600 bg-green-100 px-3 py-1 rounded">
                      {housekeeper.access_code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">
              <p className="text-sm text-orange-700">
                Aucune femme de chambre créée. Allez dans l'interface admin pour créer des femmes de chambre.
              </p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessCode" className="flex items-center gap-2 font-medium">
                <User className="h-4 w-4" />
                Code d'accès
              </Label>
              <Input
                id="accessCode"
                type="text"
                placeholder="Ex: 1234"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="text-center text-lg font-mono h-12"
                autoFocus
                maxLength={4}
                disabled={isLoadingCodes}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
              disabled={isLoading || allHousekeepers.length === 0 || isLoadingCodes}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à l'accueil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}