import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle, Clock } from 'lucide-react';
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
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [httpOk, setHttpOk] = useState(true);
  const reconnectCooldownRef = useState<{ last: number }>({ last: 0 })[0];

  const requestReconnect = () => {
    const now = Date.now();
    if (now - reconnectCooldownRef.last < 5000) return;
    reconnectCooldownRef.last = now;
    try { realtimeManager.forceReconnect(); } catch {}
  };

  useEffect(() => {
    // Écouter les changements de statut du RealtimeManager
    // Politique: ne JAMAIS afficher "déconnecté" tant que le navigateur est online.
    // On tente toujours une reconnexion silencieuse en arrière-plan.
    const unsubscribe = realtimeManager.onConnectionStatusChange((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionState('online');
        setLastPing(new Date());
        setConsecutiveFailures(0);
        setHttpOk(true);
      }
      // On ignore tous les autres statuts (CLOSED, CHANNEL_ERROR, TIMED_OUT,
      // RECONNECTING, OFFLINE, FAILED) tant que navigator.onLine est vrai.
      // RealtimeManager gère lui-même la reconnexion automatique.
    });

    // Écouter les événements navigateur
    const handleOnline = () => {
      setConsecutiveFailures(0);
      setConnectionState('online');
      setHttpOk(true);
      // Forcer une reconnexion realtime en silence
      requestReconnect();
      pingSupabase();
    };

    const handleOffline = () => {
      // Vrai offline navigateur: on l'affiche
      setConnectionState('offline');
      setHttpOk(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Reconnexion automatique au retour de focus / visibilité
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        requestReconnect();
        pingSupabase();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // Ping initial
    pingSupabase();

    // Ping périodique (toutes les 60s — moins agressif pour limiter les faux négatifs)
    const interval = setInterval(pingSupabase, 60000);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  const pingSupabase = async () => {
    if (!navigator.onLine) {
      setConnectionState('offline');
      setHttpOk(false);
      return;
    }

    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('ping');
      const latency = data?.latency || (Date.now() - start);

      if (error || !data?.ok) {
        setHttpOk(false);
        setConsecutiveFailures(prev => {
          const next = prev + 1;
          // Auto-reconnexion silencieuse en arrière-plan
          requestReconnect();
          // On NE bascule JAMAIS en "offline" sur un échec de ping si le navigateur est online.
          // On reste sur l'état actuel (online) — les retries internes suffisent.
          return next;
        });
      } else {
        // HTTP fonctionne -> on est connecté
        setHttpOk(true);
        setConnectionState('online');
        setLastPing(new Date());
        setConsecutiveFailures(0);
      }
    } catch {
      setHttpOk(false);
      setConsecutiveFailures(prev => prev + 1);
      // Reconnexion silencieuse, pas de bascule visuelle
        requestReconnect();
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setConsecutiveFailures(0);

    try {
      requestReconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
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
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          text: 'Connecté',
          badgeVariant: 'default' as const,
          showReconnect: false
        };
      case 'offline':
        return {
          icon: WifiOff,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          text: 'Hors ligne',
          badgeVariant: 'destructive' as const,
          showReconnect: true
        };
      case 'reconnecting':
        return {
          icon: RefreshCw,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          text: 'Reconnexion...',
          badgeVariant: 'secondary' as const,
          showReconnect: false
        };
      case 'degraded':
        return {
          icon: AlertCircle,
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          text: 'Connexion instable',
          badgeVariant: 'outline' as const,
          showReconnect: true
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatLastPing = (date: Date | null) => {
    if (!date) return 'Jamais';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`;
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <Badge 
              variant={config.badgeVariant}
              className={cn(
                "gap-1.5 cursor-pointer transition-all",
                config.bgColor,
                connectionState === 'reconnecting' && "animate-pulse"
              )}
              onClick={config.showReconnect ? handleReconnect : undefined}
            >
              <Icon className={cn(
                "h-3 w-3",
                config.color,
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
        <TooltipContent className="space-y-1">
          <p className="font-medium">{config.text}</p>
          {lastPing && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Dernière sync: {formatLastPing(lastPing)}
            </p>
          )}
          {consecutiveFailures > 0 && (
            <p className="text-xs text-destructive">
              {consecutiveFailures} échec(s) consécutif(s)
            </p>
          )}
          {config.showReconnect && (
            <p className="text-xs text-muted-foreground">
              Cliquez pour reconnecter
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
