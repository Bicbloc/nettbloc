import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  Building2, 
  UserCheck, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  Plus,
  X,
  AlertCircle
} from "lucide-react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface GovernessAssignment {
  governessName: string;
  governessProfileId?: string;
  assignmentType: 'floor' | 'housekeeper';
  assignedFloors: number[];
  assignedHousekeepers: string[];
}

interface DailyInstructions {
  instructions: string;
  toKnow: string;
  todoList: string;
}

interface GovernessAssignmentStepProps {
  hotelId: string;
  housekeeperNames: string[];
  pdfData: any[];
  onComplete: (assignments: GovernessAssignment[], instructions: DailyInstructions) => void;
  onBack: () => void;
}

export function GovernessAssignmentStep({
  hotelId,
  housekeeperNames,
  pdfData,
  onComplete,
  onBack
}: GovernessAssignmentStepProps) {
  const [selectedGovernesses, setSelectedGovernesses] = useState<GovernessAssignment[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<'floor' | 'housekeeper'>('floor');
  const [instructions, setInstructions] = useState("");
  const [toKnow, setToKnow] = useState("");
  const [todoList, setTodoList] = useState("");

  // Get available floors from pdfData
  const availableFloors = [...new Set(
    pdfData
      .map(room => room.floor)
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n))
  )].sort((a, b) => a - b);

  // Query approved governesses for this hotel
  const { data: governesses, isLoading } = useQuery({
    queryKey: ["approved-governesses", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governess_access_requests")
        .select(`
          id,
          governess_profile_id,
          status,
          governess_profiles (
            id,
            name,
            email
          )
        `)
        .eq("hotel_id", hotelId)
        .eq("status", "approved");

      if (error) throw error;
      return data?.map(gar => ({
        id: gar.governess_profile_id,
        name: gar.governess_profiles?.name || "Gouvernante",
        email: gar.governess_profiles?.email
      })) || [];
    }
  });

  // Load today's existing instructions
  useEffect(() => {
    const loadExistingInstructions = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("daily_instructions")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("instruction_date", today)
        .maybeSingle();

      if (data) {
        setInstructions(data.instructions || "");
        setToKnow(data.to_know || "");
        setTodoList(data.todo_list || "");
      }
    };
    loadExistingInstructions();
  }, [hotelId]);

  const toggleGoverness = (governess: { id: string; name: string }) => {
    const existing = selectedGovernesses.find(g => g.governessName === governess.name);
    if (existing) {
      setSelectedGovernesses(prev => prev.filter(g => g.governessName !== governess.name));
    } else {
      setSelectedGovernesses(prev => [...prev, {
        governessName: governess.name,
        governessProfileId: governess.id,
        assignmentType: assignmentMode,
        assignedFloors: [],
        assignedHousekeepers: []
      }]);
    }
  };

  const updateGovernessAssignment = (
    governessName: string,
    field: 'assignedFloors' | 'assignedHousekeepers',
    value: number[] | string[]
  ) => {
    setSelectedGovernesses(prev => prev.map(g => 
      g.governessName === governessName 
        ? { ...g, [field]: value, assignmentType: field === 'assignedFloors' ? 'floor' : 'housekeeper' }
        : g
    ));
  };

  const toggleFloorForGoverness = (governessName: string, floor: number) => {
    const governess = selectedGovernesses.find(g => g.governessName === governessName);
    if (!governess) return;

    const newFloors = governess.assignedFloors.includes(floor)
      ? governess.assignedFloors.filter(f => f !== floor)
      : [...governess.assignedFloors, floor];
    
    updateGovernessAssignment(governessName, 'assignedFloors', newFloors);
  };

  const toggleHousekeeperForGoverness = (governessName: string, housekeeperName: string) => {
    const governess = selectedGovernesses.find(g => g.governessName === governessName);
    if (!governess) return;

    const newHousekeepers = governess.assignedHousekeepers.includes(housekeeperName)
      ? governess.assignedHousekeepers.filter(h => h !== housekeeperName)
      : [...governess.assignedHousekeepers, housekeeperName];
    
    updateGovernessAssignment(governessName, 'assignedHousekeepers', newHousekeepers);
  };

  const handleComplete = () => {
    onComplete(selectedGovernesses, {
      instructions,
      toKnow,
      todoList
    });
  };

  const canProceed = selectedGovernesses.length === 0 || 
    selectedGovernesses.every(g => 
      g.assignedFloors.length > 0 || g.assignedHousekeepers.length > 0
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Étape 4/5</Badge>
          Gouvernante(s) du jour & Consignes
        </DialogTitle>
        <DialogDescription>
          Sélectionnez les gouvernantes pour l'inspection et ajoutez les consignes du jour
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-6">
          {/* Section Gouvernantes */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Gouvernantes du jour (optionnel)
            </h3>

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                Chargement...
              </div>
            ) : governesses && governesses.length > 0 ? (
              <div className="space-y-3">
                {governesses.map((governess) => {
                  const isSelected = selectedGovernesses.some(g => g.governessName === governess.name);
                  const selectedData = selectedGovernesses.find(g => g.governessName === governess.name);

                  return (
                    <Card key={governess.id} className={`p-4 ${isSelected ? 'border-primary bg-primary/5' : ''}`}>
                      <div className="space-y-3">
                        {/* Header avec checkbox */}
                        <div 
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => toggleGoverness(governess)}
                        >
                          <Checkbox checked={isSelected} />
                          <div className="flex-1">
                            <div className="font-medium">{governess.name}</div>
                            <div className="text-sm text-muted-foreground">{governess.email}</div>
                          </div>
                          {isSelected && (
                            <Badge variant="default">Sélectionnée</Badge>
                          )}
                        </div>

                        {/* Options d'assignation si sélectionnée */}
                        {isSelected && (
                          <div className="pt-3 border-t space-y-3">
                            <Tabs defaultValue={assignmentMode} onValueChange={(v) => setAssignmentMode(v as any)}>
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="floor" className="gap-2">
                                  <Building2 className="h-4 w-4" />
                                  Par étage
                                </TabsTrigger>
                                <TabsTrigger value="housekeeper" className="gap-2">
                                  <Users className="h-4 w-4" />
                                  Par femme de chambre
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent value="floor" className="mt-3">
                                <div className="space-y-2">
                                  <Label className="text-sm">Étages à inspecter :</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {availableFloors.length > 0 ? availableFloors.map(floor => (
                                      <Button
                                        key={floor}
                                        variant={selectedData?.assignedFloors.includes(floor) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => toggleFloorForGoverness(governess.name, floor)}
                                      >
                                        Étage {floor}
                                      </Button>
                                    )) : (
                                      <span className="text-sm text-muted-foreground">
                                        Aucun étage détecté dans le rapport
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TabsContent>

                              <TabsContent value="housekeeper" className="mt-3">
                                <div className="space-y-2">
                                  <Label className="text-sm">Femmes de chambre à superviser :</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {housekeeperNames.map(name => (
                                      <Button
                                        key={name}
                                        variant={selectedData?.assignedHousekeepers.includes(name) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => toggleHousekeeperForGoverness(governess.name, name)}
                                      >
                                        {name}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Aucune gouvernante disponible</p>
                    <p className="text-sm">Invitez des gouvernantes depuis le menu Team</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Section Consignes du jour */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium flex items-center gap-2">
              📋 Consignes du jour
            </h3>
            <p className="text-sm text-muted-foreground">
              Ces informations seront visibles par les femmes de chambre sur leur application
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instructions">📣 Consignes</Label>
                <Textarea
                  id="instructions"
                  placeholder="Ex: VIP chambre 201, événement spécial au restaurant..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toKnow">💡 À savoir</Label>
                <Textarea
                  id="toKnow"
                  placeholder="Ex: Livraison linge à 10h, réunion à 14h..."
                  value={toKnow}
                  onChange={(e) => setToKnow(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="todoList">✅ To-do du jour</Label>
                <Textarea
                  id="todoList"
                  placeholder="Ex: Vérifier les stocks de produits, préparer chambres 301-305..."
                  value={todoList}
                  onChange={(e) => setTodoList(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button onClick={handleComplete} disabled={!canProceed}>
          Continuer
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );
}
