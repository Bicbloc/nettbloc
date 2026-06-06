/**
 * Section admin : petits-déjeuners déclarés / facturés du jour.
 * Affiche les chambres ayant pris un petit-déjeuner, le type, le total,
 * et permet d'envoyer les facturables au PMS. Mise à jour en temps réel.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, RefreshCw, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  BreakfastLog, BreakfastType, loadBreakfastLogs, sendBreakfastsToPms,
  upsertBreakfastLog, todayDate,
} from '@/services/breakfastConfigService';

interface RoomMeta {
  guest_name: string | null;
  status: string | null;
}

interface Props {
  hotelId: string;
  currency: string;
  breakfastTypes: BreakfastType[];
  pricePerPerson: number;
  availableRooms?: string[];
  roomMeta?: Record<string, RoomMeta>;
}

const stayText = (status: string | null | undefined): string => {
  if (status === 'departure') return 'Check-out';
  if (status === 'arrival') return 'Arrivée';
  if (status) return 'En cours';
  return '';
};

export function BreakfastBilledSection({ hotelId, currency, breakfastTypes, pricePerPerson, availableRooms = [], roomMeta = {} }: Props) {
  const [logs, setLogs] = useState<BreakfastLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Ajout manuel par l'admin
  const [addRoom, setAddRoom] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addType, setAddType] = useState<string>(breakfastTypes[0]?.name || '');
  const [adding, setAdding] = useState(false);

  const addUnitPrice = useMemo(() => {
    const found = breakfastTypes.find((t) => t.name === addType);
    return found ? found.price : pricePerPerson;
  }, [breakfastTypes, addType, pricePerPerson]);

  const handleAdd = async () => {
    const room = addRoom.trim();
    if (!room || addQty <= 0) {
      toast.error('Indiquez un numéro de chambre et une quantité.');
      return;
    }
    setAdding(true);
    const items = [{ name: addType || 'Petit-déjeuner', qty: addQty, price: addUnitPrice }];
    const ok = await upsertBreakfastLog({
      hotelId,
      roomNumber: room,
      peopleCount: addQty,
      breakfastType: addType || null,
      unitPrice: addUnitPrice,
      included: false,
      items,
      loggedBy: 'Admin',
    });
    setAdding(false);
    if (ok) {
      toast.success(`Chambre ${room} ajoutée`);
      setAddRoom('');
      setAddQty(1);
      refresh();
    } else {
      toast.error("Échec de l'ajout");
    }
  };


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
      <CardContent className="space-y-4">
        {/* Ajout manuel d'une chambre par l'admin */}
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <p className="text-sm font-medium flex items-center gap-1">
            <Plus className="h-4 w-4" /> Ajouter une chambre
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Chambre</label>
              <Select value={addRoom} onValueChange={setAddRoom}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Chambre" /></SelectTrigger>
                <SelectContent>
                  {availableRooms.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Aucune chambre disponible
                    </div>
                  ) : (
                    availableRooms.map((rn) => (
                      <SelectItem key={rn} value={rn}>{rn}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Quantité</label>
              <Input
                className="w-20"
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
              />
            </div>
            {breakfastTypes.filter((t) => t.name?.trim()).length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={addType} onValueChange={setAddType}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    {breakfastTypes.filter((t) => t.name?.trim()).map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name} — {t.price.toFixed(2)} {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleAdd} disabled={adding} className="gap-1">
              <Plus className="h-4 w-4" />
              {adding ? 'Ajout…' : `Ajouter (${(addQty * addUnitPrice).toFixed(2)} ${currency})`}
            </Button>
          </div>
        </div>

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
