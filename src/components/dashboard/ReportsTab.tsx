/**
 * Composant Rapports
 * Extrait de Index.tsx pour modularité
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, AlertTriangle, Clock, FileText } from "lucide-react";
import { Room, CleaningConfig } from "@/services/pdfService";
import { StaffTimesheetPanel } from "@/components/timesheet/StaffTimesheetPanel";
import { InstructionTemplateSelector } from "@/components/templates/InstructionTemplateSelector";

interface ReportsTabProps {
  rooms: Room[];
  housekeeperNames: string[];
  cleaningConfig: CleaningConfig;
  isDistributed: boolean;
  hotelId?: string;
  onGenerateReport: (name: string, rooms: Room[]) => void;
  onGenerateAllReports: () => void;
}

export function ReportsTab({
  rooms,
  housekeeperNames,
  cleaningConfig,
  isDistributed,
  hotelId,
  onGenerateReport,
  onGenerateAllReports,
}: ReportsTabProps) {
  const [activeTab, setActiveTab] = useState("reports");

  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };

  const calculateHousekeeperLoad = (assignedRooms: Room[]): number => {
    return assignedRooms.reduce((total, room) => {
      if (room.cleaningType === 'full' || room.cleaningType === 'a_blanc') {
        return total + cleaningConfig.fullCleaningTime;
      } else if (room.cleaningType === 'quick' || room.cleaningType === 'recouche') {
        return total + cleaningConfig.quickCleaningTime;
      }
      return total;
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Rapports & Pointages</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reports" className="gap-2">
            <FileDown className="h-4 w-4" />
            Rapports PDF
          </TabsTrigger>
          <TabsTrigger value="timesheets" className="gap-2">
            <Clock className="h-4 w-4" />
            Pointages
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* PDF Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={onGenerateAllReports}
              disabled={!isDistributed || housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0).length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Générer tous les rapports
            </Button>
          </div>

          {!isDistributed ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Distribution requise</AlertTitle>
              <AlertDescription>
                Vous devez d'abord distribuer les chambres pour générer des rapports.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[calc(100vh-420px)] pr-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {housekeeperNames.map((name) => {
                  const housekeeperRooms = getHousekeeperRooms(name);
                  if (housekeeperRooms.length === 0) return null;
                  
                  return (
                    <Card key={name}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{name}</span>
                          <Badge variant="secondary">
                            {housekeeperRooms.length} chambres
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          <div className="text-sm">
                            <span className="font-medium">À Blanc:</span>{" "}
                            {housekeeperRooms.filter(r => r.cleaningType === 'full' || r.cleaningType === 'a_blanc').length}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Recouches:</span>{" "}
                            {housekeeperRooms.filter(r => r.cleaningType === 'quick' || r.cleaningType === 'recouche').length}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Temps estimé:</span>{" "}
                            {Math.round(calculateHousekeeperLoad(housekeeperRooms) / 60)}h
                          </div>
                        </div>
                        <Button
                          onClick={() => onGenerateReport(name, housekeeperRooms)}
                          className="w-full"
                          size="sm"
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          Générer rapport
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Timesheets Tab */}
        <TabsContent value="timesheets">
          {hotelId ? (
            <StaffTimesheetPanel hotelId={hotelId} />
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Hôtel non sélectionné</AlertTitle>
              <AlertDescription>
                Veuillez sélectionner un hôtel pour voir les pointages.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          {hotelId ? (
            <Card className="p-4">
              <h3 className="font-medium mb-4">Gérer les templates de consignes</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Créez et gérez vos templates pour les consignes du jour, à savoir et to-do. 
                Ces templates peuvent être réutilisés dans le workflow quotidien.
              </p>
              <TemplateManagerSection hotelId={hotelId} />
            </Card>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Hôtel non sélectionné</AlertTitle>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Separate Template Manager for the dedicated section
function TemplateManagerSection({ hotelId }: { hotelId: string }) {
  const [instructions, setInstructions] = useState("");
  const [toKnow, setToKnow] = useState("");
  const [todoList, setTodoList] = useState("");

  return (
    <InstructionTemplateSelector
      hotelId={hotelId}
      instructions={instructions}
      toKnow={toKnow}
      todoList={todoList}
      onInstructionsChange={setInstructions}
      onToKnowChange={setToKnow}
      onTodoListChange={setTodoList}
    />
  );
}