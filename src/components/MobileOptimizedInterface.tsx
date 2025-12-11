import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Battery, 
  Bell,
  Home,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { PremiumLimitGuard } from './PremiumLimitGuard';
import { useSubscription } from '@/hooks/useSubscription';
import { NotificationBell } from './NotificationBell';

interface MobileOptimizedInterfaceProps {
  hotelId?: string;
  rooms?: Array<{
    number: string;
    status: 'to_clean' | 'in_progress' | 'completed';
    priority: 'normal' | 'high' | 'urgent';
    notes?: string;
  }>;
  housekeeperName?: string;
  onRoomStatusUpdate?: (roomNumber: string, status: string) => void;
}

export const MobileOptimizedInterface: React.FC<MobileOptimizedInterfaceProps> = ({
  hotelId,
  rooms = [],
  housekeeperName = 'Femme de chambre',
  onRoomStatusUpdate
}) => {
  const { isPremium } = useSubscription();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  // Vérifier la persistance de l'hôtel lors du montage
  useEffect(() => {
    const checkHotelPersistence = async () => {
      if (!hotelId) {
        const { storageService } = await import('@/services/storageService');
        const storedHotelId = storageService.recoverHotelId();
        if (storedHotelId) {
          console.log('🏨 Hôtel restauré depuis le stockage:', storedHotelId);
        } else {
          console.error('❌ Aucun hôtel trouvé dans le stockage');
        }
      }
    };

    checkHotelPersistence();
  }, [hotelId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Battery API (if available)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'to_clean': return <Home className="h-4 w-4 text-gray-600" />;
      default: return <Home className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'normal': return 'border-gray-300 bg-white';
      default: return 'border-gray-300 bg-white';
    }
  };

  if (!isPremium) {
    return (
      <PremiumLimitGuard
        feature="advanced_mobile_interface"
        title="Interface Mobile Avancée"
        description="Interface mobile optimisée avec fonctionnalités hors ligne réservée aux utilisateurs Premium"
        showUpgrade={true}
      >
        <div>Interface basique disponible</div>
      </PremiumLimitGuard>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header mobile */}
      <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            <span className="font-medium">NettoBloc Mobile</span>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell className="text-primary-foreground border-primary-foreground" />
            
            {/* Status indicators */}
            <div className="flex items-center gap-1">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-300" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-300" />
              )}
              
              {batteryLevel !== null && (
                <div className="flex items-center gap-1">
                  <Battery className="h-4 w-4" />
                  <span className="text-xs">{batteryLevel}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="text-sm opacity-90">
          Bonjour {housekeeperName}
        </div>
      </div>

      {/* Connection status */}
      {!isOnline && (
        <div className="bg-orange-100 border-l-4 border-orange-500 p-3 m-4">
          <div className="flex items-center">
            <WifiOff className="h-4 w-4 text-orange-500 mr-2" />
            <p className="text-sm text-orange-700">
              Mode hors ligne - Les modifications seront synchronisées lors de la reconnexion
            </p>
          </div>
        </div>
      )}

      {/* Progress summary */}
      <div className="p-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                {rooms.filter(r => r.status === 'completed').length} / {rooms.length}
              </div>
              <p className="text-sm text-muted-foreground">Chambres terminées</p>
              
              <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${rooms.length > 0 ? (rooms.filter(r => r.status === 'completed').length / rooms.length) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room list */}
      <div className="px-4 pb-4 space-y-3">
        {rooms.map((room) => (
          <Card key={room.number} className={`${getPriorityColor(room.priority)} border-2`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(room.status)}
                  <span className="font-semibold text-lg">Chambre {room.number}</span>
                  {room.priority !== 'normal' && (
                    <Badge variant={room.priority === 'urgent' ? 'destructive' : 'secondary'}>
                      {room.priority === 'urgent' ? 'Urgent' : 'Prioritaire'}
                    </Badge>
                  )}
                </div>
              </div>

              {room.notes && (
                <p className="text-sm text-muted-foreground mb-3">
                  📝 {room.notes}
                </p>
              )}

              <div className="flex gap-2">
                {room.status === 'to_clean' && (
                  <Button 
                    onClick={() => onRoomStatusUpdate?.(room.number, 'in_progress')}
                    className="flex-1"
                    size="sm"
                  >
                    Commencer
                  </Button>
                )}
                {room.status === 'in_progress' && (
                  <Button 
                    onClick={() => onRoomStatusUpdate?.(room.number, 'completed')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Terminer
                  </Button>
                )}
                {room.status === 'completed' && (
                  <div className="flex-1 text-center py-2 bg-green-100 text-green-800 rounded-md text-sm font-medium">
                    ✓ Terminée
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rooms.length === 0 && (
        <div className="p-4">
          <Card>
            <CardContent className="text-center py-8">
              <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune chambre assignée</h3>
              <p className="text-muted-foreground">
                Contactez votre superviseur pour recevoir vos assignations
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom spacer for safe area */}
      <div className="h-16"></div>
    </div>
  );
};