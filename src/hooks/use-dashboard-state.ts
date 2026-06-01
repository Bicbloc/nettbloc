/**
 * Hook centralisé pour l'état du dashboard admin
 * Remplace les 50+ useState dans Index.tsx
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Room, CleaningConfig, getDefaultCleaningConfig } from '@/services/pdfService';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { useAutoSetup } from '@/hooks/use-auto-setup';
import { useFirstTimeSetup } from '@/components/FirstTimeSetupWizard';
import { useRoomManagement } from '@/hooks/use-room-management';
import { useHousekeeperManagement } from '@/hooks/use-housekeeper-management';
import { useDashboardDialogs } from '@/hooks/use-dashboard-dialogs';
import { useSubscription } from '@/hooks/useSubscription';
import { useReportEmail } from '@/hooks/use-report-email';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useSessionTracking } from '@/hooks/use-session-tracking';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ReportFields as CustomReportFields } from '@/components/ReportCustomFields';
import { cleanupInvalidHotelIds } from '@/lib/utils';

export interface DashboardState {
  // Core state
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cleaningConfig: CleaningConfig;
  setCleaningConfig: (config: CleaningConfig) => void;
  
  // Hotel & setup
  hotel: any;
  currentHotelId: string | null;
  isSetupComplete: boolean;
  setupLoading: boolean;
  needsSetup: boolean;
  showSetupWizard: boolean;
  setShowSetupWizard: (show: boolean) => void;
  
  // Subscription
  isPremium: boolean;
  isFree: boolean;
  subscriptionLoading: boolean;
  
  // Housekeeping context
  housekeeperNames: string[];
  setHousekeeperNames: (names: string[]) => void;
  rooms: Room[];
  setRooms: (rooms: Room[] | ((prev: Room[]) => Room[])) => void;
  isDistributed: boolean;
  setIsDistributed: (distributed: boolean) => void;
  housekeepers: any[];
  refreshHousekeepers: () => void;
  
  // Room management
  handleRoomUpdate: (room: Room) => void;
  handleRoomUnassign: (roomNumber: string) => void;
  handleRoomReassign: (roomNumber: string, newHousekeeper: string) => void;
  handleAddRoom: (room: Room) => void;
  handleDeleteRoom: (roomNumber: string) => void;
  handleLinkRooms: (roomNumber: string, linkedRooms: string[]) => void;
  
  // Housekeeper management
  housekeeperFloorPreferences: Record<string, number[]>;
  setHousekeeperFloorPreferences: (prefs: Record<string, number[]>) => void;
  housekeeperMaxRoomsOverrides: Record<string, number>;
  setHousekeeperMaxRoomsOverrides: (overrides: Record<string, number>) => void;
  handleDeleteHousekeeper: (name: string) => void;
  handleRenameHousekeeper: (oldName: string, newName: string) => void;
  
  // Dialogs
  dialogState: ReturnType<typeof useDashboardDialogs>;
  
  // Email & reports
  email: string;
  setEmail: (email: string) => void;
  reportCustomFields: CustomReportFields;
  setReportCustomFields: (fields: CustomReportFields) => void;
  
  // Filters & misc
  filteredRooms: Room[] | null;
  setFilteredRooms: (rooms: Room[] | null) => void;
  availableFloors: number[];
  setAvailableFloors: (floors: number[]) => void;
  existingHousekeepers: string[];
  recommendedHousekeepers: number;
  
  // Realtime
  realtimeSync: ReturnType<typeof useRealtimeSync>;
  
  // Helpers
  getHousekeeperRooms: (name: string) => Room[];
  getUnassignedRooms: () => Room[];
  getCleanRooms: () => Room[];
  calculateHousekeeperLoad: (assignedRooms: Room[]) => number;
}

export function useDashboardState(): DashboardState {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Session tracking
  useSessionTracking();
  
  // Subscription
  const { isPremium, isFree, loading: subscriptionLoading } = useSubscription();
  
  // Core states
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('nettobloc_admin_tab') || 'overview';
  });
  const [cleaningConfig, setCleaningConfig] = useState<CleaningConfig>(getDefaultCleaningConfig(isPremium));
  
  // Housekeeping context
  const { 
    housekeeperNames, 
    setHousekeeperNames,
    rooms,
    setRooms,
    isDistributed,
    setIsDistributed,
    housekeepers,
    refreshHousekeepers
  } = useHousekeeping();
  
  // Auto-setup
  const { hotel, isSetupComplete, loading: setupLoading } = useAutoSetup();
  const currentHotelId = hotel?.id || null;
  
  // First time setup
  const { needsSetup, loading: setupCheckLoading } = useFirstTimeSetup(currentHotelId);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  
  // Room management hook
  const roomManagement = useRoomManagement({
    hotelId: currentHotelId,
    rooms,
    setRooms,
    housekeepers,
    refreshHousekeepers
  });
  
  // Housekeeper management hook
  const housekeeperManagement = useHousekeeperManagement({
    housekeeperNames,
    setHousekeeperNames,
    setRooms,
    housekeepers,
    refreshHousekeepers
  });
  
  // Dialogs hook
  const dialogState = useDashboardDialogs();
  
  // Email & reports
  const { email, setEmail } = useReportEmail();
  const [reportCustomFields, setReportCustomFields] = useState<CustomReportFields>({ 
    toDoItems: [], 
    toKnowItems: [] 
  });
  
  // Filters & misc
  const [filteredRooms, setFilteredRooms] = useState<Room[] | null>(null);
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);
  const [existingHousekeepers, setExistingHousekeepers] = useState<string[]>([]);
  const [recommendedHousekeepers, setRecommendedHousekeepers] = useState<number>(0);
  
  // Realtime sync handler
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (table === 'rooms' && (eventType === 'UPDATE' || eventType === 'INSERT')) {
      setRooms(prev => {
        const existingIndex = prev.findIndex(r => r.number === newRecord.room_number);
        if (existingIndex !== -1) {
          return prev.map((r, i) => {
            if (i !== existingIndex) return r;
            // Normalize cleaning_type from database to UI format
            let normalizedCleaningType: 'a_blanc' | 'recouche' | 'none' = r.cleaningType as any;
            if (newRecord.cleaning_type === 'full' || newRecord.cleaning_type === 'a_blanc') {
              normalizedCleaningType = 'a_blanc';
            } else if (newRecord.cleaning_type === 'quick' || newRecord.cleaning_type === 'recouche') {
              normalizedCleaningType = 'recouche';
            }
            return { 
              ...r, 
              status: newRecord.status,
              cleaningType: normalizedCleaningType,
              notes: newRecord.notes || r.notes,
              lastCleanedAt: newRecord.status === 'clean'
                ? (newRecord.last_cleaned_at || new Date().toISOString())
                : (newRecord.last_cleaned_at || r.lastCleanedAt)
            };
          });
        }
        return prev;
      });

      if (newRecord.status === 'clean') {
        toast({
          title: "✅ Chambre nettoyée",
          description: `Chambre ${newRecord.room_number} marquée propre`,
          duration: 4000
        });
      }
    }
    
    if (table === 'assignments' && (eventType === 'INSERT' || eventType === 'UPDATE')) {
      if (newRecord.status === 'completed' && currentHotelId) {
        setTimeout(() => refreshHousekeepers?.(), 500);
      }
    }
  }, [currentHotelId, refreshHousekeepers, setRooms]);

  // Realtime sync
  const realtimeSync = useRealtimeSync({
    hotelId: currentHotelId || undefined,
    tables: ['rooms', 'assignments'],
    onUpdate: handleRealtimeUpdate
  });
  
  // Effects
  useEffect(() => {
    cleanupInvalidHotelIds();
  }, []);
  
  useEffect(() => {
    localStorage.setItem('nettobloc_admin_tab', activeTab);
  }, [activeTab]);
  
  useEffect(() => {
    if (!setupCheckLoading && needsSetup && currentHotelId) {
      setShowSetupWizard(true);
    }
  }, [needsSetup, setupCheckLoading, currentHotelId]);
  
  useEffect(() => {
    if (!subscriptionLoading) {
      setCleaningConfig(prevConfig => ({
        ...getDefaultCleaningConfig(isPremium),
        fullCleaningTime: prevConfig.fullCleaningTime,
        quickCleaningTime: prevConfig.quickCleaningTime
      }));
    }
  }, [isPremium, subscriptionLoading]);
  
  // Load existing housekeepers
  useEffect(() => {
    const loadExistingHousekeepers = async () => {
      if (!currentHotelId) return;
      
      try {
        const { data: hkList } = await supabase
          .from('housekeepers')
          .select('id, name, is_active')
          .eq('hotel_id', currentHotelId)
          .eq('is_active', true);

        const hkById = new Map<string, string>();
        (hkList || []).forEach((h: any) => hkById.set(h.id, h.name));

        const { data: sessions } = await supabase
          .from('user_sessions')
          .select('housekeeper_id, user_name, last_activity')
          .eq('hotel_id', currentHotelId)
          .eq('user_type', 'housekeeper')
          .order('last_activity', { ascending: false });

        const ordered: string[] = [];
        const seen = new Set<string>();

        (sessions || []).forEach((s: any) => {
          const name = (s.housekeeper_id && hkById.get(s.housekeeper_id)) || s.user_name;
          if (name && !seen.has(name)) { seen.add(name); ordered.push(name); }
        });

        (hkList || []).forEach((h: any) => {
          if (!seen.has(h.name)) { seen.add(h.name); ordered.push(h.name); }
        });

        setExistingHousekeepers(ordered);
      } catch (error) {
        console.error('Erreur chargement femmes de chambre:', error);
      }
    };

    loadExistingHousekeepers();
  }, [currentHotelId]);
  
  // Calculate recommended housekeepers
  useEffect(() => {
    if (rooms.length === 0) return;
    
    const roomsToClean = rooms.filter(room => room.cleaningType !== 'none' && room.status !== 'maintenance');
    const totalTime = roomsToClean.reduce((total, room) => {
      if (room.cleaningType === 'full') return total + cleaningConfig.fullCleaningTime;
      if (room.cleaningType === 'quick') return total + cleaningConfig.quickCleaningTime;
      return total;
    }, 0);
    
    const averageTimePerHousekeeper = 360; // 6 hours
    setRecommendedHousekeepers(Math.ceil(totalTime / averageTimePerHousekeeper));
  }, [rooms, cleaningConfig]);
  
  // Helper functions
  const getHousekeeperRooms = useCallback((name: string) => {
    return rooms.filter(room => room.assignedTo === name);
  }, [rooms]);
  
  const getUnassignedRooms = useCallback(() => {
    return rooms.filter(room => 
      !room.assignedTo && 
      room.cleaningType !== 'none' && 
      room.status !== 'maintenance' &&
      room.status !== 'clean'
    );
  }, [rooms]);
  
  const getCleanRooms = useCallback(() => {
    return rooms.filter(room => 
      room.status === 'clean' &&
      room.cleaningType !== 'none'
    );
  }, [rooms]);
  
  const calculateHousekeeperLoad = useCallback((assignedRooms: Room[]) => {
    return assignedRooms.reduce((total, room) => {
      if (room.cleaningType === 'full') return total + cleaningConfig.fullCleaningTime;
      if (room.cleaningType === 'quick') return total + cleaningConfig.quickCleaningTime;
      return total;
    }, 0);
  }, [cleaningConfig]);

  return {
    // Core state
    activeTab,
    setActiveTab,
    cleaningConfig,
    setCleaningConfig,
    
    // Hotel & setup
    hotel,
    currentHotelId,
    isSetupComplete,
    setupLoading,
    needsSetup,
    showSetupWizard,
    setShowSetupWizard,
    
    // Subscription
    isPremium,
    isFree,
    subscriptionLoading,
    
    // Housekeeping context
    housekeeperNames,
    setHousekeeperNames,
    rooms,
    setRooms,
    isDistributed,
    setIsDistributed,
    housekeepers,
    refreshHousekeepers,
    
    // Room management
    handleRoomUpdate: roomManagement.handleRoomUpdate,
    handleRoomUnassign: (roomNumber: string) => {
      const room = rooms.find(r => r.number === roomNumber);
      if (room) roomManagement.handleRoomUnassign(room);
    },
    handleRoomReassign: (roomNumber: string, newHousekeeper: string) => {
      const room = rooms.find(r => r.number === roomNumber);
      if (room) roomManagement.handleRoomReassign(room, newHousekeeper);
    },
    handleAddRoom: roomManagement.handleAddRoom,
    handleDeleteRoom: roomManagement.handleDeleteRoom,
    handleLinkRooms: roomManagement.handleLinkRooms,
    
    // Housekeeper management
    housekeeperFloorPreferences: housekeeperManagement.housekeeperFloorPreferences,
    setHousekeeperFloorPreferences: housekeeperManagement.setHousekeeperFloorPreferences,
    housekeeperMaxRoomsOverrides: housekeeperManagement.housekeeperMaxRoomsOverrides,
    setHousekeeperMaxRoomsOverrides: housekeeperManagement.setHousekeeperMaxRoomsOverrides,
    handleDeleteHousekeeper: housekeeperManagement.handleDeleteHousekeeper,
    handleRenameHousekeeper: housekeeperManagement.handleRenameHousekeeper,
    
    // Dialogs
    dialogState,
    
    // Email & reports
    email,
    setEmail,
    reportCustomFields,
    setReportCustomFields,
    
    // Filters & misc
    filteredRooms,
    setFilteredRooms,
    availableFloors,
    setAvailableFloors,
    existingHousekeepers,
    recommendedHousekeepers,
    
    // Realtime
    realtimeSync,
    
    // Helpers
    getHousekeeperRooms,
    getUnassignedRooms,
    getCleanRooms,
    calculateHousekeeperLoad
  };
}
