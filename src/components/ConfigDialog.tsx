import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, MinusSquare, PlusSquare, Edit, Save, X, Sparkles } from "lucide-react";
import { CleaningConfig, getDefaultCleaningConfig } from "@/services/pdfService";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";

interface ConfigDialogProps {
  config: CleaningConfig;
  onConfigChange: (config: CleaningConfig) => void;
  onHousekeeperNamesChange: (names: string[]) => void;
  housekeeperNames: string[];
  isPremium?: boolean;
}

export function ConfigDialog({ 
  config, 
  onConfigChange, 
  onHousekeeperNamesChange, 
  housekeeperNames,
  isPremium = false
}: ConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>(housekeeperNames);
  const [newName, setNewName] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    // Update names when housekeeperNames prop changes
    setNames(housekeeperNames);
  }, [housekeeperNames]);

  const form = useForm<CleaningConfig>({
    defaultValues: config
  });

  // Fonction pour réinitialiser aux valeurs par défaut (tenant compte du statut premium)
  const resetToDefaults = () => {
    const defaults = getDefaultCleaningConfig(isPremium);
    form.reset(defaults);
    onConfigChange(defaults);
    toast({
      description: isPremium ? "Configuration réinitialisée aux valeurs Premium par défaut" : "Configuration réinitialisée aux valeurs par défaut"
    });
  };

  const handleSubmit = (data: CleaningConfig) => {
    onConfigChange(data);
    onHousekeeperNamesChange(names);
    setOpen(false);
    
    toast({
      description: "Configuration sauvegardée"
    });
  };

  const handleTrainPdf = () => {
    setOpen(false);
    // Naviguer vers l'onglet d'entraînement de l'import PDF
    window.dispatchEvent(new CustomEvent('navigate-to-training'));
  };

  const handleAddName = () => {
    if (newName.trim()) {
      setNames([...names, newName.trim()]);
      setNewName("");
    }
  };

  const handleRemoveName = (index: number, e: React.MouseEvent) => {
    // Prevent event bubbling and default behavior
    e.preventDefault();
    e.stopPropagation();
    
    const updatedNames = [...names];
    updatedNames.splice(index, 1);
    setNames(updatedNames);
    
    // Show notification but don't close dialog
    toast({
      description: "Femme de chambre supprimée"
    });
  };

  const startEditing = (index: number) => {
    setEditIndex(index);
    setEditName(names[index]);
  };

  const saveEdit = () => {
    if (editIndex !== null && editName.trim()) {
      const updatedNames = [...names];
      updatedNames[editIndex] = editName.trim();
      setNames(updatedNames);
      setEditIndex(null);
    }
  };

  const cancelEdit = () => {
    setEditIndex(null);
  };

  const incrementValue = (fieldName: keyof CleaningConfig) => {
    const currentValue = form.getValues(fieldName) as number;
    form.setValue(fieldName, currentValue + 1);
  };

  const decrementValue = (fieldName: keyof CleaningConfig) => {
    const currentValue = form.getValues(fieldName) as number;
    if (currentValue > 1) { // Prevent going below 1
      form.setValue(fieldName, currentValue - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Configuration
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configuration du Nettoyage</DialogTitle>
          <DialogDescription>
            Configurez les paramètres de nettoyage et les femmes de chambre
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 pr-4 -mr-4">
              <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-primary">Entraîner l'import PDF</p>
                  <p className="text-xs text-muted-foreground">
                    Apprenez à l'IA à lire votre PDF de réservations pour importer vos chambres automatiquement.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleTrainPdf}>
                <Sparkles className="h-4 w-4 mr-1" />
                Entraîner le PDF maintenant
              </Button>
            </div>
            <FormField
              control={form.control}
              name="fullCleaningTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temps de nettoyage à blanc (minutes)</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-r-none"
                        onClick={() => decrementValue("fullCleaningTime")}
                      >
                        <MinusSquare className="h-4 w-4" />
                      </Button>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))} 
                        className="rounded-none text-center" 
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-l-none"
                        onClick={() => incrementValue("fullCleaningTime")}
                      >
                        <PlusSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Temps nécessaire pour un nettoyage complet
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="quickCleaningTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temps de recouche (minutes)</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-r-none"
                        onClick={() => decrementValue("quickCleaningTime")}
                      >
                        <MinusSquare className="h-4 w-4" />
                      </Button>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))} 
                        className="rounded-none text-center" 
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-l-none"
                        onClick={() => incrementValue("quickCleaningTime")}
                      >
                        <PlusSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Temps nécessaire pour un nettoyage rapide
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="minRoomsPerHousekeeper"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum de chambres par femme de chambre {isPremium && <span className="text-xs text-premium-foreground bg-premium px-2 py-1 rounded">Premium: jusqu'à 15</span>}</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-r-none"
                        onClick={() => decrementValue("minRoomsPerHousekeeper")}
                      >
                        <MinusSquare className="h-4 w-4" />
                      </Button>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))} 
                        className="rounded-none text-center" 
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-l-none"
                        onClick={() => incrementValue("minRoomsPerHousekeeper")}
                      >
                        <PlusSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="maxRoomsPerHousekeeper"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum de chambres par femme de chambre {isPremium && <span className="text-xs text-premium-foreground bg-premium px-2 py-1 rounded">Premium: jusqu'à 50</span>}</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-r-none"
                        onClick={() => decrementValue("maxRoomsPerHousekeeper")}
                      >
                        <MinusSquare className="h-4 w-4" />
                      </Button>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))} 
                        className="rounded-none text-center" 
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-l-none"
                        onClick={() => incrementValue("maxRoomsPerHousekeeper")}
                      >
                        <PlusSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <FormLabel>Noms des femmes de chambre</FormLabel>
              
              <div className="flex gap-2 mb-2">
                <Input 
                  placeholder="Ajouter un nom" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Button type="button" onClick={handleAddName}>Ajouter</Button>
              </div>
              
              <ScrollArea className="h-40 border rounded-md p-2">
                {names.map((name, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                    {editIndex === index ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)} 
                          autoFocus 
                          className="flex-1"
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={saveEdit}
                          className="h-8 w-8 p-0 text-green-500"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={cancelEdit}
                          className="h-8 w-8 p-0 text-gray-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span>{name}</span>
                        <div className="flex items-center">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => startEditing(index)}
                            className="h-6 w-6 p-0 text-blue-500 mr-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => handleRemoveName(index, e)}
                            className="h-6 w-6 p-0 text-red-500"
                            type="button"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {names.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune femme de chambre configurée</p>
                )}
              </ScrollArea>
            </div>
              </div>
            </ScrollArea>
            
            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={resetToDefaults}>
                Réinitialiser
              </Button>
              <Button type="submit">Sauvegarder</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
