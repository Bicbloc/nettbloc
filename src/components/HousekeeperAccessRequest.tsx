import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHousekeeperAuth } from '@/contexts/HousekeeperAuthContext';
import { toast } from 'sonner';

export const HousekeeperAccessRequest = () => {
  const [hotelCode, setHotelCode] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const { requestHotelAccess, isAuthenticated } = useHousekeeperAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hotelCode.trim()) {
      toast.error('Veuillez saisir un code d\'hôtel');
      return;
    }

    setIsRequesting(true);
    
    try {
      const { success, error } = await requestHotelAccess(hotelCode.trim());
      
      if (success) {
        toast.success('Demande d\'accès envoyée avec succès ! L\'administrateur de l\'hôtel sera notifié.');
        setHotelCode('');
      } else {
        toast.error(error || 'Erreur lors de la demande d\'accès');
      }
    } catch (error) {
      console.error('Error requesting access:', error);
      toast.error('Erreur lors de la demande d\'accès');
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Demander l'accès à un hôtel</h2>
          <p className="text-sm text-muted-foreground">
            Saisissez le code de l'hôtel pour demander l'accès. L'administrateur recevra une notification.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="hotelCode">Code de l'hôtel</Label>
            <Input
              id="hotelCode"
              type="text"
              value={hotelCode}
              onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
              placeholder="Ex: HTL001"
              className="uppercase"
              disabled={isRequesting}
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={isRequesting || !hotelCode.trim()}
            className="w-full"
          >
            {isRequesting ? 'Envoi en cours...' : 'Demander l\'accès'}
          </Button>
        </form>
      </div>
    </Card>
  );
};