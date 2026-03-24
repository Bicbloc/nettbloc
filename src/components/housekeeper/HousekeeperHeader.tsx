import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Wifi, WifiOff, ScrollText, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  return (
    <div className="sticky top-0 z-40 bg-background border-b shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">
                {housekeeperName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="font-semibold text-lg">{hotelName}</h1>
              <p className="text-sm text-muted-foreground">{housekeeperName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/housekeeper/hotels')}
              title="Changer d'établissement"
              aria-label="Changer d'établissement"
            >
              <Building2 className="h-5 w-5" />
            </Button>

            <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isConnected ? 'Connecté' : 'Hors ligne'}
            </Badge>

            {newRoomsCount > 0 && (
              <Badge variant="secondary" className="animate-pulse bg-green-100 text-green-800">
                +{newRoomsCount} nouvelle(s)
              </Badge>
            )}

            <Button variant="ghost" size="icon" onClick={onToggleActivityLog}>
              <ScrollText className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon" onClick={onLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
