import { Badge } from "@/components/ui/badge";
import { Check, Clock, Trash2, Bed, LogOut, Layers } from "lucide-react";
import { isFullCleaning, isQuickCleaning } from "@/utils/cleaningTypeUtils";

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
    console.log('🎯 Tab clicked:', value);
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

/**
 * Filtre les chambres selon l'onglet actif
 * Basé sur les vraies données BD:
 * - cleaning_type: 'full'/'a_blanc' (À blanc) ou 'quick'/'recouche' (Recouche) ou 'none'
 * - status: 'checkout', 'clean', 'needs-cleaning', 'ready-to-clean', 'stayover', 'in_progress', etc.
 */
export function filterRoomsByTab<T extends { status?: string; cleaning_type?: string; cleaningType?: string }>(
  rooms: T[],
  tab: RoomFilterTab
): T[] {
  if (tab === 'all') return rooms;
  
  console.log('🔍 Filtering rooms by tab:', tab, 'Total rooms:', rooms.length);
  
  const result = rooms.filter((room) => {
    const status = (room.status || '').toLowerCase().replace(/-/g, '_');
    const rawCleaningType = (room.cleaning_type || room.cleaningType || '').toLowerCase();

    // Normaliser cleaning_type
    const isFullType = rawCleaningType === 'full' || rawCleaningType === 'a_blanc' || rawCleaningType === 'checkout';
    const isQuickType = rawCleaningType === 'quick' || rawCleaningType === 'recouche' || rawCleaningType === 'stayover';
    const isNoneType = rawCleaningType === 'none' || rawCleaningType === '';

    // IMPORTANT:
    // - "Client sorti" dans l'app correspond souvent à `checkout` MAIS aussi à `ready-to-clean`.
    // - On évite de compter `ready_to_clean` dans "À nettoyer" pour ne pas vider l'onglet "Client sorti".
    const isCheckoutLikeStatus = status === 'checkout' || status === 'ready_to_clean';
    const isDirtyStatus = ['dirty', 'needs_cleaning', 'assigned', 'pending'].includes(status);
    const isInProgressStatus = status === 'in_progress' || status === 'inprogress';

    switch (tab) {
      case 'clean':
        // Propre = status 'clean' OU cleaning_type 'none' avec status non-dirty
        return status === 'clean' || (isNoneType && status !== 'needs_cleaning' && status !== 'dirty');

      case 'in_progress':
        return isInProgressStatus;

      case 'dirty':
        // À nettoyer = uniquement les statuts "à faire" (pas les statuts "client sorti")
        return isDirtyStatus && isFullType && !isCheckoutLikeStatus;

      case 'stayover':
        // Recouche = cleaning_type quick/recouche (peu importe le statut)
        return isQuickType;

      case 'checkout':
        // Client sorti = checkout OU ready-to-clean (mais uniquement pour les À blanc)
        return isFullType && isCheckoutLikeStatus;

      default:
        return true;
    }
  });
  
  console.log('🔍 Filtered result for', tab, ':', result.length, 'rooms');
  return result;
}

/**
 * Calcule le nombre de chambres pour chaque onglet
 */
export function calculateRoomCounts<T extends { status?: string; cleaning_type?: string; cleaningType?: string }>(
  rooms: T[]
): { all: number; clean: number; in_progress: number; dirty: number; stayover: number; checkout: number } {
  const getCleaningType = (r: T) => (r.cleaning_type || r.cleaningType || '').toLowerCase();
  const getStatus = (r: T) => (r.status || '').toLowerCase().replace(/-/g, '_');
  
  const isFullType = (type: string) => type === 'full' || type === 'a_blanc' || type === 'checkout';
  const isQuickType = (type: string) => type === 'quick' || type === 'recouche' || type === 'stayover';
  const isNoneType = (type: string) => type === 'none' || type === '';
  
  const counts = {
    all: rooms.length,
    clean: rooms.filter(r => {
      const s = getStatus(r);
      const t = getCleaningType(r);
      return s === 'clean' || (isNoneType(t) && s !== 'needs_cleaning' && s !== 'dirty');
    }).length,
    in_progress: rooms.filter(r => {
      const s = getStatus(r);
      return s === 'in_progress' || s === 'inprogress';
    }).length,
    dirty: rooms.filter(r => {
      const status = getStatus(r);
      const type = getCleaningType(r);
      const isDirtyStatus = ['dirty', 'needs_cleaning', 'assigned', 'pending'].includes(status);
      const isCheckoutLikeStatus = status === 'checkout' || status === 'ready_to_clean';
      return isDirtyStatus && isFullType(type) && !isCheckoutLikeStatus;
    }).length,
    stayover: rooms.filter(r => isQuickType(getCleaningType(r))).length,
    checkout: rooms.filter(r => {
      const s = getStatus(r);
      const t = getCleaningType(r);
      const isCheckoutLikeStatus = s === 'checkout' || s === 'ready_to_clean';
      return isFullType(t) && isCheckoutLikeStatus;
    }).length,
  };
  
  console.log('📊 Room counts calculated:', counts);
  return counts;
}
