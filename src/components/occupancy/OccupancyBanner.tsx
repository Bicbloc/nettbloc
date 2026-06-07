import { TrendingUp, BedDouble, LogIn, LogOut, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useOccupancyForecast } from '@/hooks/use-occupancy-forecast';
import { useRoomCleanliness } from '@/hooks/use-room-cleanliness';

interface OccupancyBannerProps {
  hotelId: string | null | undefined;
  /** Le propriétaire peut rafraîchir depuis le PMS ; le personnel lit le cache. */
  canRefresh?: boolean;
  className?: string;
}

/**
 * Bandeau "Taux d'occupation" affiché en grand sous le header.
 * Lit les données prévisionnelles synchronisées depuis le PMS.
 */
export function OccupancyBanner({ hotelId, canRefresh = false, className }: OccupancyBannerProps) {
  const { today, loading, refreshing, refresh } = useOccupancyForecast(hotelId, { autoRefresh: canRefresh });

  if (!hotelId) return null;
  if (!today && !loading && !canRefresh) return null;

  const rate = today?.occupancy_rate ?? 0;
  const occupied = today?.occupied_rooms ?? 0;
  const total = today?.total_rooms ?? 0;

  return (
    <Card className={cn('overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10', className)}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TrendingUp className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Taux d'occupation aujourd'hui
            </p>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold leading-none text-foreground tabular-nums">
                {today ? `${rate}` : '—'}
              </span>
              <span className="mb-1 text-2xl font-semibold text-primary">%</span>
            </div>
            {today && (
              <p className="mt-1 text-sm text-muted-foreground">
                {occupied} / {total} chambres occupées
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {today && (
            <>
              <div className="flex flex-col items-center rounded-xl bg-background/60 px-4 py-2 text-center">
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <LogIn className="h-3.5 w-3.5" /> Arrivées
                </span>
                <span className="text-xl font-bold tabular-nums">{today.arrivals}</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-background/60 px-4 py-2 text-center">
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <LogOut className="h-3.5 w-3.5" /> Départs
                </span>
                <span className="text-xl font-bold tabular-nums">{today.departures}</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-background/60 px-4 py-2 text-center">
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <BedDouble className="h-3.5 w-3.5" /> Recouches
                </span>
                <span className="text-xl font-bold tabular-nums">{today.stayovers}</span>
              </div>
            </>
          )}
          {canRefresh && (
            <Button variant="ghost" size="icon" onClick={refresh} disabled={refreshing} title="Actualiser depuis le PMS">
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
