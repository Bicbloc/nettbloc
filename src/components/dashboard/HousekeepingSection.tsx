import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { HousekeeperCard } from '@/components/HousekeeperCard';
import { UnassignedRoomsColumn } from '@/components/UnassignedRoomsColumn';
import { QuickAddHousekeeperButton } from '@/components/QuickAddHousekeeperButton';
import { SyncHousekeepersButton } from '@/components/SyncHousekeepersButton';
import { Room, CleaningConfig } from '@/services/pdfService';

interface HousekeepingSectionProps {
  housekeeperNames: string[];
  rooms: Room[];
  isDistributed: boolean;
  cleaningConfig: CleaningConfig;
  availableFloors: number[];
  housekeeperFloorPreferences: Record<string, number[]>;
  housekeeperMaxRoomsOverrides: Record<string, number>;
  onManualAssignment: (housekeeperName: string) => void;
  onShowManagement: () => void;
  onRoomUpdate: (room: Room) => void;
  onRoomUnassign: (room: Room) => void;
  onReassign: (room: Room, newHousekeeper: string | null) => void;
  onGenerateReport: (name: string, rooms: Room[]) => void;
  onFloorPreferenceChange: (name: string, floors: number[]) => void;
  onDelete: (name: string) => void;
  onMaxRoomsOverrideChange: (name: string, maxRooms: number) => void;
  onRename: (oldName: string, newName: string) => void;
  onGenerateAccessCode: (housekeeperName: string) => void;
}

export function HousekeepingSection({
  housekeeperNames,
  rooms,
  isDistributed,
  cleaningConfig,
  availableFloors,
  housekeeperFloorPreferences,
  housekeeperMaxRoomsOverrides,
  onManualAssignment,
  onShowManagement,
  onRoomUpdate,
  onRoomUnassign,
  onReassign,
  onGenerateReport,
  onFloorPreferenceChange,
  onDelete,
  onMaxRoomsOverrideChange,
  onRename,
  onGenerateAccessCode
}: HousekeepingSectionProps) {
  const unassignedRooms = rooms.filter(r => !r.assignedTo && r.status !== 'Propre');

  return (
    <div className="space-y-4">
      {/* Header avec actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-card/50 p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            Équipe ({housekeeperNames.length})
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <QuickAddHousekeeperButton />
          <SyncHousekeepersButton />
          <Button
            variant="outline"
            size="sm"
            onClick={onShowManagement}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Gérer l'équipe
          </Button>
        </div>
      </div>

      {/* Liste des femmes de chambre */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Chambres non assignées */}
        {unassignedRooms.length > 0 && (
          <Card className="bg-muted/50 border-dashed">
            <UnassignedRoomsColumn
              rooms={unassignedRooms}
              onRoomUpdate={onRoomUpdate}
              allRooms={rooms}
              housekeeperNames={housekeeperNames}
            />
          </Card>
        )}

        {/* Cartes des femmes de chambre */}
        {housekeeperNames.map((name) => {
          const housekeeperRooms = rooms.filter(r => r.assignedTo === name);
          return (
            <Card key={name} className="hover:shadow-md transition-shadow">
              <HousekeeperCard
                name={name}
                rooms={housekeeperRooms}
                onRoomUpdate={onRoomUpdate}
                onRoomUnassign={onRoomUnassign}
                onReassign={onReassign}
                onGenerateReport={onGenerateReport}
                cleaningConfig={cleaningConfig}
                availableFloors={availableFloors}
                onFloorPreferenceChange={onFloorPreferenceChange}
                preferredFloors={housekeeperFloorPreferences[name] || []}
                onManualAssign={() => onManualAssignment(name)}
                unassignedRooms={unassignedRooms}
                showUnassignedColumn={false}
                onDelete={onDelete}
                maxRoomsOverride={housekeeperMaxRoomsOverrides[name] || 0}
                onMaxRoomsOverrideChange={onMaxRoomsOverrideChange}
                onRename={(newName) => onRename(name, newName)}
                housekeeperNames={housekeeperNames}
                onGenerateAccessCode={onGenerateAccessCode}
              />
            </Card>
          );
        })}
      </div>

      {housekeeperNames.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Aucune femme de chambre</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Commencez par ajouter des membres à votre équipe
          </p>
          <QuickAddHousekeeperButton />
        </Card>
      )}
    </div>
  );
}
