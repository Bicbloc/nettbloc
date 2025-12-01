import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, User, ArrowLeft, Loader2, Building, KeyRound } from "lucide-react";
import { SupabaseService } from "@/services/supabaseService";
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';
import BackButton from '@/components/BackButton';
import { HotelStorageService } from '@/services/hotelStorageService';

export default function HousekeeperLogin() {
  const [step, setStep] = useState<"direct" | "hotel" | "housekeeper">("direct");
  const [hotelCode, setHotelCode] = useState("");
  const [housekeeperCode, setHousekeeperCode] = useState("");
  const [fullAccessCode, setFullAccessCode] = useState("");
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
      console.log('🏨 Recherche hôtel avec code:', hotelCode);
      
      const result = await HousekeeperAuthService.findHotelByCode(hotelCode);
      
      if (!result.success) {
        console.error('❌ Hôtel non trouvé:', result.error);
        toast({
          variant: "destructive",
          title: "Hôtel non trouvé",
          description: result.error || `Aucun hôtel trouvé avec le code "${hotelCode}"`
        });
        return;
      }

      console.log('✅ Hôtel trouvé:', result.hotel);
      setSelectedHotel(result.hotel);
      setStep("housekeeper");
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
      console.log('🔐 Tentative connexion avec code:', housekeeperCode, 'pour hôtel:', selectedHotel.hotel_code);
      
      // Utiliser le service d'authentification unifié
      const result = await HousekeeperAuthService.authenticateWithFullCode(housekeeperCode);
      
      if (!result.success) {
        console.error('❌ Échec authentification:', result.error);
        toast({
          variant: "destructive",
          title: "Code d'accès invalide",
          description: result.error || "Le code d'accès saisi n'existe pas ou a expiré"
        });
        
        // Afficher des informations de debug pour aider
        if (result.debugInfo?.availableHousekeepers?.length > 0) {
          console.log('🔍 Codes disponibles pour cet hôtel:', result.debugInfo.availableHousekeepers.map((h: any) => h.access_code).filter(Boolean));
        }
        return;
      }

      const { user: housekeeper, hotel } = result;

      // Vérifier que l'hôtel correspond
      if (hotel.id !== selectedHotel.id) {
        toast({
          variant: "destructive",
          title: "Hôtel incorrect",
          description: `Ce code d'accès appartient à ${hotel.name}, pas à ${selectedHotel.name}`
        });
        return;
      }

      console.log('✅ Connexion réussie:', housekeeper.name, 'pour l\'hôtel:', hotel.name);

      // Sauvegarder les données utilisateur dans localStorage
      localStorage.setItem('housekeeper', JSON.stringify({
        id: housekeeper.id,
        name: housekeeper.name,
        accessCode: housekeeperCode
      }));
      
      // Sauvegarder l'hôtel sélectionné avec le service centralisé
      HotelStorageService.save({
        id: selectedHotel.id,
        name: selectedHotel.name,
        code: selectedHotel.hotel_code || ''
      });
      
      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${housekeeper.name} !`
      });

      navigate('/housekeeper/work');
      
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

  // Nouvelle fonction pour l'authentification directe avec code complet
  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullAccessCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code d'accès requis",
        description: "Veuillez saisir votre code d'accès complet."
      });
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔐 Tentative connexion directe avec code:', fullAccessCode);
      
      const result = await HousekeeperAuthService.authenticateWithFullCode(fullAccessCode);
      
      if (!result.success) {
        console.error('❌ Échec authentification:', result.error);
        toast({
          variant: "destructive",
          title: "Code d'accès invalide",
          description: result.error || "Le code d'accès saisi n'existe pas ou a expiré"
        });
        return;
      }

      const { user: housekeeper, hotel } = result;

      console.log('✅ Authentification réussie:', { hotel, housekeeper });

      // Store user and hotel data
      localStorage.setItem('housekeeper', JSON.stringify({
        id: housekeeper.id,
        name: housekeeper.name,
        accessCode: fullAccessCode
      }));
      
      // Sauvegarder l'hôtel avec le service centralisé
      HotelStorageService.save({
        id: hotel.id,
        name: hotel.name,
        code: hotel.hotel_code || ''
      });

      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${housekeeper.name} !`
      });

      navigate('/housekeeper/work');

    } catch (error) {
      console.error('💥 Erreur connexion directe:', error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Une erreur est survenue lors de la connexion"
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex flex-col items-center justify-center p-4 relative">
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
          {step === "direct" ? (
            <>
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-emerald-800">Connexion rapide</h3>
                </div>
                <p className="text-sm text-emerald-700">
                  Saisissez votre code d'accès complet pour vous connecter directement
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  Formats acceptés: HTL002-1234 ou HTL002-MARIE-1234
                </p>
              </div>
              
              <form onSubmit={handleDirectLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullAccessCode" className="flex items-center gap-2 font-medium">
                    <KeyRound className="h-4 w-4" />
                    Code d'accès complet
                  </Label>
                  <Input
                    id="fullAccessCode"
                    type="text"
                    placeholder="HTL002-MARIE-1234"
                    value={fullAccessCode}
                    onChange={(e) => setFullAccessCode(e.target.value.toUpperCase())}
                    className="text-center text-lg font-mono h-12"
                    autoFocus
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-700"
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

                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-3">ou connectez-vous en deux étapes</p>
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("hotel")}
                    className="flex items-center gap-2"
                  >
                    <Building className="h-4 w-4" />
                    Mode classique
                  </Button>
                </div>
              </form>
            </>
          ) : step === "hotel" ? (
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
                    placeholder="Ex: HTL002"
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

                <Button 
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("direct")}
                  className="w-full flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion rapide
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
                  Saisissez votre code d'accès (court ou complet)
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Formats acceptés: {selectedHotel?.hotel_code}-1234 ou {selectedHotel?.hotel_code}-VOTRENOM-1234
                </p>
              </div>
              
              <form onSubmit={handleHousekeeperSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="housekeeperCode" className="flex items-center gap-2 font-medium">
                    <User className="h-4 w-4" />
                    Code d'accès complet
                  </Label>
                  <Input
                    id="housekeeperCode"
                    type="text"
                    placeholder={`${selectedHotel?.hotel_code || 'HTL002'}-MARIE-1234`}
                    value={housekeeperCode}
                    onChange={(e) => setHousekeeperCode(e.target.value.toUpperCase())}
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
          
          <div className="mt-6 text-center space-y-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à l'accueil
            </Button>
            <div className="pt-3 border-t">
              <p className="text-xs text-gray-500 mb-2">Vous êtes gérant d'établissement ?</p>
              <Button 
                variant="link" 
                size="sm"
                onClick={() => navigate("/auth/establishment")}
                className="text-blue-600"
              >
                <Building className="h-4 w-4 mr-1" />
                Espace Établissement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}