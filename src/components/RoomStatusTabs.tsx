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

  const handleTabChange = (value: string) => {
    console.log('🔄 Tab change:', value);
    onTabChange(value as RoomFilterTab);
  };

  return (
    <div className="w-full">
      <div className={`grid w-full ${compact ? 'grid-cols-3 gap-1' : 'grid-cols-6 gap-1'} p-1 bg-muted/50 rounded-lg`}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={`flex items-center justify-center gap-1 text-xs sm:text-sm py-2 px-2 sm:px-3 rounded-md transition-all ${
              compact ? 'flex-col' : ''
            } ${
              activeTab === tab.value 
                ? 'bg-background shadow-sm border border-border' 
                : 'hover:bg-background/50'
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
          </button>
        ))}
      </div>
    </div>
  );
}

export function filterRoomsByTab<T extends { status?: string; cleaning_type?: string; cleaningType?: string }>(
  rooms: T[],
  tab: RoomFilterTab
): T[] {
  console.log('🔍 Filtering rooms:', { tab, totalRooms: rooms.length, rooms: rooms.map(r => ({ status: r.status, type: r.cleaning_type || r.cleaningType })) });
  
  if (tab === 'all') return rooms;
  
  const filtered = rooms.filter(room => {
    const status = (room.status || '').toLowerCase();
    const cleaningType = (room.cleaning_type || room.cleaningType || '').toLowerCase();
    
    switch (tab) {
      case 'clean':
        return status === 'clean';
      case 'in_progress':
        return status === 'in_progress' || status === 'in-progress';
      case 'dirty':
        // Chambres à nettoyer qui ne sont pas recouche ni checkout
        const isDirtyStatus = ['dirty', 'needs-cleaning', 'ready-to-clean', 'assigned', 'pending'].includes(status);
        const isNotStayover = !['quick', 'recouche', 'stayover'].includes(cleaningType);
        const isNotCheckout = !['full', 'a_blanc', 'checkout', 'à blanc'].includes(cleaningType);
        return isDirtyStatus && isNotStayover && isNotCheckout;
      case 'stayover':
        // Recouche = quick clean
        return ['quick', 'recouche', 'stayover'].includes(cleaningType);
      case 'checkout':
        // Client sorti = full clean / à blanc
        return status === 'checkout' || ['full', 'a_blanc', 'checkout', 'à blanc'].includes(cleaningType);
      default:
        return true;
    }
  });
  
  console.log('🔍 Filtered result:', filtered.length);
  return filtered;
}

export function calculateRoomCounts<T extends { status?: string; cleaning_type?: string; cleaningType?: string }>(
  rooms: T[]
): { all: number; clean: number; in_progress: number; dirty: number; stayover: number; checkout: number } {
  const getCleaningType = (r: T) => (r.cleaning_type || r.cleaningType || '').toLowerCase();
  const getStatus = (r: T) => (r.status || '').toLowerCase();
  
  return {
    all: rooms.length,
    clean: rooms.filter(r => getStatus(r) === 'clean').length,
    in_progress: rooms.filter(r => getStatus(r) === 'in_progress' || getStatus(r) === 'in-progress').length,
    dirty: rooms.filter(r => {
      const status = getStatus(r);
      const type = getCleaningType(r);
      return ['dirty', 'needs-cleaning', 'ready-to-clean', 'assigned', 'pending'].includes(status) &&
        !['quick', 'recouche', 'stayover'].includes(type) &&
        !['full', 'a_blanc', 'checkout', 'à blanc'].includes(type);
    }).length,
    stayover: rooms.filter(r => ['quick', 'recouche', 'stayover'].includes(getCleaningType(r))).length,
    checkout: rooms.filter(r => 
      getStatus(r) === 'checkout' || ['full', 'a_blanc', 'checkout', 'à blanc'].includes(getCleaningType(r))
    ).length,
  };
}
