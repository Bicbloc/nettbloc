import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building, Mail, ArrowLeft, UserCheck, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BackButton from '@/components/BackButton';
import { SupabaseService } from "@/services/supabaseService";

export default function GuestMode() {
  const [email, setEmail] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !hotelName.trim()) {
      toast({
        variant: "destructive",
        title: "Informations requises",
        description: "Veuillez remplir tous les champs."
      });
      return;
    }

    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        variant: "destructive",
        title: "Email invalide",
        description: "Veuillez saisir une adresse email valide."
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Créer un hôtel simple pour collecter les données
      const hotel = await SupabaseService.createSimpleHotel(hotelName, "", email);
      
      if (hotel) {
        // Sauvegarder les informations pour la session
        localStorage.setItem('guestMode', 'true');
        localStorage.setItem('selectedHotelId', hotel.id);
        localStorage.setItem('selectedHotelName', hotel.name);
        localStorage.setItem('selectedHotelCode', hotel.hotel_code || '');
        localStorage.setItem('guestEmail', email);
        
        toast({
          title: "Données enregistrées",
          description: "Vous pouvez maintenant utiliser l'interface de gestion.",
        });
        
        // Rediriger vers la page principale
        navigate('/');
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible d'enregistrer vos informations. Veuillez réessayer."
        });
      }
    } catch (error) {
      console.error("Erreur mode invité:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4">
        <BackButton to="/" />
      </div>
      
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600/10 p-3 rounded-full">
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">Mode Invité</CardTitle>
          <CardDescription>
            Testez notre solution sans inscription
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Mode démo :</strong> Vos données seront collectées uniquement à des fins de démonstration. 
              Pour accéder à l'interface mobile des femmes de chambre, une inscription complète sera nécessaire.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 font-medium">
                <Mail className="h-4 w-4" />
                Adresse email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votre.email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hotelName" className="flex items-center gap-2 font-medium">
                <Building className="h-4 w-4" />
                Nom de votre établissement
              </Label>
              <Input
                id="hotelName"
                type="text"
                placeholder="Hôtel des Voyageurs"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                className="h-12"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? "Enregistrement..." : "Commencer la démo"}
            </Button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Déjà utilisateur ?
            </p>
            <Button 
              variant="outline" 
              onClick={() => navigate("/auth")}
              className="w-full"
            >
              Se connecter
            </Button>
          </div>
          
          <div className="text-center">
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