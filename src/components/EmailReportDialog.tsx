
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ReportFields } from "@/services/reportService";
import ReportCustomFields from "@/components/ReportCustomFields";
import { getReportEmail, saveReportEmail } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string, customFields?: ReportFields) => void;
  initialEmail?: string;
  housekeeperName?: string;
}

const EmailReportDialog: React.FC<EmailReportDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialEmail = "",
  housekeeperName = ""
}) => {
  // Get saved email or use initialEmail
  const savedEmail = getReportEmail();
  const [localEmail, setLocalEmail] = useState(savedEmail || initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFields, setCustomFields] = useState<ReportFields>({ 
    toDoItems: [], 
    toKnowItems: [],
    instructions: '',
    generalInstructions: ''
  });
  const { toast } = useToast();

  // Update instructions field
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomFields(prev => ({
      ...prev,
      instructions: e.target.value
    }));
  };

  // Update general instructions field
  const handleGeneralInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomFields(prev => ({
      ...prev,
      generalInstructions: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = emailRegex.test(localEmail);
    
    if (isValidEmail) {
      setIsSubmitting(true);
      try {
        saveReportEmail(localEmail); // Save for future use
        await onConfirm(localEmail, customFields);
        onClose();
      } catch (error) {
        console.error("Erreur lors de la génération du rapport:", error);
        toast({
          variant: "destructive",
          title: "Erreur de téléchargement",
          description: "Une erreur est survenue lors de la génération du PDF. Veuillez réessayer."
        });
      } finally {
        setIsSubmitting(false);
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {housekeeperName 
              ? `Rapport de ${housekeeperName}`
              : 'Téléchargement du rapport'}
          </DialogTitle>
          <DialogDescription>
            Saisissez votre email pour recevoir le rapport PDF
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <ScrollArea className="flex-1 pr-4 mt-2" style={{ height: "60vh" }}>
            <div className="space-y-4">
              <div className="grid gap-4 py-2">
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
                
                <div className="mt-2">
                  <Label className="font-medium mb-2 block">Instructions générales (pour tous les rapports)</Label>
                  <Textarea
                    id="generalInstructions"
                    placeholder="Instructions générales qui s'appliqueront à tous les rapports..."
                    value={customFields.generalInstructions || ''}
                    onChange={handleGeneralInstructionsChange}
                    className="min-h-[80px]"
                  />
                </div>
                
                <div className="mt-2">
                  <Label className="font-medium mb-2 block">À faire et à savoir (par rapport)</Label>
                  <ReportCustomFields onChange={(fields) => {
                    setCustomFields(prev => ({
                      ...prev,
                      toDoItems: fields.toDoItems,
                      toKnowItems: fields.toKnowItems
                    }));
                  }} />
                </div>
                
                <div className="mt-2">
                  <Label htmlFor="instructions" className="font-medium mb-2 block">
                    {housekeeperName 
                      ? `Instructions spécifiques pour ${housekeeperName}` 
                      : 'Instructions spéciales par rapport'}
                  </Label>
                  <Textarea
                    id="instructions"
                    placeholder={housekeeperName 
                      ? `Instructions spécifiques pour ${housekeeperName}...` 
                      : 'Ajoutez des instructions spéciales pour ce rapport...'}
                    value={customFields.instructions || ''}
                    onChange={handleInstructionsChange}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="sticky bottom-0 pt-4 bg-background border-t mt-auto">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Traitement en cours..." : "Télécharger le rapport"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReportDialog;
