import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, Trash2, Database, Shield, Clock, AlertTriangle, X } from 'lucide-react';
import { realtimeManager } from '@/services/RealtimeManager';
import { storageService } from '@/services/storageService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DiagnosticState {
  network: 'online' | 'offline';
  auth: 'authenticated' | 'unauthenticated' | 'checking';
  authExpiry: number | null;
  realtime: string;
  realtimeDetails: {
    isConnected: boolean;
    hotelId: string | null;
    reconnectAttempts: number;
    consecutiveFailures: number;
    lastPing: number;
    subscribersCount: number;
  };
  storage: {
    hotelId: string | null;
    hotelName: string | null;
    buildId: string | null;
    lastClean: string | null;
  };
  lastPingResult: { ok: boolean; latency: number } | null;
}

export const ConnectionDebugPanel = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticState>({
    network: navigator.onLine ? 'online' : 'offline',
    auth: 'checking',
    authExpiry: null,
    realtime: 'unknown',
    realtimeDetails: {
      isConnected: false,
      hotelId: null,
      reconnectAttempts: 0,
      consecutiveFailures: 0,
      lastPing: 0,
      subscribersCount: 0,
    },
    storage: {
      hotelId: null,
      hotelName: null,
      buildId: null,
      lastClean: null,
    },
    lastPingResult: null,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  // Check if debug mode is enabled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsVisible(params.get('debug') === '1');
  }, []);

  // Refresh diagnostics
  const refreshDiagnostics = async () => {
    setIsRefreshing(true);

    try {
      // Network
      const network = navigator.onLine ? 'online' : 'offline';

      // Auth
      let auth: 'authenticated' | 'unauthenticated' | 'checking' = 'checking';
      let authExpiry: number | null = null;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          auth = 'authenticated';
          authExpiry = session.expires_at ? session.expires_at * 1000 : null;
        } else {
          auth = 'unauthenticated';
        }
      } catch {
        auth = 'unauthenticated';
      }

      // Realtime
      const rtStatus = realtimeManager.getStatus();

      // Storage
      const hotel = storageService.getHotel();

      setDiagnostics({
        network,
        auth,
        authExpiry,
        realtime: rtStatus.lastStatus,
        realtimeDetails: {
          isConnected: rtStatus.isConnected,
          hotelId: rtStatus.hotelId,
          reconnectAttempts: rtStatus.reconnectAttempts,
          consecutiveFailures: rtStatus.consecutiveFailures,
          lastPing: rtStatus.lastPing,
          subscribersCount: rtStatus.subscribersCount,
        },
        storage: {
          hotelId: hotel?.id || null,
          hotelName: hotel?.name || null,
          buildId: localStorage.getItem('nettobloc_build_id'),
          lastClean: localStorage.getItem('nettobloc_last_clean'),
        },
        lastPingResult: diagnostics.lastPingResult,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isVisible) {
      refreshDiagnostics();
      const interval = setInterval(refreshDiagnostics, 5000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  // Ping the edge function
  const handlePing = async () => {
    setIsPinging(true);
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('ping');
      const latency = Date.now() - start;
      
      setDiagnostics(prev => ({
        ...prev,
        lastPingResult: { ok: !error && data?.ok, latency }
      }));
    } catch {
      setDiagnostics(prev => ({
        ...prev,
        lastPingResult: { ok: false, latency: 0 }
      }));
    } finally {
      setIsPinging(false);
    }
  };

  // Force reconnect
  const handleReconnect = () => {
    realtimeManager.forceReconnect();
    setTimeout(refreshDiagnostics, 1000);
  };

  // Clear app cache (not auth)
  const handleClearCache = () => {
    const keysToKeep = ['supabase.auth.token'];
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (!keysToKeep.some(k => key.includes(k))) {
        if (key.startsWith('nettobloc_') || key.startsWith('selected') || key.startsWith('hotel')) {
          localStorage.removeItem(key);
        }
      }
    });
    
    // Force reload after clearing
    window.location.reload();
  };

  // Full reset (sign out + clear all)
  const handleFullReset = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/auth';
  };

  if (!isVisible) return null;

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBSCRIBED': return 'bg-green-500';
      case 'CONNECTING': case 'RECONNECTING': return 'bg-yellow-500';
      case 'CLOSED': case 'TIMED_OUT': case 'FAILED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-md">
      <Card className="bg-background/95 backdrop-blur border-2 shadow-xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Debug Panel
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {/* Network */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {diagnostics.network === 'online' ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              Network
            </span>
            <Badge variant={diagnostics.network === 'online' ? 'default' : 'destructive'}>
              {diagnostics.network}
            </Badge>
          </div>

          {/* Auth */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Auth
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={diagnostics.auth === 'authenticated' ? 'default' : 'destructive'}>
                {diagnostics.auth}
              </Badge>
              {diagnostics.authExpiry && (
                <span className="text-muted-foreground">
                  exp: {formatTime(diagnostics.authExpiry)}
                </span>
              )}
            </div>
          </div>

          {/* Realtime */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Realtime
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getStatusColor(diagnostics.realtime)}`} />
              <Badge variant="outline">{diagnostics.realtime}</Badge>
            </div>
          </div>

          {/* Realtime Details */}
          <div className="pl-6 text-muted-foreground space-y-1">
            <div>Hotel: {diagnostics.realtimeDetails.hotelId?.slice(0, 8) || 'none'}...</div>
            <div>Subscribers: {diagnostics.realtimeDetails.subscribersCount}</div>
            <div>Reconnects: {diagnostics.realtimeDetails.reconnectAttempts}</div>
            <div>Failures: {diagnostics.realtimeDetails.consecutiveFailures}</div>
            <div>Last ping: {formatTime(diagnostics.realtimeDetails.lastPing)}</div>
          </div>

          {/* Storage */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Storage
            </span>
          </div>
          <div className="pl-6 text-muted-foreground space-y-1">
            <div>Hotel: {diagnostics.storage.hotelName || diagnostics.storage.hotelId?.slice(0, 8) || 'none'}</div>
            <div>Build: {diagnostics.storage.buildId?.slice(0, 10) || 'none'}</div>
            <div>Last clean: {diagnostics.storage.lastClean || 'never'}</div>
          </div>

          {/* Ping Result */}
          {diagnostics.lastPingResult && (
            <div className="flex items-center justify-between">
              <span>Edge Ping</span>
              <Badge variant={diagnostics.lastPingResult.ok ? 'default' : 'destructive'}>
                {diagnostics.lastPingResult.ok ? `OK (${diagnostics.lastPingResult.latency}ms)` : 'Failed'}
              </Badge>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={refreshDiagnostics}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePing}
              disabled={isPinging}
            >
              Ping
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReconnect}
            >
              Reconnect
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearCache}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear Cache
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleFullReset}
            >
              Full Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
