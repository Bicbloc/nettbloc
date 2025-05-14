
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ReportFields } from "@/services/reportService";
import ReportCustomFields from "@/components/ReportCustomFields";
import { getReportEmail, saveReportEmail } from "@/lib/utils";

interface EmailReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string, customFields?: ReportFields) => void;
  isValid?: boolean; // Make optional since we validate internally now
  initialEmail?: string;
}

const EmailReportDialog: React.FC<EmailReportDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialEmail = ""
}) => {
  // Get saved email or use initialEmail
  const savedEmail = getReportEmail();
  const [localEmail, setLocalEmail] = useState(savedEmail || initialEmail);
  const [customFields, setCustomFields] = useState<ReportFields>({ 
    toDoItems: [], 
    toKnowItems: [],
    instructions: '' 
  });
  const { toast } = useToast();

  // Update instructions field
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomFields(prev => ({
      ...prev,
      instructions: e.target.value
    }));
  };

  // Auto-confirm if we already have email and dialog is opened
  useEffect(() => {
    if (isOpen && savedEmail) {
      onConfirm(savedEmail, customFields);
      onClose();
    }
  }, [isOpen, savedEmail]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = emailRegex.test(localEmail);
    
    if (isValidEmail) {
      saveReportEmail(localEmail); // Save for future use
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
              <Label className="font-medium mb-2 block">À faire et à savoir</Label>
              <ReportCustomFields onChange={(fields) => {
                setCustomFields(prev => ({
                  ...prev,
                  toDoItems: fields.toDoItems,
                  toKnowItems: fields.toKnowItems
                }));
              }} />
            </div>
            
            <div className="mt-4">
              <Label htmlFor="instructions" className="font-medium mb-2 block">
                Instructions spéciales
              </Label>
              <Textarea
                id="instructions"
                placeholder="Ajoutez des instructions spéciales ici..."
                value={customFields.instructions || ''}
                onChange={handleInstructionsChange}
                className="min-h-[100px]"
              />
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
