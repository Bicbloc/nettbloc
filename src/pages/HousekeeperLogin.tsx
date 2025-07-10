import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Smartphone, User, ArrowLeft } from "lucide-react";
import { useHousekeeping } from "@/contexts/HousekeepingContext";

export default function HousekeeperLogin() {
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { housekeepers, housekeeperNames, isDistributed } = useHousekeeping();

  // Vérifier si la distribution a été faite
  useEffect(() => {
    if (!isDistributed) {
      toast({
        variant: "destructive",
        title: "Distribution requise",
        description: "Les codes d'accès ne sont pas encore générés. Veuillez d'abord distribuer les chambres."
      });
    }
  }, [isDistributed]);

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

    if (!isDistributed) {
      toast({
        variant: "destructive",
        title: "Codes non générés",
        description: "Les codes d'accès ne sont pas encore générés. Retournez à l'interface principale pour distribuer les chambres."
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Authentifier avec la base de données
      const { SupabaseService } = await import('@/services/supabaseService');
      const authenticatedHousekeeper = await SupabaseService.authenticateHousekeeper(accessCode);

      if (authenticatedHousekeeper) {
        // Sauvegarder les infos de connexion
        localStorage.setItem('currentHousekeeper', authenticatedHousekeeper.name);
        localStorage.setItem('currentAccessCode', authenticatedHousekeeper.access_code);
        localStorage.setItem('currentHousekeeperId', authenticatedHousekeeper.id);
        
        toast({
          title: "Connexion réussie",
          description: `Bonjour ${authenticatedHousekeeper.name} !`
        });
        
        // Rediriger vers l'interface femme de chambre
        navigate(`/housekeeper?name=${encodeURIComponent(authenticatedHousekeeper.name)}&code=${authenticatedHousekeeper.access_code}`);
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
          {!isDistributed && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
              <p className="text-sm text-orange-700">
                Les codes d'accès ne sont pas encore générés. Retournez à l'interface principale pour distribuer les chambres.
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
                placeholder="Ex: HTL-1234"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="text-center text-lg font-mono h-12"
                autoFocus
                maxLength={8}
              />
              {isDistributed && housekeepers.length > 0 && (
                <div className="text-xs text-gray-500 text-center">
                  Codes disponibles: {housekeepers.map(h => h.access_code).join(', ')}
                </div>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
              disabled={isLoading || !isDistributed}
            >
              {isLoading ? "Connexion..." : "Se connecter"}
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