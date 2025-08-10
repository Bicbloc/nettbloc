import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ReportService } from '@/services/reportService';

export interface Room {
  number: string;
  status: 'libre' | 'occupée' | 'à nettoyer' | 'hors service' | 'en cours';
  housekeeper?: string;
  notes?: string;
  priority?: 'normal' | 'urgent';
  lastCleaned?: string;
  checkOut?: string;
  checkIn?: string;
  guestCount?: number;
  roomType?: string;
}

export interface ActionLogEntry {
  timestamp: string;
  action: string;
  room?: string;
  housekeeper?: string;
  details?: string;
}

interface HousekeepingContextType {
  roomData: Room[];
  setRoomData: (rooms: Room[]) => void;
  updateRoom: (roomNumber: string, updates: Partial<Room>) => void;
  housekeeperNames: string[];
  setHousekeeperNames: (names: string[]) => void;
  addHousekeeper: (name: string) => void;
  removeHousekeeper: (name: string) => void;
  housekeeperAssignments: Record<string, string[]>;
  setHousekeeperAssignments: (assignments: Record<string, string[]>) => void;
  assignRoomToHousekeeper: (roomNumber: string, housekeeperName: string) => void;
  unassignRoom: (roomNumber: string) => void;
  actionLog: ActionLogEntry[];
  addActionLog: (entry: Omit<ActionLogEntry, 'timestamp'>) => void;
  clearActionLog: () => void;
  lastSaved: Date | null;
  refreshHousekeepers: () => Promise<void>;
  isInitialized: boolean;
}

const HousekeepingContext = createContext<HousekeepingContextType | undefined>(undefined);

export const useHousekeeping = () => {
  const context = useContext(HousekeepingContext);
  if (context === undefined) {
    throw new Error('useHousekeeping must be used within a HousekeepingProvider');
  }
  return context;
};

