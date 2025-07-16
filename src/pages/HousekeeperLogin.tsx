import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, User, ArrowLeft, Loader2, Building, KeyRound, AlertCircle } from "lucide-react";
import { SupabaseService } from "@/services/supabaseService";
import BackButton from '@/components/BackButton';

export default function HousekeeperLogin() {
  const [step, setStep] = useState<"hotel" | "housekeeper">("hotel");
  const [hotelCode, setHotelCode] = useState("");
  const [housekeeperCode, setHousekeeperCode] = useState("");
  const [selectedHotel, setSelectedHotel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleHotelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hotelCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code hôtel requis",
        description: "Veuillez saisir le code de votre hôtel."
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const hotel = await SupabaseService.getHotelByCode(hotelCode);
      
      if (hotel) {
        setSelectedHotel(hotel);
        setStep("housekeeper");
        console.log('✅ Hôtel trouvé:', hotel.name);
      } else {
        toast({
          variant: "destructive",
          title: "Hôtel introuvable",
          description: "Le code hôtel que vous avez saisi n'existe pas."
        });
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de l'hôtel:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de la vérification de l'hôtel."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHousekeeperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!housekeeperCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code d'accès requis",
        description: "Veuillez saisir votre code d'accès."
      });
      return;
    }

    if (!selectedHotel) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Aucun hôtel sélectionné."
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Authentifier avec la base de données en vérifiant que le code appartient à cet hôtel
      const authenticatedHousekeeper = await SupabaseService.authenticateHousekeeper(housekeeperCode);

      if (authenticatedHousekeeper && authenticatedHousekeeper.hotel_id === selectedHotel.id) {
        // Sauvegarder les données utilisateur dans localStorage
        localStorage.setItem('housekeeper', JSON.stringify({
          id: authenticatedHousekeeper.id,
          name: authenticatedHousekeeper.name,
          accessCode: authenticatedHousekeeper.access_code
        }));
        
        // Sauvegarder l'hôtel sélectionné
        localStorage.setItem('selectedHotelId', selectedHotel.id);
        localStorage.setItem('selectedHotelName', selectedHotel.name);
        localStorage.setItem('selectedHotelCode', selectedHotel.hotel_code || '');
        
        console.log('✅ Connexion femme de chambre réussie:', authenticatedHousekeeper.name, 'pour l\'hôtel:', selectedHotel.name);
        navigate('/housekeeper');
      } else {
        toast({
          variant: "destructive",
          title: "Code d'accès invalide",
          description: "Le code d'accès ne correspond pas à cet hôtel ou n'est pas reconnu."
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

  const handleBackToHotel = () => {
    setStep("hotel");
    setHousekeeperCode("");
    setSelectedHotel(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4">
        <BackButton to="/" />
      </div>
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
          {step === "hotel" ? (
            <>
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Étape 1: Identification de l'hôtel</h3>
                </div>
                <p className="text-sm text-blue-700">
                  Saisissez le code de votre hôtel (fourni par votre superviseur)
                </p>
              </div>
              
              <form onSubmit={handleHotelSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hotelCode" className="flex items-center gap-2 font-medium">
                    <Building className="h-4 w-4" />
                    Code Hôtel
                  </Label>
                  <Input
                    id="hotelCode"
                    type="text"
                    placeholder="Ex: HTL-1234"
                    value={hotelCode}
                    onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
                    className="text-center text-lg font-mono h-12"
                    autoFocus
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Vérification...
                    </>
                  ) : (
                    "Continuer"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">Hôtel sélectionné</h3>
                </div>
                <p className="text-sm text-green-700">
                  {selectedHotel?.name} ({selectedHotel?.hotel_code})
                </p>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Étape 2: Votre code d'accès</h3>
                </div>
                <p className="text-sm text-blue-700">
                  Saisissez votre code d'accès personnel (4 chiffres)
                </p>
              </div>
              
              <form onSubmit={handleHousekeeperSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="housekeeperCode" className="flex items-center gap-2 font-medium">
                    <User className="h-4 w-4" />
                    Code d'accès personnel
                  </Label>
                  <Input
                    id="housekeeperCode"
                    type="text"
                    placeholder="Ex: 1234"
                    value={housekeeperCode}
                    onChange={(e) => setHousekeeperCode(e.target.value)}
                    className="text-center text-lg font-mono h-12"
                    autoFocus
                    maxLength={4}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading}
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

                <Button 
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToHotel}
                  className="w-full flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Changer d'hôtel
                </Button>
              </form>
            </>
          )}
          
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-800">Accès restreint</h3>
            </div>
            <p className="text-sm text-amber-700 mb-3">
              Cette interface est réservée aux femmes de chambre avec un compte valide. 
              Pour tester en mode invité, utilisez l'interface de gestion principale.
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/?mode=guest")}
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Essayer en mode invité
            </Button>
          </div>
          
          <div className="mt-4 text-center">
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