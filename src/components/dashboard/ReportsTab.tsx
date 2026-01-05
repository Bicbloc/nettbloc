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
import { FileDown, AlertTriangle, FileText, Settings } from "lucide-react";
import { Room, CleaningConfig } from "@/services/pdfService";
import { ReportTemplateManager } from "@/components/ReportTemplateManager";

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
  const [showTemplateManager, setShowTemplateManager] = useState(false);

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
        <h2 className="text-2xl font-bold">Rapports</h2>
        <div className="flex gap-2">
          {hotelId && (
            <Button 
              variant="outline" 
              onClick={() => setShowTemplateManager(true)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Gérer les templates
            </Button>
          )}
          <Button
            onClick={onGenerateAllReports}
            disabled={!isDistributed || housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0).length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Générer tous les rapports
          </Button>
        </div>
      </div>

      {/* Carte explicative des templates */}
      {hotelId && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900">Templates de rapport</h3>
                <p className="text-sm text-purple-700 mt-1">
                  Créez des templates pour vos instructions et tâches récurrentes. 
                  Ils seront disponibles lors de la génération des rapports.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-purple-300 text-purple-700 hover:bg-purple-100"
                onClick={() => setShowTemplateManager(true)}
              >
                <Settings className="mr-1 h-4 w-4" />
                Configurer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isDistributed ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Distribution requise</AlertTitle>
          <AlertDescription>
            Vous devez d'abord distribuer les chambres pour générer des rapports.
          </AlertDescription>
        </Alert>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)] pr-4">
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

      {/* Template Manager Dialog */}
      {hotelId && (
        <ReportTemplateManager
          open={showTemplateManager}
          onOpenChange={setShowTemplateManager}
          hotelId={hotelId}
        />
      )}
    </div>
  );
}