export const HousekeepingProvider = ({ children }: { children: React.ReactNode }) => {
  const [roomData, setRoomData] = useState<Room[]>([]);
  const [housekeeperNames, setHousekeeperNames] = useState<string[]>([]);
  const [housekeeperAssignments, setHousekeeperAssignments] = useState<Record<string, string[]>>({});
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadData = () => {
      try {
        const savedRooms = localStorage.getItem('roomData');
        const savedHousekeepers = localStorage.getItem('housekeeperNames');
        const savedAssignments = localStorage.getItem('housekeeperAssignments');
        const savedActionLog = localStorage.getItem('actionLog');

        if (savedRooms) {
          setRoomData(JSON.parse(savedRooms));
        }
        if (savedHousekeepers) {
          setHousekeeperNames(JSON.parse(savedHousekeepers));
        }
        if (savedAssignments) {
          setHousekeeperAssignments(JSON.parse(savedAssignments));
        }
        if (savedActionLog) {
          setActionLog(JSON.parse(savedActionLog));
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading data from localStorage:', error);
        setIsInitialized(true);
      }
    };

    loadData();
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('roomData', JSON.stringify(roomData));
    }
  }, [roomData, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('housekeeperNames', JSON.stringify(housekeeperNames));
    }
  }, [housekeeperNames, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('housekeeperAssignments', JSON.stringify(housekeeperAssignments));
    }
  }, [housekeeperAssignments, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('actionLog', JSON.stringify(actionLog));
    }
  }, [actionLog, isInitialized]);

  const saveToSupabase = useCallback(async () => {
    if (!isInitialized || roomData.length === 0) {
      console.log('⏭️ Saut sauvegarde Supabase - pas initialisé ou pas de données');
      return;
    }

    try {
      console.log('💾 Sauvegarde vers Supabase...');
      
      const result = await ReportService.saveReport(
        roomData,
        housekeeperAssignments,
        housekeeperNames,
        actionLog
      );

      if (result.success) {
        console.log('✅ Sauvegarde Supabase réussie');
        setLastSaved(new Date());
        
        // Notify user of successful save
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('report-saved', { 
            detail: { report: result.report } 
          }));
        }
      } else {
        console.error('❌ Erreur sauvegarde Supabase:', result.error);
        
        // Notify user of save error
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('report-save-error', { 
            detail: { error: result.error } 
          }));
        }
      }
    } catch (error) {
      console.error('💥 Erreur lors de la sauvegarde Supabase:', error);
      
      // Notify user of save error
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('report-save-error', { 
          detail: { error: 'Erreur inattendue lors de la sauvegarde' } 
        }));
      }
    }
  }, [roomData, housekeeperAssignments, housekeeperNames, actionLog, isInitialized]);

  // Auto-save to Supabase every 30 seconds
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(saveToSupabase, 30000);
    return () => clearInterval(interval);
  }, [saveToSupabase, isInitialized]);

  // Save to Supabase when data changes (debounced)
  useEffect(() => {
    if (!isInitialized) return;

    const timeoutId = setTimeout(saveToSupabase, 2000);
    return () => clearTimeout(timeoutId);
  }, [roomData, housekeeperAssignments, housekeeperNames, actionLog, saveToSupabase, isInitialized]);

  const updateRoom = useCallback((roomNumber: string, updates: Partial<Room>) => {
    setRoomData(prev => prev.map(room => 
      room.number === roomNumber ? { ...room, ...updates } : room
    ));
  }, []);

  const addHousekeeper = useCallback((name: string) => {
    if (name && !housekeeperNames.includes(name)) {
      setHousekeeperNames(prev => [...prev, name]);
      setHousekeeperAssignments(prev => ({ ...prev, [name]: [] }));
    }
  }, [housekeeperNames]);

  const removeHousekeeper = useCallback((name: string) => {
    setHousekeeperNames(prev => prev.filter(n => n !== name));
    setHousekeeperAssignments(prev => {
      const newAssignments = { ...prev };
      delete newAssignments[name];
      return newAssignments;
    });
    // Remove housekeeper from room assignments
    setRoomData(prev => prev.map(room => 
      room.housekeeper === name ? { ...room, housekeeper: undefined } : room
    ));
  }, []);

  const assignRoomToHousekeeper = useCallback((roomNumber: string, housekeeperName: string) => {
    // Remove room from all other housekeepers
    setHousekeeperAssignments(prev => {
      const newAssignments = { ...prev };
      Object.keys(newAssignments).forEach(hk => {
        newAssignments[hk] = newAssignments[hk].filter(room => room !== roomNumber);
      });
      // Add room to the specified housekeeper
      if (!newAssignments[housekeeperName]) {
        newAssignments[housekeeperName] = [];
      }
      if (!newAssignments[housekeeperName].includes(roomNumber)) {
        newAssignments[housekeeperName].push(roomNumber);
      }
      return newAssignments;
    });

    // Update room data
    updateRoom(roomNumber, { housekeeper: housekeeperName });
  }, [updateRoom]);

  const unassignRoom = useCallback((roomNumber: string) => {
    setHousekeeperAssignments(prev => {
      const newAssignments = { ...prev };
      Object.keys(newAssignments).forEach(hk => {
        newAssignments[hk] = newAssignments[hk].filter(room => room !== roomNumber);
      });
      return newAssignments;
    });

    updateRoom(roomNumber, { housekeeper: undefined });
  }, [updateRoom]);

  const addActionLog = useCallback((entry: Omit<ActionLogEntry, 'timestamp'>) => {
    const newEntry: ActionLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };
    setActionLog(prev => [newEntry, ...prev].slice(0, 100)); // Keep only last 100 entries
  }, []);

  const clearActionLog = useCallback(() => {
    setActionLog([]);
  }, []);

  const refreshHousekeepers = useCallback(async () => {
    // This function can be used to refresh housekeepers from the database
    // For now, it's a placeholder that could be implemented to sync with Supabase
    console.log('Refreshing housekeepers...');
  }, []);

  const value: HousekeepingContextType = {
    roomData,
    setRoomData,
    updateRoom,
    housekeeperNames,
    setHousekeeperNames,
    addHousekeeper,
    removeHousekeeper,
    housekeeperAssignments,
    setHousekeeperAssignments,
    assignRoomToHousekeeper,
    unassignRoom,
    actionLog,
    addActionLog,
    clearActionLog,
    lastSaved,
    refreshHousekeepers,
    isInitialized
  };

  return (
    <HousekeepingContext.Provider value={value}>
      {children}
    </HousekeepingContext.Provider>
  );
};
