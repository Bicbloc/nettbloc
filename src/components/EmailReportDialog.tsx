import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ReportFields } from "@/components/ReportCustomFields";
import ReportCustomFields from "@/components/ReportCustomFields";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string, customFields?: ReportFields, hotelName?: string) => void;
  initialEmail?: string;
  housekeeperName?: string;
  allHousekeepers?: string[];
}

const EmailReportDialog: React.FC<EmailReportDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  housekeeperName = "",
  allHousekeepers = []
}) => {
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
    
    setIsSubmitting(true);
    try {
      // Pass empty email and hotel name since they're no longer needed
      await onConfirm('', customFields, '');
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0 space-y-1">
          <DialogTitle className="text-left text-base sm:text-lg">
            {housekeeperName 
              ? `Rapport de ${housekeeperName}`
              : 'Téléchargement des rapports'}
          </DialogTitle>
          <DialogDescription className="text-left text-sm">
            Configurez les instructions pour le rapport PDF
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 mt-2">
          <ScrollArea className="flex-1 pr-2 sm:pr-4">
            <div className="space-y-3 sm:space-y-4 pb-4">
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <Label className="font-medium mb-1.5 block text-left text-sm">
                    Instructions générales
                  </Label>
                  <Textarea
                    id="generalInstructions"
                    placeholder="Instructions générales pour tous les rapports..."
                    value={customFields.generalInstructions || ''}
                    onChange={handleGeneralInstructionsChange}
                    className="min-h-[70px] sm:min-h-[80px] text-sm"
                  />
                </div>
                
                <div>
                  <Label className="font-medium mb-1.5 block text-left text-sm">
                    À faire et à savoir
                  </Label>
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
                  <div>
                    <Label htmlFor={`instructions-${housekeeperName}`} className="font-medium mb-1.5 block text-left text-sm">
                      Instructions spécifiques pour {housekeeperName}
                    </Label>
                    <Textarea
                      id={`instructions-${housekeeperName}`}
                      placeholder={`Instructions spécifiques pour ${housekeeperName}...`}
                      value={(customFields.housekeeperInstructions && customFields.housekeeperInstructions[housekeeperName]) || ''}
                      onChange={handleInstructionsChange}
                      className="min-h-[70px] sm:min-h-[80px] text-sm"
                    />
                  </div>
                )}
                
                {/* Multiple housekeepers mode */}
                {!housekeeperName && allHousekeepers && allHousekeepers.length > 0 && (
                  <div>
                    <Label className="font-medium mb-1.5 block text-left text-sm">
                      Instructions spécifiques par femme de chambre
                    </Label>
                    <div className="space-y-3">
                      {allHousekeepers.map(name => (
                        <div key={name} className="border-b pb-3 last:border-b-0">
                          <Label htmlFor={`instructions-${name}`} className="mb-1 block text-sm text-muted-foreground">
                            {name}
                          </Label>
                          <Textarea
                            id={`instructions-${name}`}
                            placeholder={`Instructions pour ${name}...`}
                            value={(customFields.housekeeperInstructions && customFields.housekeeperInstructions[name]) || ''}
                            onChange={(e) => handleHousekeeperInstructionChange(name, e.target.value)}
                            className="min-h-[60px] sm:min-h-[70px] text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="flex-shrink-0 pt-3 sm:pt-4 border-t mt-3">
            <Button type="submit" disabled={isSubmitting} className="w-full text-sm sm:text-base py-2.5">
              {isSubmitting 
                ? "Traitement en cours..." 
                : housekeeperName 
                  ? `Télécharger le rapport de ${housekeeperName}` 
                  : "Télécharger tous les rapports"
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReportDialog;
