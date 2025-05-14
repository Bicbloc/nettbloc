
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
import { Settings, MinusSquare, PlusSquare } from "lucide-react";
import { CleaningConfig, defaultCleaningConfig } from "@/services/pdfService";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";

interface ConfigDialogProps {
  config: CleaningConfig;
  onConfigChange: (config: CleaningConfig) => void;
  onHousekeeperNamesChange: (names: string[]) => void;
  housekeeperNames: string[];
}

export function ConfigDialog({ 
  config, 
  onConfigChange, 
  onHousekeeperNamesChange, 
  housekeeperNames 
}: ConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>(housekeeperNames);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    // Update names when housekeeperNames prop changes
    setNames(housekeeperNames);
  }, [housekeeperNames]);

  const form = useForm<CleaningConfig>({
    defaultValues: config
  });

  const handleSubmit = (data: CleaningConfig) => {
    onConfigChange(data);
    onHousekeeperNamesChange(names);
    setOpen(false);
    
    toast({
      description: "Configuration sauvegardée"
    });
  };

  const handleAddName = () => {
    if (newName.trim()) {
      setNames([...names, newName.trim()]);
      setNewName("");
    }
  };

  const handleRemoveName = (index: number) => {
    const updatedNames = [...names];
    updatedNames.splice(index, 1);
    setNames(updatedNames);
    // Ne pas fermer la fenêtre après suppression
    toast({
      description: "Femme de chambre supprimée"
    });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuration du Nettoyage</DialogTitle>
          <DialogDescription>
            Configurez les paramètres de nettoyage et les femmes de chambre
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                  <FormLabel>Minimum de chambres par femme de chambre</FormLabel>
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
                  <FormLabel>Maximum de chambres par femme de chambre</FormLabel>
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
              
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {names.map((name, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                    <span>{name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveName(index)}
                      className="h-6 w-6 p-0 text-red-500"
                    >
                      &times;
                    </Button>
                  </div>
                ))}
                {names.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune femme de chambre configurée</p>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button type="submit">Sauvegarder</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
