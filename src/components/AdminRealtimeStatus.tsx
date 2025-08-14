import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AdminRealtimeStatusProps {
  isConnected: boolean;
  lastUpdate: Date | null;
  onRefresh: () => void;
  loading: boolean;
}

export const AdminRealtimeStatus = ({ isConnected, lastUpdate, onRefresh, loading }: AdminRealtimeStatusProps) => {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-1">
        {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {isConnected ? 'Temps réel actif' : 'Hors ligne'}
      </Badge>
      
      {lastUpdate && (
        <span className="text-sm text-muted-foreground">
          Dernière mise à jour: {format(lastUpdate, 'HH:mm:ss', { locale: fr })}
        </span>
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="ml-auto"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Actualiser
      </Button>
    </div>
  );
};