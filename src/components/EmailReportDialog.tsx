
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ReportFields } from "@/services/reportService";
import ReportCustomFields from "@/components/ReportCustomFields";

interface EmailReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string, customFields?: ReportFields) => void;
  isValid: boolean;
  initialEmail?: string;  // Add support for initial email
}

const EmailReportDialog: React.FC<EmailReportDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isValid,
  initialEmail = ""
}) => {
  const [localEmail, setLocalEmail] = useState(initialEmail);
  const [customFields, setCustomFields] = useState<ReportFields>({ toDoItems: [], toKnowItems: [] });
  const { toast } = useToast();

  // Update localEmail when initialEmail changes
  useEffect(() => {
    if (initialEmail) {
      setLocalEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = emailRegex.test(localEmail);
    
    if (isValidEmail) {
      onConfirm(localEmail, customFields);
      onClose();
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
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Téléchargement du rapport</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={localEmail}
                onChange={(e) => setLocalEmail(e.target.value)}
                className="col-span-3"
                required
              />
              <p className="text-xs text-muted-foreground col-span-4 text-center">
                Un email valide est requis pour télécharger le rapport
              </p>
            </div>
            
            <div className="mt-4">
              <Label className="font-medium mb-2 block">Instructions pour le rapport</Label>
              <ReportCustomFields onChange={setCustomFields} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Télécharger le rapport</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReportDialog;
