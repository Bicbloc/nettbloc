import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { SupabaseService } from "@/services/supabaseService";
import { Smartphone, User } from "lucide-react";

export default function HousekeeperLogin() {
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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

    setIsLoading(true);
    try {
      const housekeeper = await SupabaseService.authenticateHousekeeper(accessCode);
      
      if (housekeeper) {
        // Sauvegarder les infos de connexion
        localStorage.setItem('housekeeperData', JSON.stringify(housekeeper));
        
        toast({
          title: "Connexion réussie",
          description: `Bonjour ${housekeeper.name} !`
        });
        
        // Rediriger vers l'interface femme de chambre
        navigate(`/housekeeper/${housekeeper.id}`);
      } else {
        toast({
          variant: "destructive",
          title: "Code d'accès invalide",
          description: "Le code d'accès que vous avez saisi n'est pas valide."
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">NettoBloc</CardTitle>
          <CardDescription>
            Interface Femme de Chambre
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessCode" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Code d'accès
              </Label>
              <Input
                id="accessCode"
                type="text"
                placeholder="Entrez votre code d'accès"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="text-center text-lg font-mono"
                autoFocus
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
            >
              Retour à l'accueil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}