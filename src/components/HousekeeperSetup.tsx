import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { createHousekeeper, getHousekeepers, type Housekeeper } from '@/services/supabaseService';
import { Copy, Plus, User } from 'lucide-react';

interface HousekeeperSetupProps {
  hotelId: string;
}

export const HousekeeperSetup = ({ hotelId }: HousekeeperSetupProps) => {
  const [housekeeperName, setHousekeeperName] = useState('');
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);

  useEffect(() => {
    loadHousekeepers();
  }, [hotelId]);

  const loadHousekeepers = async () => {
    try {
      const { data, error } = await getHousekeepers(hotelId);
      if (error) throw error;
      setHousekeepers(data || []);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors du chargement des femmes de chambre',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!housekeeperName.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez entrer un nom',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await createHousekeeper(housekeeperName.trim(), hotelId);
      
      if (error) {
        throw error;
      }
      
      if (data) {
        toast({
          title: 'Femme de chambre ajoutée',
          description: `Code d'accès: ${data.access_code}`,
        });
        setHousekeeperName('');
        loadHousekeepers();
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de l\'ajout',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Code copié',
      description: 'Le code d\'accès a été copié dans le presse-papiers'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Ajouter une Femme de Chambre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="housekeeperName">Nom de la femme de chambre</Label>
              <Input
                id="housekeeperName"
                type="text"
                value={housekeeperName}
                onChange={(e) => setHousekeeperName(e.target.value)}
                placeholder="Entrez le nom"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-primary" 
              disabled={isLoading}
            >
              {isLoading ? 'Ajout...' : 'Ajouter et générer le code'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Femmes de Chambre ({housekeepers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingList ? (
            <p className="text-center text-muted-foreground">Chargement...</p>
          ) : housekeepers.length === 0 ? (
            <p className="text-center text-muted-foreground">Aucune femme de chambre ajoutée</p>
          ) : (
            <div className="space-y-3">
              {housekeepers.map((housekeeper) => (
                <div 
                  key={housekeeper.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{housekeeper.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono">
                        {housekeeper.access_code}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyAccessCode(housekeeper.access_code)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Badge variant={housekeeper.is_active ? "default" : "secondary"}>
                    {housekeeper.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};