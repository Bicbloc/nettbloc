import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Ban } from 'lucide-react';

interface SuspensionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  userEmail: string;
  isSuspended: boolean;
}

export const SuspensionDialog: React.FC<SuspensionDialogProps> = ({
  open,
  onClose,
  onConfirm,
  userEmail,
  isSuspended
}) => {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!isSuspended && reason.trim()) {
      onConfirm(reason);
      setReason('');
      onClose();
    } else if (isSuspended) {
      onConfirm('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            {isSuspended ? 'Réactiver l\'utilisateur' : 'Suspendre l\'utilisateur'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong>Utilisateur :</strong> {userEmail}
          </p>
          
          {!isSuspended ? (
            <div className="space-y-2">
              <Label htmlFor="suspension-reason">
                Motif de suspension <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="suspension-reason"
                placeholder="Entrez le motif de la suspension..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Ce motif sera visible dans les logs d'administration.
              </p>
            </div>
          ) : (
            <div className="bg-green-50 p-3 rounded-md">
              <p className="text-sm text-green-800">
                Cet utilisateur va être réactivé et pourra à nouveau accéder à son compte.
              </p>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant={isSuspended ? "default" : "destructive"}
              onClick={handleSubmit}
              disabled={!isSuspended && !reason.trim()}
            >
              {isSuspended ? 'Réactiver' : 'Suspendre'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};