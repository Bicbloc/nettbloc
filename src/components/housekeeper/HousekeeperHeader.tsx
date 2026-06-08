import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Wifi, WifiOff, ScrollText, LogOut, ChevronRight, Coffee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '@/services/storageService';

interface HousekeeperHeaderProps {
  hotelName: string;
  housekeeperName: string;
  isConnected: boolean;
  newRoomsCount: number;
  onToggleActivityLog: () => void;
  onLogout: () => void;
}

export const HousekeeperHeader: React.FC<HousekeeperHeaderProps> = ({
  hotelName,
  housekeeperName,
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
    <div className="sticky top-0 z-40 bg-gradient-to-r from-violet-600 to-indigo-600 text-white safe-area-top">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <span className="font-bold text-base">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white/70 text-xs font-medium">{greeting} 👋</p>
              <h1 className="font-bold text-base truncate">{housekeeperName}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 className="h-3 w-3 text-white/60 flex-shrink-0" />
                <span className="text-xs text-white/70 truncate">{hotelName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Connection status */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
              isConnected 
                ? 'bg-green-400/20 text-green-100' 
                : 'bg-red-400/20 text-red-100'
            }`}>
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{isConnected ? 'En ligne' : 'Hors ligne'}</span>
            </div>

            {newRoomsCount > 0 && (
              <Badge className="bg-green-400/20 text-green-100 border-0 animate-pulse text-[10px]">
                +{newRoomsCount}
              </Badge>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => navigate('/housekeeper/hotels')}
            >
              <Building2 className="h-4 w-4" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={onToggleActivityLog}
            >
              <ScrollText className="h-4 w-4" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
