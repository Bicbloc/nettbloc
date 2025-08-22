import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Crown, AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeButton } from './UpgradeButton';
import { PremiumLimitGuard } from './PremiumLimitGuard';

interface EmailDialogWithLimitProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
  title?: string;
  description?: string;
  roomCount?: number;
  maxFreeRooms?: number;
}

export const EmailDialogWithLimit: React.FC<EmailDialogWithLimitProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title = "Téléchargement de rapport",
  description = "Veuillez entrer votre adresse email pour recevoir le rapport.",
  roomCount = 0,
  maxFreeRooms = 50
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isPremium, isFree } = useSubscription();

  const exceedsLimit = roomCount > maxFreeRooms && isFree;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) return;
    
    if (exceedsLimit) {
      return; // Block submission if exceeds limit and not premium
    }
    
    setIsLoading(true);
    try {
      await onSubmit(email);
      setEmail('');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        {exceedsLimit ? (
          <PremiumLimitGuard
            roomCount={roomCount}
            maxFreeRooms={maxFreeRooms}
            title="Rapport volumineux - Premium requis"
            description={`Ce rapport contient ${roomCount} chambres. La limite gratuite est de ${maxFreeRooms} chambres.`}
            showUpgrade={true}
          >
            <div></div>
          </PremiumLimitGuard>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {roomCount > 0 && (
              <div className="text-sm text-muted-foreground">
                Ce rapport contient {roomCount} chambres.
                {isFree && roomCount > 10 && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-blue-800 text-xs">
                      💡 Avec Premium : rapports illimités + fonctionnalités avancées
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !email}
              >
                {isLoading ? 'Envoi...' : 'Télécharger'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};