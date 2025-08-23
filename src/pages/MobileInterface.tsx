import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Wifi,
  WifiOff,
  Battery,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Home
} from "lucide-react";
import { MobileOptimizer, type MobileSession } from "@/services/MobileOptimizer";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { toast } from "@/hooks/use-toast";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MobileInterface: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // États
  const [session, setSession] = useState<MobileSession | null>(null);
  const [accessCode, setAccessCode] = useState(searchParams.get('code') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  // Hooks
  const { isOnline, isSupabaseConnected, lastPingTime } = useConnectionStatus();

  // Initialisation et restauration session
  useEffect(() => {
    const initSession = async () => {
      // Essayer de restaurer une session existante
      const restored = await MobileOptimizer.restoreSession();
      if (restored) {
        setSession(restored);
        setIsAuthenticated(true);
        return;
      }

      // Si code d'accès dans URL, essayer l'authentification
      const urlCode = searchParams.get('code');
      if (urlCode) {
        setAccessCode(urlCode);
        await handleAuthenticate(urlCode);
      }
    };

    initSession();
  }, []);

  // Monitoring batterie
  useEffect(() => {
    const getBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          setBatteryLevel(Math.round(battery.level * 100));
          
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        } catch (error) {
          console.log('Battery API non disponible');
        }
      }
    };

    getBattery();
  }, []);

  // Authentification
  const handleAuthenticate = async (code?: string) => {
    const codeToUse = code || accessCode;
    if (!codeToUse.trim()) {
      toast({
        variant: "destructive",
        title: "Code requis",
        description: "Veuillez saisir votre code d'accès"
      });
      return;
    }

    setIsLoading(true);
    try {
      const authenticatedSession = await MobileOptimizer.authenticateForMobile(codeToUse);
      setSession(authenticatedSession);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Erreur authentification:', error);
      toast({
        variant: "destructive",
        title: "Échec de connexion",
        description: "Code d'accès invalide ou expiré"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mise à jour statut chambre
  const handleRoomStatusUpdate = async (roomId: string, newStatus: 'in_progress' | 'completed') => {
    try {
      await MobileOptimizer.updateRoomStatus(roomId, newStatus);
      
      // Mettre à jour session locale
      if (session) {
        const updatedSession = { ...session };
        updatedSession.rooms = updatedSession.rooms.map(room => 
          room.id === roomId 
            ? { 
                ...room, 
                status: newStatus,
                started_at: newStatus === 'in_progress' ? new Date().toISOString() : room.started_at,
                completed_at: newStatus === 'completed' ? new Date().toISOString() : room.completed_at
              }
            : room
        );
        updatedSession.completedRooms = updatedSession.rooms.filter(r => r.status === 'completed').length;
        setSession(updatedSession);
      }
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      toast({
        variant: "destructive",
        title: "Erreur de synchronisation",
        description: "Changement sauvegardé localement"
      });
    }
  };

  // Déconnexion
  const handleLogout = () => {
    MobileOptimizer.logout();
    setSession(null);
    setIsAuthenticated(false);
    setAccessCode('');
    navigate('/');
  };

  // Écran d'authentification
  if (!isAuthenticated || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-modern-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Home className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">NetBloc Mobile</CardTitle>
            <p className="text-muted-foreground">
              Connectez-vous avec votre code d'accès
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Code d'accès (ex: HTL001-MAR-1234)"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="text-center text-lg font-mono"
              />
            </div>
            
            <Button
              onClick={() => handleAuthenticate()}
              disabled={isLoading || !accessCode.trim()}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </Button>

            {/* Indicateurs de connexion */}
            <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
                <span>{isOnline ? 'En ligne' : 'Hors ligne'}</span>
              </div>
              
              {batteryLevel !== null && (
                <div className="flex items-center gap-1">
                  <Battery className="h-4 w-4" />
                  <span>{batteryLevel}%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Interface principale mobile
  const stats = MobileOptimizer.getPerformanceStats();
  const progressPercent = session ? (session.completedRooms / session.totalRooms) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header mobile */}
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="font-bold text-lg">{session.hotelName}</h1>
            <p className="text-sm text-muted-foreground">
              Bonjour {session.housekeeperName}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Indicateurs de statut */}
            <div className="flex items-center gap-1 text-xs">
              {isOnline && isSupabaseConnected ? (
                <div className="flex items-center gap-1 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="hidden sm:inline">Synchronisé</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-amber-600">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="hidden sm:inline">Hors ligne</span>
                </div>
              )}
            </div>

            {batteryLevel !== null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Battery className="h-3 w-3" />
                <span>{batteryLevel}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progression globale */}
      <div className="p-4 bg-muted/30">
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progression du jour</span>
              <span className="text-sm text-muted-foreground">
                {session.completedRooms}/{session.totalRooms}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{Math.round(progressPercent)}% terminé</span>
              <span>{session.totalRooms - session.completedRooms} restantes</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mode hors ligne - Alert */}
      {(!isOnline || !isSupabaseConnected) && (
        <div className="p-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Mode hors ligne activé. Les changements seront synchronisés automatiquement.
              {stats && stats.syncQueueSize > 0 && (
                <span className="block mt-1 font-medium">
                  {stats.syncQueueSize} action(s) en attente de synchronisation
                </span>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Liste des chambres */}
      <div className="p-4 space-y-3">
        {session.rooms.map((room) => (
          <Card key={room.id} className={`
            transition-all duration-200
            ${room.status === 'completed' ? 'bg-green-50 border-green-200' : ''}
            ${room.status === 'in_progress' ? 'bg-blue-50 border-blue-200' : ''}
          `}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold">
                    {room.room_number}
                  </div>
                  <Badge
                    variant={
                      room.priority === 'urgent' ? 'destructive' :
                      room.priority === 'high' ? 'default' :
                      room.priority === 'medium' ? 'secondary' : 'outline'
                    }
                    className="text-xs"
                  >
                    {room.priority}
                  </Badge>
                </div>
                
                {/* Statut actuel */}
                <div className="flex items-center gap-2">
                  {room.status === 'completed' && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  {room.status === 'in_progress' && (
                    <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                  )}
                  {room.status === 'assigned' && (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Notes si disponibles */}
              {room.notes && (
                <p className="text-sm text-muted-foreground mb-3 p-2 bg-muted/50 rounded">
                  {room.notes}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {room.status === 'assigned' && (
                  <Button
                    onClick={() => handleRoomStatusUpdate(room.id, 'in_progress')}
                    className="flex-1"
                    size="sm"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Commencer
                  </Button>
                )}
                
                {room.status === 'in_progress' && (
                  <Button
                    onClick={() => handleRoomStatusUpdate(room.id, 'completed')}
                    className="flex-1"
                    size="sm"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Terminer
                  </Button>
                )}

                {room.status === 'completed' && (
                  <div className="flex-1 text-center text-sm text-green-600 font-medium py-2">
                    ✓ Terminé
                    {room.completed_at && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(room.completed_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Message si aucune chambre */}
      {session.rooms.length === 0 && (
        <div className="p-8 text-center">
          <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">Aucune chambre assignée</h3>
          <p className="text-muted-foreground">
            Contactez votre manager pour obtenir vos assignations
          </p>
        </div>
      )}

      {/* Bouton de déconnexion */}
      <div className="p-4 mt-8 border-t">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full"
        >
          Se déconnecter
        </Button>
      </div>

      {/* Safe area pour mobile */}
      <div className="h-16" />
    </div>
  );
};

export default MobileInterface;