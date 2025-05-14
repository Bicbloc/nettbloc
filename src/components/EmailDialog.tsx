
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReportEmail } from "@/hooks/use-report-email";

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
}

export function EmailDialog({ isOpen, onClose, onConfirm }: EmailDialogProps) {
  const { email, setEmail, isValid } = useReportEmail();
  const [localEmail, setLocalEmail] = useState(email);

  useEffect(() => {
    if (isOpen) {
      setLocalEmail(email);
    }
  }, [isOpen, email]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isValid) {
      onConfirm(localEmail);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adresse email</DialogTitle>
          <DialogDescription>
            Veuillez saisir votre adresse email pour télécharger les rapports.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={localEmail}
              onChange={(e) => {
                setLocalEmail(e.target.value);
                setEmail(e.target.value);
              }}
              required
            />
            {localEmail && !isValid && (
              <p className="text-sm text-red-500">
                Veuillez entrer une adresse email valide.
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!isValid}>
              Confirmer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
