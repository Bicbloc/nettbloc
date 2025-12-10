import { useState, useCallback } from 'react';
import { Room } from '@/services/pdfService';
import { toast } from '@/hooks/use-toast';

interface UseHousekeeperManagementProps {
  housekeepers: any[];
  refreshHousekeepers?: () => void;
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
}

export function useHousekeeperManagement({ 
  housekeepers, 
  refreshHousekeepers,
  setRooms 
}: UseHousekeeperManagementProps) {
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>([]);
  const [housekeeperFloorPreferences, setHousekeeperFloorPreferences] = useState<Record<string, number[]>>({});
  const [housekeeperMaxRoomsOverrides, setHousekeeperMaxRoomsOverrides] = useState<Record<string, number>>({});

  const handleDeleteHousekeeper = useCallback(async (housekeeperName: string) => {
    setHousekeeperNames(prev => prev.filter(name => name !== housekeeperName));
    
    // Désactiver en base de données
    const housekeeper = housekeepers.find(h => h.name === housekeeperName);
    if (housekeeper) {
      try {
        const { SupabaseService } = await import('@/services/supabaseService');
        await SupabaseService.deactivateHousekeeper(housekeeper.id);
        refreshHousekeepers?.();
        console.log('✅ Femme de chambre désactivée en base:', housekeeperName);
      } catch (error) {
        console.error('❌ Erreur désactivation femme de chambre:', error);
      }
    }
    
    // Remove from floor preferences and max rooms overrides
    setHousekeeperFloorPreferences(prev => {
      const updated = { ...prev };
      delete updated[housekeeperName];
      return updated;
    });
    
    setHousekeeperMaxRoomsOverrides(prev => {
      const updated = { ...prev };
      delete updated[housekeeperName];
      return updated;
    });
  }, [housekeepers, refreshHousekeepers]);

  const handleRenameHousekeeper = useCallback((oldName: string, newName: string) => {
    if (!newName.trim() || (oldName !== newName && housekeeperNames.includes(newName))) {
      toast({
        variant: "destructive",
        title: "Nom invalide",
        description: "Le nom ne peut pas être vide ou déjà existant."
      });
      return;
    }
    
    setHousekeeperNames(prev => prev.map(name => name === oldName ? newName : name));
    
    setHousekeeperFloorPreferences(prev => {
      const updated = { ...prev };
      if (updated[oldName]) {
        updated[newName] = updated[oldName];
        delete updated[oldName];
      }
      return updated;
    });
    
    setHousekeeperMaxRoomsOverrides(prev => {
      const updated = { ...prev };
      if (updated[oldName]) {
        updated[newName] = updated[oldName];
        delete updated[oldName];
      }
      return updated;
    });
    
    setRooms(prevRooms => 
      prevRooms.map(room => 
        room.assignedTo === oldName ? { ...room, assignedTo: newName } : room
      )
    );
    
    toast({
      title: "Nom modifié",
      description: `"${oldName}" a été renommé en "${newName}".`
    });
  }, [housekeeperNames, setRooms]);

  const handleFloorPreferenceChange = useCallback((housekeeperName: string, floors: number[]) => {
    setHousekeeperFloorPreferences(prev => ({
      ...prev,
      [housekeeperName]: floors
    }));
  }, []);

  const handleMaxRoomsOverrideChange = useCallback((housekeeperName: string, maxRooms: number) => {
    setHousekeeperMaxRoomsOverrides(prev => ({
      ...prev,
      [housekeeperName]: maxRooms
    }));
  }, []);

  return {
    housekeeperNames,
    setHousekeeperNames,
    housekeeperFloorPreferences,
    setHousekeeperFloorPreferences,
    housekeeperMaxRoomsOverrides,
    setHousekeeperMaxRoomsOverrides,
    handleDeleteHousekeeper,
    handleRenameHousekeeper,
    handleFloorPreferenceChange,
    handleMaxRoomsOverrideChange
  };
}
