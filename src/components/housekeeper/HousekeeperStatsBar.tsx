import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Play, Square, Timer } from 'lucide-react';

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
  const remaining = totalRooms - completedRooms;
  const recouches = rooms.filter(r => r.status === 'clean' && (r.cleaning_type === 'recouche' || r.cleaning_type === 'occupied')).length;
  const departs = rooms.filter(r => r.status === 'clean' && (r.cleaning_type === 'depart' || r.cleaning_type === 'checkout' || r.cleaning_type === 'a_blanc')).length;

  return (
    <div className="space-y-3">
      {/* Progress ring + stats */}
      <div className="bg-card rounded-2xl p-4 shadow-sm border">
        <div className="flex items-center gap-4">
          {/* Circular progress */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
              <circle 
                cx="32" cy="32" r="28" fill="none" 
                stroke="url(#progressGradient)" 
                strokeWidth="5" 
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercent / 100)}`}
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{progressPercent}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-xl font-bold text-primary">{completedRooms}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Faites</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-500">{remaining}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Restantes</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{totalRooms}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Total</div>
            </div>
          </div>
        </div>

        {/* Type breakdown - compact */}
        {startTime && completedRooms > 0 && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <div className="flex-1 flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-medium">{recouches} Rec.</span>
            </div>
            <div className="flex-1 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium">{departs} Dép.</span>
            </div>
          </div>
        )}
      </div>

      {/* Pointage - compact */}
      <div className="bg-card rounded-2xl p-3 shadow-sm border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Timer className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-semibold">Pointage</span>
              {startTime && endTime && (
                <p className="text-xs text-muted-foreground">
                  {startTime} → {endTime} • {calculateWorkDuration(startTime, endTime)}
                </p>
              )}
              {startTime && !endTime && (
                <p className="text-xs text-green-600 font-medium">En cours depuis {startTime}</p>
              )}
            </div>
          </div>
          
          {!startTime && (
            <Button size="sm" onClick={onStartPointage} className="rounded-xl gap-1.5 h-9 bg-green-500 hover:bg-green-600">
              <Play className="h-3.5 w-3.5" />
              Commencer
            </Button>
          )}
          {startTime && !endTime && (
            <Button size="sm" variant="secondary" onClick={onEndPointage} className="rounded-xl gap-1.5 h-9">
              <Square className="h-3.5 w-3.5" />
              Terminer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
