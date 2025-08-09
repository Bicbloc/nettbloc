import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Users, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HousekeeperInviteDialog } from './HousekeeperInviteDialog';

interface HousekeeperSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onHousekeepersConfirmed: (housekeepers: string[]) => void;
  initialHousekeepers?: string[];
  existingHousekeepers?: string[]; // Femmes de chambre déjà créées
  roomCount?: number; // Nombre de chambres pour calculer le nombre recommandé
  hotelId?: string; // Pour les invitations
}

export function HousekeeperSetupDialog({
  isOpen,
  onClose,
  onHousekeepersConfirmed,
  initialHousekeepers = [],
  existingHousekeepers = [],
  roomCount = 0,
  hotelId
}: HousekeeperSetupDialogProps) {
  // Calculer le nombre recommandé de femmes de chambre (approximativement 1 pour 10-12 chambres)
  const recommendedCount = Math.max(1, Math.ceil(roomCount / 10));
  
  // Générer des noms par défaut si aucun n'est fourni
  const getDefaultHousekeepers = () => {
    if (initialHousekeepers.length > 0) return initialHousekeepers;
    return Array.from({ length: recommendedCount }, (_, i) => `Femme de chambre ${i + 1}`);
  };

  const [housekeepers, setHousekeepers] = useState<string[]>(getDefaultHousekeepers());
  const [selectedExisting, setSelectedExisting] = useState<string[]>([]);
  const [newHousekeeper, setNewHousekeeper] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { toast } = useToast();

  // Réinitialiser les données quand le dialog s'ouvre
  useEffect(() => {
    if (isOpen) {
      // Si on a des femmes de chambre existantes, commencer par les proposer
      if (existingHousekeepers.length > 0 && initialHousekeepers.length === 0) {
        setSelectedExisting(existingHousekeepers);
        setHousekeepers([]);
      } else {
        const defaultHousekeepers = initialHousekeepers.length > 0 
          ? initialHousekeepers 
          : Array.from({ length: recommendedCount }, (_, i) => `Femme de chambre ${i + 1}`);
        
        setHousekeepers(defaultHousekeepers);
        setSelectedExisting([]);
      }
      setNewHousekeeper('');
    }
  }, [isOpen, roomCount, JSON.stringify(initialHousekeepers), JSON.stringify(existingHousekeepers)]);

  const toggleExistingHousekeeper = (name: string) => {
    setSelectedExisting(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const addHousekeeper = () => {
    const trimmedName = newHousekeeper.trim();
    
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

    if (housekeepers.includes(trimmedName) || selectedExisting.includes(trimmedName)) {
      toast({
        title: "Erreur",
        description: "Cette femme de chambre existe déjà",
        variant: "destructive"
      });
      return;
    }

    setHousekeepers([...housekeepers, trimmedName]);
    setNewHousekeeper('');
  };

  const removeHousekeeper = (index: number) => {
    setHousekeepers(housekeepers.filter((_, i) => i !== index));
  };

  const updateHousekeeper = (index: number, newName: string) => {
    const updated = [...housekeepers];
    updated[index] = newName;
    setHousekeepers(updated);
  };

  const handleConfirm = () => {
    // Combiner les femmes existantes sélectionnées et les nouvelles
    const allSelected = [...selectedExisting, ...housekeepers];
    
    if (allSelected.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner ou ajouter au moins une femme de chambre",
        variant: "destructive"
      });
      return;
    }

    onHousekeepersConfirmed(allSelected);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addHousekeeper();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Configuration des femmes de chambre
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {roomCount > 0 && (
              <p>
                Pour {roomCount} chambres, nous recommandons {recommendedCount} femme{recommendedCount > 1 ? 's' : ''} de chambre.
              </p>
            )}
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Section pour les femmes de chambre existantes */}
          {existingHousekeepers.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-green-700">
                ✅ Femmes de chambre existantes disponibles
              </div>
              <div className="space-y-2">
                {existingHousekeepers.map((name) => (
                  <div
                    key={name}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedExisting.includes(name) 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => toggleExistingHousekeeper(name)}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedExisting.includes(name) ? 'bg-primary border-primary' : 'border-muted-foreground'
                    }`}>
                      {selectedExisting.includes(name) && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="font-medium">{name}</span>
                    <Badge variant="outline" className="ml-auto">Existante</Badge>
                  </div>
                ))}
              </div>
              
              {selectedExisting.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✅ {selectedExisting.length} femme{selectedExisting.length > 1 ? 's' : ''} de chambre sélectionnée{selectedExisting.length > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Séparateur si on a des existantes ET qu'on permet d'ajouter */}
          {existingHousekeepers.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-sm text-muted-foreground">ou ajouter nouvelles</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>
          )}

          {/* Section pour ajouter de nouvelles femmes de chambre */}
          <div className="space-y-2">
            <Label htmlFor="housekeeper-name">Ajouter une nouvelle femme de chambre</Label>
            <div className="flex gap-2">
              <Input
                id="housekeeper-name"
                placeholder="Nom et prénom"
                value={newHousekeeper}
                onChange={(e) => setNewHousekeeper(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button onClick={addHousekeeper} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
              {hotelId && (
                <Button 
                  onClick={() => setShowInviteDialog(true)}
                  variant="outline"
                  size="icon"
                  title="Inviter une femme de chambre"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              )}
            </div>
            {hotelId && (
              <p className="text-xs text-muted-foreground">
                <Mail className="inline h-3 w-3 mr-1" />
                Utilisez le bouton email pour inviter directement
              </p>
            )}
          </div>

          {/* Liste des nouvelles femmes de chambre ajoutées */}
          {housekeepers.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Nouvelles femmes de chambre ({housekeepers.length})
                  </div>
                   <div className="space-y-2">
                     {housekeepers.map((housekeeper, index) => (
                       <div
                         key={index}
                         className="flex items-center gap-2 p-2 rounded-md border"
                       >
                         <Badge variant="secondary">{index + 1}</Badge>
                         <Input
                           value={housekeeper}
                           onChange={(e) => updateHousekeeper(index, e.target.value)}
                           className="flex-1"
                           placeholder={`Femme de chambre ${index + 1}`}
                         />
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => removeHousekeeper(index)}
                           className="text-destructive hover:text-destructive shrink-0"
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

          {/* Boutons de confirmation */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button 
              onClick={handleConfirm} 
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={selectedExisting.length === 0 && housekeepers.length === 0}
            >
              <Users className="h-4 w-4 mr-2" />
              Confirmer ({selectedExisting.length + housekeepers.length})
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* Dialog d'invitation */}
      {hotelId && (
        <HousekeeperInviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          hotelId={hotelId}
        />
      )}
    </Dialog>
  );
}