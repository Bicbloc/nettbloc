
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
import { getReportEmail } from "@/lib/utils";
import { saveEmailToSupabase } from "@/lib/supabase";

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
}

export function EmailDialog({ isOpen, onClose, onConfirm }: EmailDialogProps) {
  const { email, setEmail, isValid } = useReportEmail();
  const [localEmail, setLocalEmail] = useState(email);

  // Check if we already have a stored email
  useEffect(() => {
    const savedEmail = getReportEmail();
    // If we have a saved valid email and the dialog is open, auto-confirm
    if (savedEmail && isOpen) {
      // Save to Supabase
      saveEmailToSupabase(savedEmail).catch(console.error);
      onConfirm(savedEmail);
      onClose();
    }
  }, [isOpen, onConfirm, onClose]);

  useEffect(() => {
    if (isOpen) {
      setLocalEmail(email);
    }
  }, [isOpen, email]);

  const handleSubmit = async (e: React.FormEvent) => {
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
      try {
        // Save to Supabase
        await saveEmailToSupabase(localEmail);
        onConfirm(localEmail);
        onClose();
      } catch (error) {
        console.error("Error saving email:", error);
        // Continue even if Supabase save fails
        onConfirm(localEmail);
        onClose();
      }
    } else {
      toast({
        variant: "destructive",
        title: "Email invalide",
        description: "Veuillez saisir une adresse email valide."
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">NettoBloc</DialogTitle>
          <DialogDescription className="text-left">
            Veuillez saisir votre adresse email pour continuer.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1 text-left">
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
              <p className="text-sm text-red-500 text-left">
                Veuillez entrer une adresse email valide.
              </p>
            )}
            <p className="text-xs text-gray-500 text-left">
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
