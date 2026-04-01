/**
 * Composant Affectation des chambres
 * Extrait de Index.tsx pour modularité
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Calendar, Key, UserPlus, RefreshCw, ClipboardCheck } from "lucide-react";
import { Room, CleaningConfig } from "@/services/pdfService";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { RedistributionDialog, RedistributionMethod } from "@/components/RedistributionDialog";
import { HousekeeperCard } from "@/components/HousekeeperCard";
import { UnassignedRoomsColumn } from "@/components/UnassignedRoomsColumn";
import { CleanRoomsSection } from "@/components/CleanRoomsSection";
import { HousekeeperInviteDialog } from "@/components/HousekeeperInviteDialog";
import { InspectionRequestDialog } from "@/components/InspectionRequestDialog";
import { CreateColumnDialog } from "@/components/CreateColumnDialog";
import { useState, useEffect, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { RoomStatusTabs, RoomFilterTab, filterRoomsByTab, calculateRoomCounts } from "@/components/RoomStatusTabs";
import { SimplifiedRoomList } from "./SimplifiedRoomList";

interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  user_id: string;
}

interface AssignmentTabProps {
  rooms: Room[];
  housekeeperNames: string[];
  housekeepers: Housekeeper[];
  cleaningConfig: CleaningConfig;
  currentHotelId: string | null;
  hotelId: string;
  availableFloors: number[];
  housekeeperFloorPreferences: Record<string, number[]>;
  housekeeperMaxRoomsOverrides: Record<string, number>;
  isDistributed: boolean;
  onPdfProcessed: (data: Room[], housekeepers?: string[], method?: 'random' | 'floor' | 'cleaning-type') => void;
  onRedistribute: (method: RedistributionMethod, selectedHousekeepers: string[]) => void;
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onRoomReassign: (room: Room, newHousekeeper: string | null) => void;
  onDirectAssign: (roomNumber: string, housekeeperName: string) => void;
  onFloorPreferenceChange: (name: string, floors: number[]) => void;
  onDeleteHousekeeper: (name: string) => void;
  onMaxRoomsOverrideChange: (name: string, maxRooms: number | undefined) => void;
  onRenameHousekeeper: (oldName: string, newName: string) => void;
  onGenerateReport: (name: string, rooms: Room[]) => void;
  onGenerateAccessCode: (housekeeperName: string) => Promise<string>;
  onOpenManualAssignment: (name?: string) => void;
  setActiveTab: (tab: string) => void;
}

export function AssignmentTab({
  rooms,
  housekeeperNames,
  housekeepers,
  cleaningConfig,
  currentHotelId,
  hotelId,
  availableFloors,
  housekeeperFloorPreferences,
  housekeeperMaxRoomsOverrides,
  isDistributed,
  onPdfProcessed,
  onRedistribute,
  onRoomUpdate,
  onRoomUnassign,
  onRoomReassign,
  onDirectAssign,
  onFloorPreferenceChange,
  onDeleteHousekeeper,
  onMaxRoomsOverrideChange,
  onRenameHousekeeper,
  onGenerateReport,
  onGenerateAccessCode,
  onOpenManualAssignment,
  setActiveTab,
}: AssignmentTabProps) {
  const [isRedistributionDialogOpen, setIsRedistributionDialogOpen] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateColumnDialog, setShowCreateColumnDialog] = useState(false);
  const [activeColumns, setActiveColumns] = useState<string[]>([]);
  const [roomFilterTab, setRoomFilterTab] = useState<RoomFilterTab>('all');
  const queryClient = useQueryClient();
  
  // Realtime handles live updates — no polling needed
  
  // Calculate room counts for tabs
  const roomCounts = useMemo(() => {
    return calculateRoomCounts(rooms.map(r => ({
      status: r.status,
      cleaningType: r.cleaningType
    })));
  }, [rooms]);
  
  // Apply tab filter to rooms
  const filteredRooms = useMemo(() => {
    return filterRoomsByTab(rooms.map(r => ({
      ...r,
      cleaningType: r.cleaningType
    })), roomFilterTab) as Room[];
  }, [rooms, roomFilterTab]);

  const isSimplifiedView = roomFilterTab !== 'all';

  const getTabTitle = (tab: RoomFilterTab) => {
    switch (tab) {
      case 'clean':
        return 'Chambres propres';
      case 'in_progress':
        return 'Chambres en cours';
      case 'dirty':
        return 'Chambres à nettoyer';
      case 'stayover':
        return 'Chambres recouche';
      case 'checkout':
        return 'Chambres client sorti';
      default:
        return 'Toutes les chambres';
    }
  };

  const getHousekeeperRooms = (name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  };

  const getUnassignedRooms = () => {
    return rooms.filter(room => 
      !room.assignedTo && 
      room.cleaningType !== 'none' && 
      room.status !== 'maintenance' &&
      room.status !== 'clean'
    );
  };

  const getCleanRooms = () => {
    return rooms.filter(room => 
      room.status === 'clean' &&
      room.cleaningType !== 'none'
    );
  };

  const handleRedistributeMethod = (method: RedistributionMethod, selectedHousekeepers: string[]) => {
    onRedistribute(method, selectedHousekeepers);
    setIsRedistributionDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Affectation des chambres</h2>
        <div className="flex flex-wrap gap-2">
          <PdfWorkflowDialog 
            hotelId={currentHotelId}
            onWorkflowComplete={onPdfProcessed}
          />
          <Button
            onClick={() => onOpenManualAssignment()}
            variant="outline"
            disabled={housekeeperNames.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Assignation manuelle
          </Button>
          <Button
            onClick={() => setIsRedistributionDialogOpen(true)}
            variant="outline"
            disabled={housekeeperNames.length === 0 || rooms.length === 0}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Redistribuer
          </Button>
        </div>
      </div>

      <RedistributionDialog
        isOpen={isRedistributionDialogOpen}
        onClose={() => setIsRedistributionDialogOpen(false)}
        onRedistribute={handleRedistributeMethod}
        housekeeperCount={housekeeperNames.length}
        roomCount={rooms.length}
        housekeeperNames={housekeeperNames}
        onAddHousekeeper={() => {
          setIsRedistributionDialogOpen(false);
          setShowInviteDialog(true);
        }}
      />

      {/* Onglets de filtrage par statut */}
      {rooms.length > 0 && housekeeperNames.length > 0 && (
        <RoomStatusTabs
          activeTab={roomFilterTab}
          onTabChange={setRoomFilterTab}
          counts={roomCounts}
        />
      )}

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune chambre à affecter</h3>
            <p className="text-muted-foreground text-center mb-4">
              Importez d'abord un fichier PDF avec la liste des chambres
            </p>
            <PdfWorkflowDialog 
              hotelId={currentHotelId}
              onWorkflowComplete={onPdfProcessed}
            />
          </CardContent>
        </Card>
      ) : housekeeperNames.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune femme de chambre</h3>
            <p className="text-muted-foreground text-center mb-4">
              Ajoutez des femmes de chambre pour commencer l'affectation
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowInviteDialog(true)}>
                Inviter une femme de chambre
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('access-codes')}>
                Gérer l'équipe
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        isSimplifiedView ? (
          <SimplifiedRoomList
            rooms={filteredRooms}
            title={getTabTitle(roomFilterTab)}
            emptyMessage="Aucune chambre dans cette catégorie"
          />
        ) : (
        <div className="space-y-6">
          {/* Chambres non assignées */}
          <UnassignedRoomsColumn
            rooms={getUnassignedRooms()}
            onRoomUpdate={onRoomUpdate}
            allRooms={rooms}
            forceHide={false}
            housekeeperNames={housekeeperNames}
            onDirectAssign={onDirectAssign}
            hotelId={currentHotelId || undefined}
          />

          {/* Section Chambres propres */}
          <CleanRoomsSection
            rooms={getCleanRooms()}
            onRoomUpdate={onRoomUpdate}
            hotelId={currentHotelId || undefined}
          />

          {/* Info codes d'accès */}
          {housekeeperNames.some(name => getHousekeeperRooms(name).length > 0) && (
            <Alert className="bg-blue-50 border-blue-200">
              <Key className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Codes d'accès mobile :</strong> Chaque colonne affiche le code d'accès 
                spécifique à chaque femme de chambre pour l'interface mobile.
              </AlertDescription>
            </Alert>
          )}

          {/* Grille des femmes de chambre */}
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-2">
            {housekeeperNames.map((name) => {
              const housekeeperRooms = getHousekeeperRooms(name);
              const isActiveColumn = activeColumns.includes(name);
              
              // Afficher si a des chambres OU si colonne activée manuellement
              if (housekeeperRooms.length === 0 && !isActiveColumn) return null;
              
              const housekeeper = housekeepers.find(h => h.name === name);
              return (
                <div key={name} className="min-w-0 w-full">
                  <HousekeeperCard
                    name={name}
                    rooms={housekeeperRooms}
                    cleaningConfig={cleaningConfig}
                    onGenerateReport={onGenerateReport}
                    onRoomUpdate={onRoomUpdate}
                    onRoomUnassign={onRoomUnassign}
                    onReassign={onRoomReassign}
                    availableFloors={availableFloors}
                    onFloorPreferenceChange={onFloorPreferenceChange}
                    preferredFloors={housekeeperFloorPreferences[name] || []}
                    onDelete={(deletedName) => {
                      setActiveColumns(prev => prev.filter(n => n !== deletedName));
                      onDeleteHousekeeper(deletedName);
                    }}
                    maxRoomsOverride={housekeeperMaxRoomsOverrides[name]}
                    onMaxRoomsOverrideChange={onMaxRoomsOverrideChange}
                    onRename={(newName: string) => {
                      setActiveColumns(prev => prev.map(n => n === name ? newName : n));
                      onRenameHousekeeper(name, newName);
                    }}
                    accessCode={housekeeper?.access_code || ''}
                    housekeeperNames={housekeeperNames}
                    onGenerateAccessCode={onGenerateAccessCode}
                    hotelId={currentHotelId || undefined}
                  />
                </div>
              );
            })}
            
            {/* Bouton pour créer une nouvelle colonne */}
            <div className="min-w-0 w-full">
              <Card 
                className="border-2 border-dashed border-muted-foreground/30 bg-muted/10 hover:border-primary/50 hover:bg-muted/20 transition-all cursor-pointer h-full min-h-[200px] flex items-center justify-center"
                onClick={() => setShowCreateColumnDialog(true)}
              >
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="p-4 rounded-full bg-primary/10 mb-4">
                    <UserPlus className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Créer une colonne</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Sélectionnez une femme de chambre existante ou ajoutez-en une nouvelle
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Dialogs */}
          <HousekeeperInviteDialog
            open={showInviteDialog}
            onOpenChange={setShowInviteDialog}
            hotelId={hotelId}
          />
          
          <CreateColumnDialog
            open={showCreateColumnDialog}
            onOpenChange={setShowCreateColumnDialog}
            hotelId={currentHotelId || ''}
            assignedHousekeeperNames={[
              ...housekeeperNames.filter(name => getHousekeeperRooms(name).length > 0),
              ...activeColumns
            ]}
            onSelectExisting={(name) => {
              setActiveColumns(prev => [...prev, name]);
              toast({
                description: `Colonne ${name} créée. Assignez-lui des chambres.`
              });
            }}
          />
        </div>
        )
      )}
    </div>
  );
}
