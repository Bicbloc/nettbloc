import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Shuffle, Layers, Zap, Calendar, Users } from 'lucide-react';

interface RedistributionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRedistribute: (method: RedistributionMethod) => void;
  housekeeperCount: number;
  roomCount: number;
}

export type RedistributionMethod = 'random' | 'floor' | 'cleaning-type';

export function RedistributionDialog({
  isOpen,
  onClose,
  onRedistribute,
  housekeeperCount,
  roomCount
}: RedistributionDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<RedistributionMethod>('random');

  const methods = [
    {
      id: 'random' as RedistributionMethod,
      title: 'Distribution aléatoire',
      description: 'Répartition équitable et aléatoire des chambres entre toutes les femmes de chambre',
      icon: Shuffle,
      color: 'text-blue-600'
    },
    {
      id: 'floor' as RedistributionMethod,
      title: 'Par ordre d\'étage',
      description: 'Attribution par étage pour minimiser les déplacements et optimiser l\'efficacité',
      icon: Layers,
      color: 'text-green-600'
    },
    {
      id: 'cleaning-type' as RedistributionMethod,
      title: 'Par type de nettoyage',
      description: 'Regroupement par type de nettoyage (à blanc, recouche) pour optimiser le matériel',
      icon: Zap,
      color: 'text-purple-600'
    }
  ];

  const handleConfirm = () => {
    onRedistribute(selectedMethod);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Choisir la méthode de redistribution
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
        
        <div className="space-y-4">
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

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} className="hover-scale">
            <Calendar className="h-4 w-4 mr-2" />
            Redistribuer ({selectedMethod === 'random' ? 'Aléatoire' : 
                         selectedMethod === 'floor' ? 'Par étage' : 'Par type'})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}