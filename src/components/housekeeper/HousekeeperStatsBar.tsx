import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

interface Room {
  id: string;
  status: string;
  cleaning_type?: string;
}

interface HousekeeperStatsBarProps {
  completedRooms: number;
  totalRooms: number;
  progressPercent: number;
  startTime: string | null;
  endTime: string | null;
  rooms: Room[];
  onStartPointage: () => void;
  onEndPointage: () => void;
  calculateWorkDuration: (start: string, end: string) => string;
}

export const HousekeeperStatsBar: React.FC<HousekeeperStatsBarProps> = ({
  completedRooms,
  totalRooms,
  progressPercent,
  startTime,
  endTime,
  rooms,
  onStartPointage,
  onEndPointage,
  calculateWorkDuration,
}) => {
  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{completedRooms}</div>
          <div className="text-xs text-muted-foreground">Terminées</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold">{totalRooms - completedRooms}</div>
          <div className="text-xs text-muted-foreground">Restantes</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{progressPercent}%</div>
          <div className="text-xs text-muted-foreground">Progression</div>
        </Card>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-3">
        <div
          className="bg-gradient-to-r from-primary to-green-500 h-3 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Pointage */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Pointage</span>
            </div>
            <div className="flex items-center gap-2">
              {!startTime && (
                <Button size="sm" onClick={onStartPointage}>▶️ Commencer</Button>
              )}
              {startTime && !endTime && (
                <Button size="sm" variant="secondary" onClick={onEndPointage}>⏹️ Terminer</Button>
              )}
            </div>
          </div>

          {(startTime || endTime) && (
            <div className="flex flex-wrap gap-2">
              {startTime && <Badge variant="outline" className="text-sm">🟢 Début: {startTime}</Badge>}
              {endTime && <Badge variant="outline" className="text-sm">🔴 Fin: {endTime}</Badge>}
              {startTime && endTime && (
                <Badge variant="secondary" className="text-sm">⏱️ {calculateWorkDuration(startTime, endTime)}</Badge>
              )}
            </div>
          )}

          {startTime && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <div className="text-lg font-bold text-primary">
                  {rooms.filter(r => r.status === 'clean').length}
                </div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  {rooms.filter(r => r.status === 'clean' && (r.cleaning_type === 'recouche' || r.cleaning_type === 'occupied')).length}
                </div>
                <div className="text-xs text-muted-foreground">Recouches</div>
              </div>
              <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <div className="text-lg font-bold text-amber-600">
                  {rooms.filter(r => r.status === 'clean' && (r.cleaning_type === 'depart' || r.cleaning_type === 'checkout' || r.cleaning_type === 'a_blanc')).length}
                </div>
                <div className="text-xs text-muted-foreground">Départs</div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
};
