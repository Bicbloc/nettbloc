import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ReportFields } from "@/components/ReportCustomFields";
import ReportCustomFields from "@/components/ReportCustomFields";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabaseClient } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Plus, Trash2 } from "lucide-react";

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
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="border-b bg-muted/20 px-5 py-4 sm:px-6 sm:py-5 pr-12 sm:pr-14">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background">
              <FileDown className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left text-base sm:text-lg truncate">
                {housekeeperName
                  ? `Rapport de ${housekeeperName}`
                  : "Téléchargement des rapports"}
              </DialogTitle>
              <DialogDescription className="text-left text-sm">
                Personnalisez le PDF avant le téléchargement.
              </DialogDescription>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {housekeeperName ? "Individuel" : "Tous"}
                </Badge>

                {availableHousekeepers.length > 1 && (
                  <Badge variant="outline" className="text-xs">
                    {availableHousekeepers.length} femmes de chambre
                  </Badge>
                )}

                {hotelId && (
                  <Badge variant="outline" className="text-xs">
                    Option linge
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1 min-h-0" type="always">
            <div className="space-y-6 px-5 py-4 sm:px-6 sm:py-5 pr-7">
              <section className="space-y-2">
                <Label className="text-sm font-medium">Instructions générales</Label>
                <Textarea
                  id="generalInstructions"
                  placeholder="Ex: ton, format, priorités, points à mettre en avant…"
                  value={customFields.generalInstructions || ""}
                  onChange={handleGeneralInstructionsChange}
                  className="min-h-[120px] resize-y text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Ces instructions s’appliquent à tous les rapports.
                </p>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-medium">À faire et à savoir</Label>
                  <Badge variant="outline" className="text-xs">
                    Optionnel
                  </Badge>
                </div>

                <div className="rounded-lg border bg-muted/10 p-4">
                  <ReportCustomFields
                    onChange={(fields) => {
                      setCustomFields((prev) => ({
                        ...prev,
                        toDoItems: fields.toDoItems,
                        toKnowItems: fields.toKnowItems,
                      }));
                    }}
                  />
                </div>
              </section>

              {/* Single housekeeper mode */}
              {housekeeperName && (
                <section className="space-y-2">
                  <Label
                    htmlFor={`instructions-${housekeeperName}`}
                    className="text-sm font-medium"
                  >
                    Instructions spécifiques
                  </Label>
                  <Textarea
                    id={`instructions-${housekeeperName}`}
                    placeholder={`Ex: points importants pour ${housekeeperName}…`}
                    value={
                      (customFields.housekeeperInstructions &&
                        customFields.housekeeperInstructions[housekeeperName]) ||
                      ""
                    }
                    onChange={handleInstructionsChange}
                    className="min-h-[120px] resize-y text-sm"
                  />
                </section>
              )}

              {/* Multiple housekeepers mode */}
              {!housekeeperName && allHousekeepers && allHousekeepers.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-medium">
                      Instructions par femme de chambre
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      {allHousekeepers.length}
                    </Badge>
                  </div>

                  <Accordion type="multiple" className="rounded-lg border bg-background">
                    {allHousekeepers.map((name) => {
                      const filled =
                        (customFields.housekeeperInstructions?.[name] || "").trim()
                          .length > 0;

                      return (
                        <AccordionItem
                          key={name}
                          value={name}
                          className="px-4 last:border-b-0"
                        >
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {name}
                              </span>
                              <Badge
                                variant={filled ? "secondary" : "outline"}
                                className="text-[11px]"
                              >
                                {filled ? "Renseigné" : "Vide"}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2">
                            <Textarea
                              id={`instructions-${name}`}
                              placeholder={`Instructions pour ${name}…`}
                              value={
                                (customFields.housekeeperInstructions &&
                                  customFields.housekeeperInstructions[name]) ||
                                ""
                              }
                              onChange={(e) =>
                                handleHousekeeperInstructionChange(
                                  name,
                                  e.target.value
                                )
                              }
                              className="min-h-[90px] resize-y text-sm"
                            />
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </section>
              )}

              {/* Linen Inventory Section */}
              {hotelId && (
                <section className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Inventaire linge</Label>
                      <p className="text-xs text-muted-foreground">
                        Optionnel — ajoutez des quantités et assignez-les.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id="enable-linen"
                        checked={enableLinenInventory}
                        onCheckedChange={(checked) =>
                          setEnableLinenInventory(!!checked)
                        }
                      />
                      <Label
                        htmlFor="enable-linen"
                        className="text-sm cursor-pointer"
                      >
                        Activer
                      </Label>
                    </div>
                  </div>

                  {enableLinenInventory && (
                    <div className="rounded-lg border bg-muted/10 p-4 space-y-4">
                      {/* Add linen type selector */}
                      {availableLinenTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {availableLinenTypes.map((lt) => (
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
                        <div className="space-y-4">
                          {(customFields.linenInventory || []).map((item) => (
                            <div
                              key={item.linenTypeId}
                              className="rounded-lg border bg-background p-3 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-sm">
                                  {item.linenTypeName}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRemoveLinenItem(item.linenTypeId)
                                  }
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="flex items-center gap-3">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                  Quantité
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleLinenQuantityChange(
                                      item.linenTypeId,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-24 h-9 text-sm"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  Attribuer à
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                  {availableHousekeepers.map((hk) => (
                                    <div
                                      key={hk}
                                      className="flex items-center space-x-1.5"
                                    >
                                      <Checkbox
                                        id={`linen-${item.linenTypeId}-${hk}`}
                                        checked={item.assignedTo.includes(hk)}
                                        onCheckedChange={() =>
                                          handleToggleLinenAssignment(
                                            item.linenTypeId,
                                            hk
                                          )
                                        }
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
                </section>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-sm sm:text-base py-2.5"
            >
              {isSubmitting
                ? "Traitement en cours..."
                : housekeeperName
                  ? `Télécharger le rapport de ${housekeeperName}`
                  : "Télécharger tous les rapports"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReportDialog;
