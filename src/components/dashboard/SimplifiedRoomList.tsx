/**
 * Liste compacte simplifiée des chambres pour les onglets filtrés
 * Affiche: N°, statut, type nettoyage, assignée à, temps en cours
 */
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Bed, Clock, Check, AlertCircle, Timer } from 'lucide-react';
import { getCleaningTypeLabel } from '@/utils/cleaningTypeUtils';
import { useEffect, useState } from 'react';

import { Room } from '@/services/pdfService';

// Étend le type Room pour inclure startedAt
type RoomWithTime = Room & {
  startedAt?: string | Date;
};

interface SimplifiedRoomListProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rooms: any[];
  title: string;
  emptyMessage?: string;
}

// Helper pour calculer le temps écoulé
function getElapsedTime(startTime: string | Date | undefined): string {
  if (!startTime) return '';
  
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  
  if (diffMs < 0) return '';
  
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  }
  return `${mins}min`;
}

export function SimplifiedRoomList({ rooms, title, emptyMessage = "Aucune chambre" }: SimplifiedRoomListProps) {
  // Force re-render every minute for time updates
  const [, setTick] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase().replace(/-/g, '_');
    if (s === 'clean') return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Propre</Badge>;
    if (s === 'in_progress' || s === 'inprogress') return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">En cours</Badge>;

    // IMPORTANT: dans l'app, "Client sorti" est souvent `checkout` OU `ready-to-clean`
    if (s === 'checkout' || s === 'ready_to_clean') {
      return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Client sorti</Badge>;
    }

    if (s === 'stayover') return <Badge className="bg-purple-500/20 text-purple-700 border-purple-500/30">Recouche</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">À nettoyer</Badge>;
  };

  const getCleaningTypeBadge = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t === 'full' || t === 'a_blanc') return <Badge variant="outline" className="text-xs bg-red-50">B</Badge>;
    if (t === 'quick' || t === 'recouche') return <Badge variant="outline" className="text-xs bg-blue-50">R</Badge>;
    if (t === 'none') return <Badge variant="outline" className="text-xs bg-gray-50">-</Badge>;
    return null;
  };

  const isInProgress = (status: string) => {
    const s = status.toLowerCase().replace(/-/g, '_');
    return s === 'in_progress' || s === 'inprogress';
  };

  if (rooms.length === 0) {
    return (
      <Card className="p-6 text-center border-dashed">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2 bg-muted/50 border-b flex items-center justify-between">
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="secondary">{rooms.length}</Badge>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="divide-y">
          {rooms.map((room) => {
            const inProgress = isInProgress(room.status);
            const elapsedTime = inProgress && room.startedAt ? getElapsedTime(room.startedAt) : '';
            
            return (
              <div 
                key={room.number} 
                className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors"
              >
                {/* Numéro de chambre */}
                <div className="flex items-center gap-2 min-w-[60px]">
                  <Bed className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-semibold">{room.number}</span>
                </div>
                
                {/* Statut + temps en cours */}
                <div className="flex-1 flex items-center gap-2 px-2">
                  {getStatusBadge(room.status)}
                  {getCleaningTypeBadge(room.cleaningType)}
                  
                  {/* Afficher le temps écoulé si en cours */}
                  {inProgress && elapsedTime && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {elapsedTime}
                    </Badge>
                  )}
                </div>
                
                {/* Assigné à */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-[100px] justify-end">
                  {room.assignedTo ? (
                    <>
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[80px]">{room.assignedTo}</span>
                    </>
                  ) : (
                    <span className="text-xs italic">Non assignée</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
