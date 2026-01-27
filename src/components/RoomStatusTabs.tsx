import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Trash2, Bed, LogOut, Layers } from "lucide-react";

export type RoomFilterTab = 'all' | 'clean' | 'in_progress' | 'dirty' | 'stayover' | 'checkout';

interface RoomStatusTabsProps {
  activeTab: RoomFilterTab;
  onTabChange: (tab: RoomFilterTab) => void;
  counts: {
    all: number;
    clean: number;
    in_progress: number;
    dirty: number;
    stayover: number;
    checkout: number;
  };
  compact?: boolean;
}

export function RoomStatusTabs({ activeTab, onTabChange, counts, compact = false }: RoomStatusTabsProps) {
  const tabs: { value: RoomFilterTab; label: string; icon: typeof Layers; count: number; color?: string }[] = [
    { value: 'all', label: 'Tout', icon: Layers, count: counts.all },
    { value: 'clean', label: 'Propre', icon: Check, count: counts.clean, color: 'bg-green-500' },
    { value: 'in_progress', label: 'En cours', icon: Clock, count: counts.in_progress, color: 'bg-blue-500' },
    { value: 'dirty', label: 'À nettoyer', icon: Trash2, count: counts.dirty, color: 'bg-yellow-500' },
    { value: 'stayover', label: 'Recouche', icon: Bed, count: counts.stayover, color: 'bg-purple-500' },
    { value: 'checkout', label: 'Client sorti', icon: LogOut, count: counts.checkout, color: 'bg-red-500' },
  ];

  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as RoomFilterTab)} className="w-full">
      <TabsList className={`grid w-full ${compact ? 'grid-cols-3 gap-1' : 'grid-cols-6'} h-auto bg-muted/50 p-1`}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={`flex items-center gap-1 text-xs sm:text-sm py-2 px-2 sm:px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm ${
              compact ? 'flex-col' : ''
            }`}
          >
            <tab.icon className={`h-3 w-3 sm:h-4 sm:w-4 ${activeTab === tab.value ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={compact ? 'text-[10px]' : 'hidden sm:inline'}>{tab.label}</span>
            {tab.count > 0 && (
              <Badge 
                variant="secondary" 
                className={`h-4 min-w-4 px-1 text-[10px] ${tab.color || ''} ${tab.color ? 'text-white' : ''}`}
              >
                {tab.count}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function filterRoomsByTab<T extends { status?: string; cleaning_type?: string; cleaningType?: string }>(
  rooms: T[],
  tab: RoomFilterTab
): T[] {
  if (tab === 'all') return rooms;
  
  return rooms.filter(room => {
    const status = room.status || '';
    const cleaningType = room.cleaning_type || room.cleaningType || '';
    
    switch (tab) {
      case 'clean':
        return status === 'clean';
      case 'in_progress':
        return status === 'in_progress' || status === 'in-progress';
      case 'dirty':
        return ['dirty', 'needs-cleaning', 'ready-to-clean', 'assigned', 'pending'].includes(status) 
          && cleaningType !== 'quick' && cleaningType !== 'recouche' && cleaningType !== 'stayover';
      case 'stayover':
        return ['quick', 'recouche', 'stayover'].includes(cleaningType);
      case 'checkout':
        return status === 'checkout' || cleaningType === 'full' || cleaningType === 'a_blanc' || cleaningType === 'checkout';
      default:
        return true;
    }
  });
}

export function calculateRoomCounts<T extends { status?: string; cleaning_type?: string; cleaningType?: string }>(
  rooms: T[]
): { all: number; clean: number; in_progress: number; dirty: number; stayover: number; checkout: number } {
  return {
    all: rooms.length,
    clean: rooms.filter(r => r.status === 'clean').length,
    in_progress: rooms.filter(r => r.status === 'in_progress' || r.status === 'in-progress').length,
    dirty: rooms.filter(r => 
      ['dirty', 'needs-cleaning', 'ready-to-clean', 'assigned', 'pending'].includes(r.status || '') &&
      !['quick', 'recouche', 'stayover'].includes(r.cleaning_type || r.cleaningType || '')
    ).length,
    stayover: rooms.filter(r => 
      ['quick', 'recouche', 'stayover'].includes(r.cleaning_type || r.cleaningType || '')
    ).length,
    checkout: rooms.filter(r => 
      r.status === 'checkout' || 
      ['full', 'a_blanc', 'checkout'].includes(r.cleaning_type || r.cleaningType || '')
    ).length,
  };
}
