import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2 } from 'lucide-react';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';

export const TechnicianAccessRequest = () => {
  const [hotelCode, setHotelCode] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const { requestHotelAccess, profile } = useTechnicianAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hotelCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code requis",
        description: "Veuillez entrer le code de l'établissement"
      });
      return;
    }

    setIsRequesting(true);

    try {
      const { success, error } = await requestHotelAccess(hotelCode);

      if (!success) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error requesting access:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Impossible de demander l'accès"
      });
    } finally {
      setIsRequesting(false);
    }
  };

  if (!profile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Demander l'accès à un établissement
        </CardTitle>
        <CardDescription>
          Entrez le code de l'établissement pour demander l'accès
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Button
            type="submit"
            disabled={isRequesting}
            className="w-full h-11"
          >
            {isRequesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Envoi en cours...
              </>
            ) : (
              'Demander l\'accès'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
