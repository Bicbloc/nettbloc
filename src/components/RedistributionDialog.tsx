import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Shuffle, Layers, Zap, Calendar, Users, UserPlus, AlertCircle, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { isHousekeeperNew } from '@/utils/newHousekeepers';
import { ClipboardCheck, ClipboardList } from 'lucide-react';
import { InventoryAssignmentCard } from '@/components/dashboard/InventoryAssignmentCard';

interface RedistributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRedistribute: (method: RedistributionMethod, selectedHousekeepers: string[]) => void;
  housekeeperCount: number;
  roomCount: number;
  housekeeperNames: string[];
  onAddHousekeeper: () => void;
  hotelId?: string | null;
  onRequestInspection?: () => void;
}

export type RedistributionMethod = 'random' | 'floor' | 'cleaning-type';

export function RedistributionDialog({
  isOpen,
  onClose,
  onRedistribute,
  housekeeperCount,
  roomCount,
  housekeeperNames,
  onAddHousekeeper,
  hotelId,
  onRequestInspection
}: RedistributionDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<RedistributionMethod>('floor');
  const [selectedHousekeepers, setSelectedHousekeepers] = useState<string[]>([]);

  // Initialiser avec toutes les femmes de chambre sélectionnées
  useEffect(() => {
    if (isOpen) {
      setSelectedHousekeepers([...housekeeperNames]);
    }
  }, [isOpen, housekeeperNames]);

  const methods = [
    {
      id: 'floor' as RedistributionMethod,
      title: 'Par ordre d\'étage',
      description: 'Attribution par étage pour minimiser les déplacements et optimiser l\'efficacité',
      icon: Layers,
      color: 'text-green-600'
    },
    {
      id: 'random' as RedistributionMethod,
      title: 'Distribution aléatoire',
      description: 'Répartition équitable et aléatoire des chambres entre les femmes de chambre sélectionnées',
      icon: Shuffle,
      color: 'text-blue-600'
    },
    {
      id: 'cleaning-type' as RedistributionMethod,
      title: 'Par type de nettoyage',
      description: 'Regroupement par type de nettoyage (à blanc, recouche) pour optimiser le matériel',
      icon: Zap,
      color: 'text-purple-600'
    }
  ];

  const handleToggleHousekeeper = (name: string) => {
    setSelectedHousekeepers(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    setSelectedHousekeepers([...housekeeperNames]);
  };

  const handleDeselectAll = () => {
    setSelectedHousekeepers([]);
  };

  const handleConfirm = () => {
    if (selectedHousekeepers.length === 0) return;
    onRedistribute(selectedMethod, selectedHousekeepers);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Redistribuer les chambres
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {housekeeperCount} femme{housekeeperCount > 1 ? 's' : ''} de chambre
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-4 w-4" />
                {roomCount} chambres à distribuer
              </span>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Sélection des femmes de chambre */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Femmes de chambre à inclure</h4>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  Tout sélectionner
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
                  Tout désélectionner
                </Button>
              </div>
            </div>
            
            <Card>
              <CardContent className="p-4">
                {housekeeperNames.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Aucune femme de chambre disponible</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {housekeeperNames.map(name => (
                      <div
                        key={name}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedHousekeepers.includes(name) 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-muted-foreground/50'
                        }`}
                        onClick={() => handleToggleHousekeeper(name)}
                      >
                        <Checkbox
                          checked={selectedHousekeepers.includes(name)}
                          onCheckedChange={() => handleToggleHousekeeper(name)}
                        />
                        <span className="font-medium truncate">{name}</span>
                        {isHousekeeperNew(name) && (
                          <Badge className="ml-auto shrink-0 gap-1 bg-emerald-500 text-white hover:bg-emerald-500">
                            <Sparkles className="h-3 w-3" />
                            Nouveau
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={onAddHousekeeper}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Ajouter une femme de chambre
                </Button>
              </CardContent>
            </Card>

            {selectedHousekeepers.length === 0 && housekeeperNames.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Sélectionnez au moins une femme de chambre pour redistribuer les chambres.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Méthode de redistribution */}
          <div className="space-y-3">
            <h4 className="font-medium">Méthode de redistribution</h4>
            <RadioGroup
              value={selectedMethod}
              onValueChange={(value) => setSelectedMethod(value as RedistributionMethod)}
              className="space-y-3"
            >
              {methods.map((method) => (
                <div key={method.id} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Label htmlFor={method.id} className="cursor-pointer flex-1">
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <method.icon className={`h-5 w-5 mt-0.5 ${method.color}`} />
                            <div className="space-y-1 flex-1">
                              <h4 className="font-medium">{method.title}</h4>
                              <CardDescription className="text-sm">
                                {method.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Label>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleConfirm} 
            className="hover-scale"
            disabled={selectedHousekeepers.length === 0}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Redistribuer ({selectedHousekeepers.length} femme{selectedHousekeepers.length > 1 ? 's' : ''} de chambre)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
