import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sunrise, Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface NewDayBannerProps {
  hotelId: string | null;
  roomsEmpty: boolean;
  onStarted: () => void;
}

/**
 * Bannière affichée après la clôture de la journée.
 * Propose de "Commencer une nouvelle journée", action qui synchronise
 * les données : déclenche la synchronisation PMS si configurée,
 * sinon recharge les chambres et invite à importer le planning.
 */
export function NewDayBanner({ hotelId, roomsEmpty, onStarted }: NewDayBannerProps) {
  const [closedToday, setClosedToday] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!hotelId || !roomsEmpty) {
        if (!cancelled) setClosedToday(false);
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('daily_reports')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('report_date', today);
      if (!cancelled) setClosedToday((count || 0) > 0);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [hotelId, roomsEmpty]);

  if (!closedToday || !roomsEmpty) return null;

  const handleStart = async () => {
    if (!hotelId) return;
    setStarting(true);
    try {
      // Vérifier si une configuration PMS existe pour synchroniser automatiquement
      const { data: pmsConfig } = await supabase
        .from('hotel_pms_configs' as any)
        .select('id')
        .eq('hotel_id', hotelId)
        .maybeSingle();

      if (pmsConfig) {
        const { data, error } = await supabase.functions.invoke('pms-sync', {
          body: { hotel_id: hotelId, action: 'sync' },
        });
        if (error || (data && data.success === false)) {
          toast({
            variant: 'destructive',
            title: 'Échec de la synchronisation',
            description: (data && data.error) || 'Impossible de récupérer le planning du PMS.',
          });
        } else {
          toast({
            title: '☀️ Nouvelle journée démarrée',
            description: `${data?.rooms_synced ?? 0} chambre(s) synchronisée(s) depuis le PMS.`,
          });
        }
      } else {
        toast({
          title: '☀️ Nouvelle journée',
          description: "Importez le planning du jour (PDF) ou ajoutez les chambres pour commencer.",
        });
      }
      onStarted();
      setClosedToday(false);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible de démarrer la nouvelle journée.",
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
            <Sunrise className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">La journée a été clôturée</p>
            <p className="text-sm text-muted-foreground">
              Démarrez une nouvelle journée pour synchroniser le planning et réinitialiser le tableau de bord.
            </p>
          </div>
        </div>
        <Button onClick={handleStart} disabled={starting} className="shrink-0 gap-2">
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Commencer une nouvelle journée
        </Button>
      </CardContent>
    </Card>
  );
}
