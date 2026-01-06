/**
 * Composant Vue d'ensemble
 * Extrait de Index.tsx pour modularité
 */

import { Room, CleaningConfig } from "@/services/pdfService";
import { StatsOverview } from "@/components/StatsOverview";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { PlanningSummaryCard } from "@/components/dashboard/PlanningSummaryCard";
import { PersonnelSection } from "@/components/dashboard/PersonnelSection";
import { ActiveUsersPanel } from "@/components/ActiveUsersPanel";
import { GovernessAccessRequests } from "@/components/GovernessAccessRequests";

interface OverviewTabProps {
  rooms: Room[];
  housekeeperNames: string[];
  cleaningConfig: CleaningConfig;
  isPremium: boolean;
  currentHotelId: string | null;
  roomStats: {
    twinRooms: number;
    fullCleaningRooms: number;
    quickCleaningRooms: number;
  };
  onPdfProcessed: (data: Room[], housekeeperNames?: string[], method?: 'random' | 'floor' | 'cleaning-type') => Promise<void>;
  onConfigChange: (config: CleaningConfig) => void;
  onHousekeeperNamesChange: (names: string[]) => void;
  onDistribute: () => Promise<void>;
}

export function OverviewTab({
  rooms,
  housekeeperNames,
  cleaningConfig,
  isPremium,
  currentHotelId,
  roomStats,
  onPdfProcessed,
  onConfigChange,
  onHousekeeperNamesChange,
  onDistribute
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <StatsOverview 
        rooms={rooms}
        housekeeperCount={housekeeperNames.length}
      />

      {/* Demandes d'accès gouvernantes */}
      <GovernessAccessRequests />

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <QuickActionsCard
          currentHotelId={currentHotelId}
          cleaningConfig={cleaningConfig}
          housekeeperNames={housekeeperNames}
          rooms={rooms}
          isPremium={isPremium}
          onPdfProcessed={onPdfProcessed}
          onConfigChange={onConfigChange}
          onHousekeeperNamesChange={onHousekeeperNamesChange}
          onDistribute={onDistribute}
        />
        <PlanningSummaryCard
          twinRooms={roomStats.twinRooms}
          fullCleaningRooms={roomStats.fullCleaningRooms}
          quickCleaningRooms={roomStats.quickCleaningRooms}
          housekeeperCount={housekeeperNames.length}
          cleaningConfig={cleaningConfig}
        />
      </div>
      
      <ActiveUsersPanel />
      <PersonnelSection housekeeperCount={housekeeperNames.length} />
    </div>
  );
}
