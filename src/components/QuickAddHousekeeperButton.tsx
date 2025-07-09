import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuickAddHousekeeperButtonProps {
  onAddHousekeeper: (name: string) => void;
  className?: string;
}

export function QuickAddHousekeeperButton({ onAddHousekeeper, className }: QuickAddHousekeeperButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const { toast } = useToast();

  const handleAdd = () => {
    if (!name.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un nom",
        variant: "destructive"
      });
      return;
    }

    onAddHousekeeper(name.trim());
    setName('');
    setIsOpen(false);
    
    toast({
      title: "Succès",
      description: `${name.trim()} a été ajouté(e)`,
    });
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
              <Button onClick={handleAdd} className="flex-1" disabled={!name.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}