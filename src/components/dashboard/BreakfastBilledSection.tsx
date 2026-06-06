/**
 * Section admin : petits-déjeuners déclarés / facturés du jour.
 * Affiche les chambres ayant pris un petit-déjeuner, le type, le total,
 * et permet d'envoyer les facturables au PMS. Mise à jour en temps réel.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  BreakfastLog, loadBreakfastLogs, sendBreakfastsToPms, todayDate,
} from '@/services/breakfastConfigService';

interface Props {
  hotelId: string;
  currency: string;
}

export function BreakfastBilledSection({ hotelId, currency }: Props) {
  const [logs, setLogs] = useState<BreakfastLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await loadBreakfastLogs(hotelId);
    setLogs(list.filter((l) => l.log_date === todayDate()));
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel(`bf-admin-${hotelId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'breakfast_logs', filter: `hotel_id=eq.${hotelId}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hotelId, refresh]);

  const billed = useMemo(
    () => logs.filter((l) => !l.included && Number(l.total_amount) > 0),
    [logs]
  );
  const total = useMemo(
    () => billed.reduce((s, l) => s + Number(l.total_amount || 0), 0),
    [billed]
  );
  const pendingPms = billed.filter((l) => l.pms_status !== 'sent').length;

  const handleSend = async () => {
    setSending(true);
    const res = await sendBreakfastsToPms(hotelId);
    setSending(false);
    if (res.ok) {
      toast.success(`${res.sent} envoyé(s) au PMS${res.failed ? `, ${res.failed} échec(s)` : ''}`);
      refresh();
    } else {
      toast.error(res.error || "Échec de l'envoi au PMS");
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'sent') return <Badge>Facturé PMS</Badge>;
    if (s === 'error') return <Badge variant="destructive">Erreur PMS</Badge>;
    return <Badge variant="secondary">À facturer</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-lg">Petits-déjeuners du jour</CardTitle>
          <CardDescription>
            {billed.length} chambre(s) facturable(s) — Total {total.toFixed(2)} {currency}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : billed.length === 0 ? (
          <p className="text-muted-foreground">Aucun petit-déjeuner facturable aujourd'hui.</p>
        ) : (
          <>
            <div className="space-y-2">
              {billed.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Ch. {l.room_number}</span>
                    <span className="text-muted-foreground">{l.people_count} pers.</span>
                    {l.breakfast_type && <Badge variant="outline">{l.breakfast_type}</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{Number(l.total_amount).toFixed(2)} {currency}</span>
                    {statusBadge(l.pms_status)}
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleSend} disabled={sending || pendingPms === 0} className="gap-2">
              <Send className="h-4 w-4" />
              {sending ? 'Envoi…' : `Envoyer au PMS (${pendingPms})`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
