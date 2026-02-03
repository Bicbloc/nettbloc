import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  Building2, 
  UserCheck, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle,
  ClipboardList
} from "lucide-react";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { InstructionTemplateSelector } from "@/components/templates/InstructionTemplateSelector";
import { ManualTaskManager } from "@/components/tasks/ManualTaskManager";

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
  const [activeTab, setActiveTab] = useState<'governess' | 'instructions' | 'tasks'>('governess');

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

  // Allow proceeding if no governesses selected, or if governesses are selected (assignment is optional)
  const canProceed = true;

  // Fetch governess names for tasks
  const governessNamesList = governesses?.map(g => g.name) || [];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Étape 4/5</Badge>
          Personnel du jour & Consignes
        </DialogTitle>
        <DialogDescription>
          Gouvernantes, consignes et tâches manuelles pour la journée
        </DialogDescription>
      </DialogHeader>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="governess" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Gouvernantes
          </TabsTrigger>
          <TabsTrigger value="instructions" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Consignes
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tâches
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="max-h-[55vh] mt-4 pr-4">
          {/* Gouvernantes Tab */}
          <TabsContent value="governess" className="mt-0">
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
                                    Par FdC
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
                                          Aucun étage détecté
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TabsContent>

                                <TabsContent value="housekeeper" className="mt-3">
                                  <div className="space-y-2">
                                    <Label className="text-sm">FdC à superviser :</Label>
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
          </TabsContent>

          {/* Instructions Tab */}
          <TabsContent value="instructions" className="mt-0">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">📋 Consignes du jour</h3>
                <p className="text-sm text-muted-foreground">
                  Visibles par les femmes de chambre sur leur application
                </p>
              </div>

              <InstructionTemplateSelector
                hotelId={hotelId}
                instructions={instructions}
                toKnow={toKnow}
                todoList={todoList}
                onInstructionsChange={setInstructions}
                onToKnowChange={setToKnow}
                onTodoListChange={setTodoList}
              />
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-0">
            <ManualTaskManager
              hotelId={hotelId}
              housekeeperNames={housekeeperNames}
              governessNames={governessNamesList}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>

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
