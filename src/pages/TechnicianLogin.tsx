import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Loader2 } from 'lucide-react';

export default function TechnicianLogin() {
  const [hotelCode, setHotelCode] = useState('');
  const [technicianCode, setTechnicianCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!hotelCode.trim() || !technicianCode.trim()) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir tous les champs"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Vérifier l'hôtel
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('hotel_code', hotelCode.trim().toUpperCase())
        .single();

      if (hotelError || !hotel) {
        throw new Error("Code d'hôtel invalide");
      }

      // Vérifier le technicien
      const { data: technician, error: techError } = await supabase
        .from('housekeepers')
        .select(`
          *,
          staff_roles(name)
        `)
        .eq('hotel_id', hotel.id)
        .eq('access_code', technicianCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (techError || !technician) {
        throw new Error("Code technicien invalide");
      }

      // Vérifier que c'est bien un technicien
      const roleName = (technician.staff_roles as any)?.name?.toLowerCase();
      if (!roleName || !['technicien', 'technician'].includes(roleName)) {
        throw new Error("Ce code n'est pas un code technicien");
      }

      // Stocker les informations
      localStorage.setItem('technicianSession', JSON.stringify({
        hotelId: hotel.id,
        hotelName: hotel.name,
        technicianId: technician.id,
        technicianName: technician.name,
        roleId: technician.role_id
      }));

      toast({
        title: "Connexion réussie ! ✅",
        description: `Bienvenue ${technician.name}`
      });

      navigate('/technician/dashboard');

    } catch (error: any) {
      console.error('Erreur connexion technicien:', error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message || "Codes invalides"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-4 rounded-full">
              <Wrench className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Espace Technicien</CardTitle>
          <CardDescription>
            Connectez-vous pour gérer les incidents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hotelCode">Code de l'établissement</Label>
            <Input
              id="hotelCode"
              placeholder="Ex: HTL123"
              value={hotelCode}
              onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="techCode">Code technicien</Label>
            <Input
              id="techCode"
              placeholder="Votre code d'accès"
              value={technicianCode}
              onChange={(e) => setTechnicianCode(e.target.value.toUpperCase())}
              className="h-11"
            />
          </div>
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full h-11"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Connexion...
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                Se connecter
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
