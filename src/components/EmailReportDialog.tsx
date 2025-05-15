
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ReportFields } from "@/components/ReportCustomFields"; // Updated import path
import ReportCustomFields from "@/components/ReportCustomFields";
import { getReportEmail, saveReportEmail } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string, customFields?: ReportFields) => void;
  initialEmail?: string;
  housekeeperName?: string;
  allHousekeepers?: string[];
}

const EmailReportDialog: React.FC<EmailReportDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialEmail = "",
  housekeeperName = "",
  allHousekeepers = []
}) => {
  // Get saved email or use initialEmail
  const savedEmail = getReportEmail();
  const [localEmail, setLocalEmail] = useState(savedEmail || initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFields, setCustomFields] = useState<ReportFields>({ 
    toDoItems: [], 
    toKnowItems: [],
    instructions: '',
    generalInstructions: '',
    housekeeperInstructions: {}
  });
  const { toast } = useToast();
  
  // Initialize housekeeperInstructions object when housekeepers list changes
  useEffect(() => {
    if (!customFields.housekeeperInstructions) {
      setCustomFields(prev => ({
        ...prev,
        housekeeperInstructions: {}
      }));
    }
    
    // Add any missing housekeepers
    if (allHousekeepers && allHousekeepers.length > 0) {
      const updatedInstructions = {...(customFields.housekeeperInstructions || {})};
      
      allHousekeepers.forEach(name => {
        if (!updatedInstructions[name]) {
          updatedInstructions[name] = '';
        }
      });
      
      setCustomFields(prev => ({
        ...prev,
        housekeeperInstructions: updatedInstructions
      }));
    }
  }, [allHousekeepers, isOpen]);

  // Update instructions field for single housekeeper view
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (housekeeperName) {
      // Single housekeeper mode - update specific instructions
      const updatedInstructions = {...(customFields.housekeeperInstructions || {})};
      updatedInstructions[housekeeperName] = e.target.value;
      
      setCustomFields(prev => ({
        ...prev,
        housekeeperInstructions: updatedInstructions
      }));
    } else {
      // Legacy support for old format
      setCustomFields(prev => ({
        ...prev,
        instructions: e.target.value
      }));
    }
  };

  // Update specific housekeeper instructions
  const handleHousekeeperInstructionChange = (housekeeperName: string, value: string) => {
    const updatedInstructions = {...(customFields.housekeeperInstructions || {})};
    updatedInstructions[housekeeperName] = value;
    
    setCustomFields(prev => ({
      ...prev,
      housekeeperInstructions: updatedInstructions
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
        console.log("Submitting with custom fields:", customFields);
        console.log("Current housekeeper name:", housekeeperName);
        
        // Pass the complete customFields object to onConfirm
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
      <DialogContent className="sm:max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {housekeeperName 
              ? `Rapport de ${housekeeperName}`
              : 'Téléchargement des rapports'}
          </DialogTitle>
          <DialogDescription>
            Saisissez votre email pour recevoir le rapport PDF
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <ScrollArea className="pr-4 mt-2" style={{ maxHeight: "400px", height: "auto" }}>
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
                
                {/* Single housekeeper mode */}
                {housekeeperName && (
                  <div className="mt-2">
                    <Label htmlFor={`instructions-${housekeeperName}`} className="font-medium mb-2 block">
                      Instructions spécifiques pour {housekeeperName}
                    </Label>
                    <Textarea
                      id={`instructions-${housekeeperName}`}
                      placeholder={`Instructions spécifiques pour ${housekeeperName}...`}
                      value={(customFields.housekeeperInstructions && customFields.housekeeperInstructions[housekeeperName]) || ''}
                      onChange={handleInstructionsChange}
                      className="min-h-[80px]"
                    />
                  </div>
                )}
                
                {/* Multiple housekeepers mode - show instructions fields for each housekeeper */}
                {!housekeeperName && allHousekeepers && allHousekeepers.length > 0 && (
                  <div className="mt-2">
                    <Label className="font-medium mb-2 block">Instructions spécifiques par femme de chambre</Label>
                    {allHousekeepers.map(name => (
                      <div key={name} className="mb-3 border-b pb-3">
                        <Label htmlFor={`instructions-${name}`} className="mb-1 block text-sm">
                          {name}
                        </Label>
                        <Textarea
                          id={`instructions-${name}`}
                          placeholder={`Instructions spécifiques pour ${name}...`}
                          value={(customFields.housekeeperInstructions && customFields.housekeeperInstructions[name]) || ''}
                          onChange={(e) => handleHousekeeperInstructionChange(name, e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="sticky bottom-0 pt-4 bg-background border-t mt-4">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Traitement en cours..." : housekeeperName ? `Télécharger le rapport de ${housekeeperName}` : "Télécharger tous les rapports"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReportDialog;
