import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, UserPlus, Shuffle, X } from 'lucide-react';
import { Room } from '@/services/pdfService';
import { HousekeeperSetupDialog } from '@/components/HousekeeperSetupDialog';
import { redistributeRooms } from '@/utils/redistributionUtils';

interface UnassignedRoomsAlertProps {
  unassignedRooms: Room[];
  housekeeperNames: string[];
  onAddHousekeepers: (names: string[]) => void;
  onForceAssignment: (assignments: { housekeeper: string; rooms: Room[] }[]) => void;
  onDismiss: () => void;
}

export function UnassignedRoomsAlert({
  unassignedRooms,
  housekeeperNames,
  onAddHousekeepers,
  onForceAssignment,
  onDismiss
}: UnassignedRoomsAlertProps) {
  const [showHousekeeperDialog, setShowHousekeeperDialog] = useState(false);

  if (unassignedRooms.length === 0) return null;

  const handleForceAssignment = () => {
    if (housekeeperNames.length === 0) {
      return; // Cannot force assignment without housekeepers
    }

    // Utiliser la redistribution aléatoire équitable pour TOUTES les chambres non-assignées
    const redistributedRooms = redistributeRooms(unassignedRooms, housekeeperNames, 'random');
    
    // Grouper par femme de chambre assignée
    const assignments = housekeeperNames.map(housekeeper => ({
      housekeeper,
      rooms: redistributedRooms.filter(room => room.assignedTo === housekeeper)
    })).filter(assignment => assignment.rooms.length > 0);

    console.log('🔧 Attribution forcée générant:', assignments);
    onForceAssignment(assignments);
  };

  const maxRoomsPerHousekeeper = Math.ceil(unassignedRooms.length / Math.max(housekeeperNames.length, 1));
  const suggestedAdditionalHousekeepers = Math.max(0, Math.ceil(unassignedRooms.length / 15) - housekeeperNames.length);

  return (
    <div className="fixed bottom-4 right-4 max-w-md z-40">
      <Alert className="border-2 border-orange-500 bg-orange-50 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <AlertTitle className="text-orange-800">
                Chambres non-assignées
              </AlertTitle>
            </div>
            
            <AlertDescription className="text-orange-700 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="font-bold">
                  {unassignedRooms.length}
                </Badge>
                <span>chambres restent sans attribution</span>
              </div>
              
              {housekeeperNames.length > 0 && (
                <p className="text-sm">
                  Répartition actuelle : <strong>{maxRoomsPerHousekeeper} chambres max</strong> par femme de chambre
                </p>
              )}
              
              {suggestedAdditionalHousekeepers > 0 && (
                <p className="text-sm font-medium">
                  💡 Suggestion : Ajoutez {suggestedAdditionalHousekeepers} femme{suggestedAdditionalHousekeepers > 1 ? 's' : ''} de chambre pour une répartition optimale
                </p>
              )}
            </AlertDescription>
            
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowHousekeeperDialog(true)}
                className="flex items-center gap-1"
              >
                <UserPlus className="h-3 w-3" />
                Ajouter
              </Button>
              
              {housekeeperNames.length > 0 && (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={handleForceAssignment}
                  className="flex items-center gap-1"
                >
                  <Shuffle className="h-3 w-3" />
                  Forcer
                </Button>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="p-1 h-6 w-6 text-orange-600 hover:text-orange-700"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </Alert>

      {/* Dialog pour ajouter des femmes de chambre */}
      <HousekeeperSetupDialog
        isOpen={showHousekeeperDialog}
        onClose={() => setShowHousekeeperDialog(false)}
        onHousekeepersConfirmed={(newHousekeepers) => {
          // Ajouter les nouvelles femmes de chambre
          onAddHousekeepers(newHousekeepers);
          
          // Déclencher automatiquement l'attribution forcée après ajout
          if (newHousekeepers.length > 0) {
            setTimeout(() => {
              const allHousekeepers = [...housekeeperNames, ...newHousekeepers];
              const redistributedRooms = redistributeRooms(unassignedRooms, allHousekeepers, 'random');
              
              const assignments = allHousekeepers.map(housekeeper => ({
                housekeeper,
                rooms: redistributedRooms.filter(room => room.assignedTo === housekeeper)
              })).filter(assignment => assignment.rooms.length > 0);
              
              console.log('🎯 Auto-attribution après ajout:', assignments);
              onForceAssignment(assignments);
            }, 100); // Délai pour laisser le temps aux états de se mettre à jour
          }
          
          setShowHousekeeperDialog(false);
        }}
        roomCount={unassignedRooms.length}
        existingHousekeepers={housekeeperNames}
      />
    </div>
  );
}
