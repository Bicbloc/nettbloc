import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HousekeeperSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onHousekeepersConfirmed: (housekeepers: string[]) => void;
  initialHousekeepers?: string[];
}

export function HousekeeperSetupDialog({
  isOpen,
  onClose,
  onHousekeepersConfirmed,
  initialHousekeepers = []
}: HousekeeperSetupDialogProps) {
  const [housekeepers, setHousekeepers] = useState<string[]>(initialHousekeepers);
  const [newHousekeeper, setNewHousekeeper] = useState('');
  const { toast } = useToast();

  const addHousekeeper = () => {
    if (!newHousekeeper.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un nom",
        variant: "destructive"
      });
      return;
    }

    if (housekeepers.includes(newHousekeeper.trim())) {
      toast({
        title: "Erreur",
        description: "Cette femme de chambre existe déjà",
        variant: "destructive"
      });
      return;
    }

    setHousekeepers([...housekeepers, newHousekeeper.trim()]);
    setNewHousekeeper('');
  };

  const removeHousekeeper = (index: number) => {
    setHousekeepers(housekeepers.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (housekeepers.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez ajouter au moins une femme de chambre",
        variant: "destructive"
      });
      return;
    }

    onHousekeepersConfirmed(housekeepers);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addHousekeeper();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Configuration des femmes de chambre
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="housekeeper-name">Nom de la femme de chambre</Label>
            <div className="flex gap-2">
              <Input
                id="housekeeper-name"
                placeholder="Nom et prénom"
                value={newHousekeeper}
                onChange={(e) => setNewHousekeeper(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button onClick={addHousekeeper} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {housekeepers.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Femmes de chambre ({housekeepers.length})
                  </div>
                  <div className="space-y-2">
                    {housekeepers.map((housekeeper, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-md border"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{index + 1}</Badge>
                          <span className="font-medium">{housekeeper}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeHousekeeper(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button 
              onClick={handleConfirm} 
              className="flex-1"
              disabled={housekeepers.length === 0}
            >
              Confirmer ({housekeepers.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}