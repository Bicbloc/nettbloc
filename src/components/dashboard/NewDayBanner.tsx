import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sunrise, Loader2, RefreshCw, CalendarClock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOperationalDate } from '@/hooks/useOperationalDate';

interface NewDayBannerProps {
  hotelId: string | null;
  roomsEmpty: boolean;
  onStarted: () => void;
}

/**
 * Bannière affichée après la clôture de la journée.
 * Affiche en grand la date opérationnelle (basée sur les clôtures, pas
 * l'agenda) et propose de "Commencer une nouvelle journée". Si des jours
 * ont été manqués (bug, pas de connexion, déconnexion), elle invite à
 * ouvrir une nouvelle journée aux dates non utilisées. Un bouton de
 * resynchronisation est proposé lorsqu'une connexion PMS (API) existe.
 */
export function NewDayBanner({ hotelId, roomsEmpty, onStarted }: NewDayBannerProps) {
  const [starting, setStarting] = useState(false);
  const [hasPms, setHasPms] = useState(false);
  const { operationalDate, isBehind, missedDaysCount, lastClosureDate, loading, refresh } =
    useOperationalDate(hotelId);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!hotelId) return;
      const { data } = await supabase
        .from('hotel_pms_configs' as any)
        .select('id')
        .eq('hotel_id', hotelId)
        .maybeSingle();
      if (!cancelled) setHasPms(!!data);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  // On affiche la bannière uniquement après une clôture (chambres vides + au
  // moins une clôture déjà effectuée).
  if (loading || !roomsEmpty || !lastClosureDate) return null;

  const dateLabel = new Date(operationalDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const runSync = async () => {
    if (!hotelId) return;
    const { data, error } = await supabase.functions.invoke('pms-sync', {
      body: { hotel_id: hotelId, action: 'sync' },
    });
    if (error || (data && data.success === false)) {
      toast({
        variant: 'destructive',
        title: 'Échec de la synchronisation',
        description: (data && data.error) || 'Impossible de récupérer le planning du PMS.',
      });
      return false;
    }
    toast({
      title: '🔄 Resynchronisé',
      description: `${data?.rooms_synced ?? 0} chambre(s) synchronisée(s) depuis le PMS.`,
    });
    return true;
  };

  const handleStart = async () => {
    if (!hotelId) return;
    setStarting(true);
    try {
      if (hasPms) {
        const ok = await runSync();
        if (!ok) return;
      } else {
        toast({
          title: '☀️ Nouvelle journée',
          description: "Importez le planning du jour (PDF) ou ajoutez les chambres pour commencer.",
        });
      }
      onStarted();
      refresh();
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

  const handleResync = async () => {
    setStarting(true);
    try {
      await runSync();
      onStarted();
      refresh();
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
            <Sunrise className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">La journée a été clôturée</p>
            <p className="text-sm text-muted-foreground">
              Démarrez la prochaine journée pour synchroniser le planning et réinitialiser le tableau de bord.
            </p>
          </div>
        </div>

        {/* Date opérationnelle en grand */}
        <div className="rounded-xl border bg-background/60 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Prochaine journée à ouvrir
          </p>
          <p className="text-2xl font-bold text-primary sm:text-3xl">{dateLabel}</p>
          {isBehind && (
            <p className="mt-2 flex items-center justify-center gap-2 text-sm font-medium text-amber-600">
              <CalendarClock className="h-4 w-4" />
              {missedDaysCount} journée(s) non utilisée(s) détectée(s) — ouverture de la plus ancienne.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {hasPms && (
            <Button
              variant="outline"
              onClick={handleResync}
              disabled={starting}
              className="gap-2"
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Resynchroniser (API)
            </Button>
          )}
          <Button onClick={handleStart} disabled={starting} className="gap-2">
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sunrise className="h-4 w-4" />
            )}
            Ouvrir cette journée
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
