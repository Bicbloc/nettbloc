import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Wifi, WifiOff, ScrollText, LogOut, ChevronRight, Coffee, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '@/services/storageService';

interface HousekeeperHeaderProps {
  hotelName: string;
  housekeeperName: string;
  governessName?: string | null;
  isConnected: boolean;
  newRoomsCount: number;
  onToggleActivityLog: () => void;
  onLogout: () => void;
}

export const HousekeeperHeader: React.FC<HousekeeperHeaderProps> = ({
  hotelName,
  housekeeperName,
  governessName,
  isConnected,
  newRoomsCount,
  onToggleActivityLog,
  onLogout,
}) => {
  const navigate = useNavigate();
  const initials = housekeeperName
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-br from-violet-600 to-indigo-700 text-white safe-area-top rounded-b-[32px] shadow-lg shadow-violet-900/20">
      <div className="px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner">
              <span className="font-bold text-base">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white/70 text-xs font-medium">{greeting} 👋</p>
              <h1 className="font-bold text-base truncate">{housekeeperName}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 className="h-3 w-3 text-white/60 flex-shrink-0" />
                <span className="text-xs text-white/70 truncate">{hotelName}</span>
              </div>
              {governessName && (
                <div className="flex items-center gap-1.5 mt-1">
                  <UserCheck className="h-3 w-3 text-amber-200 flex-shrink-0" />
                  <span className="text-[11px] text-amber-100 truncate">
                    Gouvernante du jour : <span className="font-semibold">{governessName}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Connection status */}
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${
              isConnected 
                ? 'bg-emerald-400/20 text-emerald-50' 
                : 'bg-red-400/20 text-red-50'
            }`}>
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{isConnected ? 'En ligne' : 'Hors ligne'}</span>
            </div>

            {newRoomsCount > 0 && (
              <Badge className="bg-emerald-400/20 text-emerald-50 border-0 animate-pulse text-[10px]">
                +{newRoomsCount}
              </Badge>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-xl bg-white/10 text-white/90 hover:text-white hover:bg-white/20 active:scale-95"
              onClick={() => navigate('/housekeeper/hotels')}
              title="Changer d'établissement"
            >
              <Building2 className="h-4 w-4" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-xl bg-white/10 text-white/90 hover:text-white hover:bg-white/20 active:scale-95"
              onClick={onToggleActivityLog}
              title="Journal d'activité"
            >
              <ScrollText className="h-4 w-4" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-xl bg-white/10 text-white/90 hover:text-white hover:bg-white/20 active:scale-95"
              onClick={onLogout}
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
