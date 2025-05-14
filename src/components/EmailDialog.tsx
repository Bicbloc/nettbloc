
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
import { Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
      
      // Si l'email est déjà valide et enregistré, fermer la boîte de dialogue
      // et confirmer directement avec l'email stocké
      if (email && isValid) {
        onConfirm(email);
        onClose();
      }
    }
  }, [isOpen, email, isValid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!localEmail) {
      toast({
        variant: "destructive",
        title: "Email requis",
        description: "Veuillez saisir votre adresse email pour continuer."
      });
      return;
    }
    
    if (isValid) {
      onConfirm(localEmail);
    } else {
      toast({
        variant: "destructive",
        title: "Email invalide",
        description: "Veuillez saisir une adresse email valide."
      });
    }
  };

  // Si l'email est déjà valide et enregistré, nous ne montrons pas le dialogue
  if (email && isValid && isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adresse email</DialogTitle>
          <DialogDescription>
            Veuillez saisir votre adresse email pour continuer.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              Email <span className="text-red-500">*</span>
            </Label>
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
              className="border-slate-300"
              autoFocus
            />
            {localEmail && !isValid && (
              <p className="text-sm text-red-500">
                Veuillez entrer une adresse email valide.
              </p>
            )}
            <p className="text-xs text-gray-500">
              Cette adresse sera utilisée pour les rapports et communications.
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!localEmail || !isValid}>
              Confirmer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
