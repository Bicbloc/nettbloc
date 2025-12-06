import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { realtimeManager } from '@/services/RealtimeManager';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'degraded';

export function ConnectionStatusIndicator() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('online');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastPing, setLastPing] = useState<Date | null>(null);

  useEffect(() => {
    // Écouter les changements de statut du RealtimeManager
    realtimeManager.onConnectionStatusChange((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionState('online');
        setLastPing(new Date());
      } else if (status === 'OFFLINE') {
        setConnectionState('offline');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionState('reconnecting');
      }
    });

    // Écouter les événements navigateur
    const handleOnline = () => {
      setConnectionState('reconnecting');
      pingSupabase();
    };
    
    const handleOffline = () => setConnectionState('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Ping initial
    pingSupabase();

    // Ping périodique (toutes les 30s)
    const interval = setInterval(pingSupabase, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const pingSupabase = async () => {
    if (!navigator.onLine) {
      setConnectionState('offline');
      return;
    }

    try {
      const start = Date.now();
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();
      
      const latency = Date.now() - start;
      
      if (error) {
        setConnectionState('degraded');
      } else if (latency > 3000) {
        setConnectionState('degraded');
      } else {
        setConnectionState('online');
        setLastPing(new Date());
      }
    } catch {
      setConnectionState('degraded');
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setConnectionState('reconnecting');
    
    try {
      realtimeManager.forceReconnect();
      await pingSupabase();
    } finally {
      setTimeout(() => setIsReconnecting(false), 1000);
    }
  };

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'online':
        return {
          icon: Wifi,
          color: 'bg-green-500',
          text: 'Connecté',
          badgeVariant: 'default' as const,
          showReconnect: false
        };
      case 'offline':
        return {
          icon: WifiOff,
          color: 'bg-destructive',
          text: 'Hors ligne',
          badgeVariant: 'destructive' as const,
          showReconnect: false
        };
      case 'reconnecting':
        return {
          icon: RefreshCw,
          color: 'bg-yellow-500',
          text: 'Reconnexion...',
          badgeVariant: 'secondary' as const,
          showReconnect: false
        };
      case 'degraded':
        return {
          icon: AlertCircle,
          color: 'bg-orange-500',
          text: 'Connexion lente',
          badgeVariant: 'outline' as const,
          showReconnect: true
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <Badge 
              variant={config.badgeVariant}
              className={cn(
                "gap-1.5 cursor-pointer transition-all",
                connectionState === 'reconnecting' && "animate-pulse"
              )}
              onClick={config.showReconnect ? handleReconnect : undefined}
            >
              <Icon className={cn(
                "h-3 w-3",
                connectionState === 'reconnecting' && "animate-spin"
              )} />
              <span className="text-xs hidden sm:inline">{config.text}</span>
            </Badge>
            
            {config.showReconnect && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleReconnect}
                disabled={isReconnecting}
              >
                <RefreshCw className={cn(
                  "h-3 w-3",
                  isReconnecting && "animate-spin"
                )} />
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.text}</p>
          {lastPing && connectionState === 'online' && (
            <p className="text-xs text-muted-foreground">
              Dernière sync: {lastPing.toLocaleTimeString()}
            </p>
          )}
          {connectionState === 'degraded' && (
            <p className="text-xs text-muted-foreground">
              Cliquez pour reconnecter
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
