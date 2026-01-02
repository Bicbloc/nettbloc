import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ReportFields } from "@/components/ReportCustomFields";
import ReportCustomFields from "@/components/ReportCustomFields";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabaseClient } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

interface LinenInventoryItem {
  linenTypeId: string;
  linenTypeName: string;
  quantity: number;
  assignedTo: string[];
}

export interface ExtendedReportFields extends ReportFields {
  linenInventory?: LinenInventoryItem[];
}

interface EmailReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string, customFields?: ExtendedReportFields, hotelName?: string) => void;
  initialEmail?: string;
  housekeeperName?: string;
  allHousekeepers?: string[];
  hotelId?: string;
}

const EmailReportDialog: React.FC<EmailReportDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  housekeeperName = "",
  allHousekeepers = [],
  hotelId
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFields, setCustomFields] = useState<ExtendedReportFields>({ 
    toDoItems: [], 
    toKnowItems: [],
    instructions: '',
    generalInstructions: '',
    housekeeperInstructions: {},
    linenInventory: []
  });
  const [enableLinenInventory, setEnableLinenInventory] = useState(false);
  const { toast } = useToast();

  // Fetch linen types for this hotel
  const { data: linenTypes = [] } = useQuery({
    queryKey: ['linen-types', hotelId],
    queryFn: async () => {
      if (!hotelId) return [];
      const { data, error } = await supabaseClient
        .from('linen_types')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!hotelId && isOpen
  });
  
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

  // Add a linen inventory item
  const handleAddLinenItem = (linenTypeId: string, linenTypeName: string) => {
    const currentInventory = customFields.linenInventory || [];
    if (currentInventory.find(item => item.linenTypeId === linenTypeId)) {
      return; // Already added
    }
    
    setCustomFields(prev => ({
      ...prev,
      linenInventory: [
        ...(prev.linenInventory || []),
        { linenTypeId, linenTypeName, quantity: 0, assignedTo: [] }
      ]
    }));
  };

  // Remove a linen inventory item
  const handleRemoveLinenItem = (linenTypeId: string) => {
    setCustomFields(prev => ({
      ...prev,
      linenInventory: (prev.linenInventory || []).filter(item => item.linenTypeId !== linenTypeId)
    }));
  };

  // Update linen quantity
  const handleLinenQuantityChange = (linenTypeId: string, quantity: number) => {
    setCustomFields(prev => ({
      ...prev,
      linenInventory: (prev.linenInventory || []).map(item =>
        item.linenTypeId === linenTypeId ? { ...item, quantity } : item
      )
    }));
  };

  // Toggle housekeeper assignment for linen
  const handleToggleLinenAssignment = (linenTypeId: string, housekeeper: string) => {
    setCustomFields(prev => ({
      ...prev,
      linenInventory: (prev.linenInventory || []).map(item => {
        if (item.linenTypeId !== linenTypeId) return item;
        
        const isAssigned = item.assignedTo.includes(housekeeper);
        return {
          ...item,
          assignedTo: isAssigned 
            ? item.assignedTo.filter(h => h !== housekeeper)
            : [...item.assignedTo, housekeeper]
        };
      })
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

  const availableHousekeepers = housekeeperName ? [housekeeperName] : allHousekeepers;
  const availableLinenTypes = linenTypes.filter(
    lt => !(customFields.linenInventory || []).find(item => item.linenTypeId === lt.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6">
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
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 mt-2 overflow-hidden">
          <ScrollArea className="flex-1 h-[50vh] min-h-[300px] max-h-[60vh] rounded-md border bg-muted/10">
            <div className="space-y-4 sm:space-y-5 p-4 pr-5">
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <Label className="font-medium mb-1.5 block text-left text-sm">
                    Instructions générales
                  </Label>
                  <Textarea
                    id="generalInstructions"
                    placeholder="Instructions générales pour tous les rapports..."
                    value={customFields.generalInstructions || ''}
                    onChange={handleGeneralInstructionsChange}
                    className="min-h-[100px] sm:min-h-[120px] text-sm"
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
                      className="min-h-[100px] sm:min-h-[120px] text-sm"
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
                            className="min-h-[80px] sm:min-h-[100px] text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linen Inventory Section */}
                {hotelId && (
                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Checkbox
                        id="enable-linen"
                        checked={enableLinenInventory}
                        onCheckedChange={(checked) => setEnableLinenInventory(!!checked)}
                      />
                      <Label htmlFor="enable-linen" className="font-medium text-sm cursor-pointer">
                        Ajouter un inventaire linge
                      </Label>
                    </div>

                    {enableLinenInventory && (
                      <div className="space-y-4 pl-2">
                        {/* Add linen type selector */}
                        {availableLinenTypes.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {availableLinenTypes.map(lt => (
                              <Button
                                key={lt.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddLinenItem(lt.id, lt.name)}
                                className="text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                {lt.name}
                              </Button>
                            ))}
                          </div>
                        )}

                        {linenTypes.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Aucun type de linge configuré. Allez dans l'onglet Linge pour en ajouter.
                          </p>
                        )}

                        {/* Linen inventory items */}
                        {(customFields.linenInventory || []).length > 0 && (
                          <div className="space-y-4 border rounded-lg p-3 bg-muted/30">
                            {(customFields.linenInventory || []).map(item => (
                              <div key={item.linenTypeId} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">{item.linenTypeName}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveLinenItem(item.linenTypeId)}
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                    Quantité:
                                  </Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) => handleLinenQuantityChange(item.linenTypeId, parseInt(e.target.value) || 0)}
                                    className="w-20 h-8 text-sm"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs text-muted-foreground mb-2 block">
                                    Attribuer à:
                                  </Label>
                                  <div className="flex flex-wrap gap-2">
                                    {availableHousekeepers.map(hk => (
                                      <div key={hk} className="flex items-center space-x-1.5">
                                        <Checkbox
                                          id={`linen-${item.linenTypeId}-${hk}`}
                                          checked={item.assignedTo.includes(hk)}
                                          onCheckedChange={() => handleToggleLinenAssignment(item.linenTypeId, hk)}
                                        />
                                        <Label 
                                          htmlFor={`linen-${item.linenTypeId}-${hk}`}
                                          className="text-xs cursor-pointer"
                                        >
                                          {hk}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
