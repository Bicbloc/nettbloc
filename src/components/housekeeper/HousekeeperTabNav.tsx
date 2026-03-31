import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Home, ClipboardList, Info, Package, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'rooms' | 'inventory' | 'tasks' | 'instructions' | 'plan';

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

const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: 'rooms', label: 'Chambres', icon: Home },
  { key: 'tasks', label: 'Tâches', icon: ClipboardList },
  { key: 'instructions', label: 'Consignes', icon: Info },
  { key: 'inventory', label: 'Inventaire', icon: Package },
  { key: 'plan', label: 'Plan', icon: Map },
];

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
  const handleTabClick = (key: TabType) => {
    setActiveTab(key);
    if (key === 'instructions') onInstructionsDismiss();
    if (key === 'inventory') onInventoryOpen();
  };

  const getBadge = (key: TabType) => {
    if (key === 'rooms' && totalRooms > 0) return totalRooms;
    if (key === 'tasks' && pendingTasksCount > 0) return pendingTasksCount;
    return null;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t safe-area-bottom">
      <div className="grid grid-cols-5 px-2 py-1">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          const badge = getBadge(key);
          const showPing = key === 'instructions' && hasNewInstructions;
          const showCameraBadge = key === 'inventory';

          return (
            <button
              key={key}
              onClick={() => handleTabClick(key)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all duration-200",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "relative p-1.5 rounded-xl transition-all duration-200",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                
                {badge && (
                  <span className={cn(
                    "absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1",
                    key === 'tasks' 
                      ? "bg-destructive text-destructive-foreground animate-pulse" 
                      : "bg-primary text-primary-foreground"
                  )}>
                    {badge}
                  </span>
                )}

                {showPing && (
                  <>
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                  </>
                )}

                {showCameraBadge && (
                  <span className="absolute -top-1 -right-1 text-[10px]">📷</span>
                )}
              </div>
              
              <span className={cn(
                "text-[10px] font-medium transition-all",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {label}
              </span>

              {isActive && (
                <div className="absolute -bottom-1 w-5 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
