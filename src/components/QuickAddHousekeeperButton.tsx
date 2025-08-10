import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';
import { useHousekeeping } from '@/contexts/HousekeepingContext';

interface QuickAddHousekeeperButtonProps {
  onAddHousekeeper?: (name: string) => void;
  className?: string;
}

export function QuickAddHousekeeperButton({ onAddHousekeeper, className }: QuickAddHousekeeperButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { setHousekeeperNames, refreshHousekeepers } = useHousekeeping();

  const handleAdd = async () => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un nom",
        variant: "destructive"
      });
      return;
    }

    // Validation simplifiée : au moins 2 caractères et pas de noms génériques
    if (trimmedName.length < 2) {
      toast({
        title: "Erreur",
        description: "Le nom doit contenir au moins 2 caractères",
        variant: "destructive"
      });
      return;
    }

    // Empêcher les noms génériques
    const genericNames = ['femme de chambre', 'housekeeper', 'test', 'admin'];
    if (genericNames.some(generic => trimmedName.toLowerCase().includes(generic))) {
      toast({
        title: "Erreur",
        description: "Veuillez utiliser un prénom ou nom propre",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Récupérer l'ID de l'hôtel sélectionné
      const selectedHotelId = localStorage.getItem('selectedHotelId');
      
      if (!selectedHotelId) {
        toast({
          title: "Erreur",
          description: "Aucun hôtel sélectionné",
          variant: "destructive"
        });
        return;
      }

      // Créer la femme de chambre dans Supabase
      const housekeeper = await SupabaseService.createHousekeeper(selectedHotelId, trimmedName);
      
      if (housekeeper) {
        // Mettre à jour le contexte local
        setHousekeeperNames(prev => [...prev, trimmedName]);
        
        // Rafraîchir la liste depuis la base
        await refreshHousekeepers();
        
        // Appeler le callback si fourni
        if (onAddHousekeeper) {
          onAddHousekeeper(trimmedName);
        }
        
        toast({
          title: "Succès",
          description: `${trimmedName} a été créé(e) avec le code ${housekeeper.access_code}`,
        });
        
        setName('');
        setIsOpen(false);
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de créer la femme de chambre",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erreur création femme de chambre:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la création",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        className={className}
        variant="outline"
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Ajout rapide
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Ajouter une femme de chambre
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="housekeeper-name">Nom et prénom</Label>
              <Input
                id="housekeeper-name"
                placeholder="Ex: Marie Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={handleKeyPress}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleAdd} className="flex-1" disabled={!name.trim() || isLoading}>
                <Plus className="h-4 w-4 mr-2" />
                {isLoading ? 'Création...' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}