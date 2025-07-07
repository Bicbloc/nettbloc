import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { createHotel } from '@/services/supabaseService';

interface HotelSetupProps {
  onHotelCreated: (hotelId: string) => void;
}

export const HotelSetup = ({ onHotelCreated }: HotelSetupProps) => {
  const [hotelName, setHotelName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hotelName.trim() || !email.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await createHotel(hotelName.trim(), email.trim());
      
      if (error) {
        throw error;
      }
      
      if (data) {
        toast({
          title: 'Hôtel créé',
          description: 'L\'hôtel a été enregistré avec succès'
        });
        onHotelCreated(data.id);
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la création de l\'hôtel',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Configuration de l'Hôtel</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hotelName">Nom de l'hôtel</Label>
            <Input
              id="hotelName"
              type="text"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="Entrez le nom de l'hôtel"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@hotel.com"
              required
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-gradient-primary" 
            disabled={isLoading}
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer l\'hôtel'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};