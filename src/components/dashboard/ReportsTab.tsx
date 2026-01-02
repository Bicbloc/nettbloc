/**
 * Composant Rapports
 * Extrait de Index.tsx pour modularité
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, AlertTriangle } from "lucide-react";
import { Room, CleaningConfig } from "@/services/pdfService";

interface ReportsTabProps {
  rooms: Room[];
  housekeeperNames: string[];
  cleaningConfig: CleaningConfig;
  isDistributed: boolean;
  onGenerateReport: (name: string, rooms: Room[]) => void;
  onGenerateAllReports: () => void;
}

export function ReportsTab({
  rooms,
  housekeeperNames,
  cleaningConfig,
  isDistributed,
  onGenerateReport,
  onGenerateAllReports,
}: ReportsTabProps) {
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Rapports</h2>
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
        <ScrollArea className="h-[calc(100vh-280px)] pr-4">
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
    </div>
  );
}
