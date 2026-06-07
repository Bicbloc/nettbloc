import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarRange } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useOccupancyForecast } from '@/hooks/use-occupancy-forecast';

interface OccupancyForecastProps {
  hotelId: string | null | undefined;
}

const RANGES = [7, 14, 30] as const;

/**
 * Prévisionnel des chambres occupées et propres (libres) sur 7 / 14 / 30 jours,
 * basé sur les réservations futures du PMS.
 */
export function OccupancyForecast({ hotelId }: OccupancyForecastProps) {
  const { days, loading } = useOccupancyForecast(hotelId);
  const [range, setRange] = useState<number>(7);

  const data = useMemo(() => {
    return days.slice(0, range).map((d) => ({
      date: d.forecast_date,
      label: format(parseISO(d.forecast_date), 'EEE dd/MM', { locale: fr }),
      occupees: d.occupied_rooms,
      propres: Math.max(0, d.total_rooms - d.occupied_rooms),
      to: d.occupancy_rate,
    }));
  }, [days, range]);

  if (!hotelId) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-4 w-4 text-primary" />
          Prévisionnel d'occupation
        </CardTitle>
        <ToggleGroup
          type="single"
          value={String(range)}
          onValueChange={(v) => v && setRange(Number(v))}
          size="sm"
        >
          {RANGES.map((r) => (
            <ToggleGroupItem key={r} value={String(r)} aria-label={`${r} jours`}>
              {r} j
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {loading && data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Aucune donnée prévisionnelle. Synchronisez votre PMS pour l'afficher.
          </p>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval={range > 14 ? 2 : 0} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(value: number, name: string) => [value, name === 'occupees' ? 'Occupées' : 'Propres']}
                />
                <Legend
                  formatter={(value) => (value === 'occupees' ? 'Chambres occupées' : 'Chambres propres')}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="occupees" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="propres" stackId="a" fill="hsl(var(--muted-foreground) / 0.35)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
