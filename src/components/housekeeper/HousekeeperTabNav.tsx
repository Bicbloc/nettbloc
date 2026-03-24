import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, ClipboardList, Info, Package } from 'lucide-react';

type TabType = 'rooms' | 'inventory' | 'tasks' | 'instructions';

interface HousekeeperTabNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  totalRooms: number;
  pendingTasksCount: number;
  hasNewInstructions: boolean;
  hotelId: string | null;
  onInstructionsDismiss: () => void;
  onInventoryOpen: () => void;
}

export const HousekeeperTabNav: React.FC<HousekeeperTabNavProps> = ({
  activeTab,
  setActiveTab,
  totalRooms,
  pendingTasksCount,
  hasNewInstructions,
  hotelId,
  onInstructionsDismiss,
  onInventoryOpen,
}) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      <Button
        variant={activeTab === 'rooms' ? 'default' : 'outline'}
        onClick={() => setActiveTab('rooms')}
        className="h-14 flex flex-col items-center justify-center gap-1 p-2"
      >
        <Home className="h-5 w-5" />
        <span className="text-xs">Chambres</span>
        {totalRooms > 0 && (
          <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px]">
            {totalRooms}
          </Badge>
        )}
      </Button>

      <Button
        variant={activeTab === 'tasks' ? 'default' : 'outline'}
        onClick={() => setActiveTab('tasks')}
        className="h-14 flex flex-col items-center justify-center gap-1 p-2 relative"
      >
        <ClipboardList className="h-5 w-5" />
        <span className="text-xs">Tâches</span>
        {pendingTasksCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] animate-pulse"
          >
            {pendingTasksCount}
          </Badge>
        )}
      </Button>

      <Button
        variant={activeTab === 'instructions' ? 'default' : 'outline'}
        onClick={() => {
          setActiveTab('instructions');
          onInstructionsDismiss();
        }}
        className="h-14 flex flex-col items-center justify-center gap-1 p-2 relative"
      >
        <Info className="h-5 w-5" />
        <span className="text-xs">Consignes</span>
        {hasNewInstructions && (
          <>
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-ping" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500" />
          </>
        )}
      </Button>

      <Button
        variant={activeTab === 'inventory' ? 'default' : 'outline'}
        onClick={() => {
          setActiveTab('inventory');
          onInventoryOpen();
        }}
        className="h-14 flex flex-col items-center justify-center gap-1 p-2 relative"
      >
        <Package className="h-5 w-5" />
        <span className="text-xs">Inventaire</span>
        <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 px-1 text-[10px] bg-orange-500 text-white">
          📷
        </Badge>
      </Button>
    </div>
  );
};
