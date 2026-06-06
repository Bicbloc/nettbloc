/**
 * Interface dédiée Cafetière : déclaration des petits-déjeuners par chambre.
 * Grille de toutes les chambres → un clic = nombre de personnes + type.
 * Les petits-déjeuners facturés alimentent la page « Petit-déjeuner » (admin)
 * et peuvent être envoyés au PMS pour facturation directe.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Coffee, Minus, Plus, ArrowLeft, Check, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  BreakfastConfig, BreakfastLog, loadBreakfastConfig, loadBreakfastLogs,
  upsertBreakfastLog, sendBreakfastsToPms, hasActivePmsConfig, fetchPmsRooms, todayDate,
} from '@/services/breakfastConfigService';

interface SimpleRoom {
  room_number: string;
  breakfast_included: boolean;
}

export default function CafetiereWork() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const hotelId = useMemo(() => {
    const fromUrl = params.get('hotel');
    if (fromUrl && fromUrl.length >= 30) return fromUrl;
    return storageService.getHotelId() || storageService.getHousekeeperHotelId();
  }, [params]);

  const [rooms, setRooms] = useState<SimpleRoom[]>([]);
  const [config, setConfig] = useState<BreakfastConfig | null>(null);
  const [logs, setLogs] = useState<Record<string, BreakfastLog>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [pmsConfigured, setPmsConfigured] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Quantité par prestation (clé = nom du type) + inclus dans le séjour
  const [draftItems, setDraftItems] = useState<Record<string, number>>({});
  const [draftIncluded, setDraftIncluded] = useState(false);

  const refreshLogs = useCallback(async () => {
    if (!hotelId) return;
    const list = await loadBreakfastLogs(hotelId);
    const map: Record<string, BreakfastLog> = {};
    for (const l of list) if (l.log_date === todayDate()) map[l.room_number] = l;
    setLogs(map);
  }, [hotelId]);

  const loadAll = useCallback(async () => {
    if (!hotelId) { setLoading(false); return; }
    setLoading(true);
    // Les chambres proviennent OBLIGATOIREMENT du registre des chambres
    // (alimenté en temps réel par la connexion API PMS configurée dans « Chambres »).
    const [{ data: roomData }, cfg, pmsOk] = await Promise.all([
      supabase.from('hotel_rooms_registry')
        .select('room_number')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('room_number'),
      loadBreakfastConfig(hotelId),
      hasActivePmsConfig(hotelId),
    ]);
    const list: SimpleRoom[] = (roomData || []).map((r) => ({
      room_number: r.room_number,
      breakfast_included: false,
    }));
    setRooms(list);
    setConfig(cfg);
    setPmsConfigured(pmsOk);
    await refreshLogs();
    setLoading(false);
  }, [hotelId, refreshLogs]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime sync of breakfast logs + room registry
  useEffect(() => {
    if (!hotelId) return;
    const channel = supabase
      .channel(`cafetiere-${hotelId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'breakfast_logs', filter: `hotel_id=eq.${hotelId}` },
        () => refreshLogs())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'hotel_rooms_registry', filter: `hotel_id=eq.${hotelId}` },
        () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hotelId, refreshLogs, loadAll]);



  const openRoom = (room: SimpleRoom) => {
    const existing = logs[room.room_number];
    const items: Record<string, number> = {};
    if (existing && Array.isArray(existing.items)) {
      for (const it of existing.items) items[it.name] = it.qty;
    }
    setDraftItems(items);
    setDraftIncluded(
      existing ? existing.included : (room.breakfast_included || config?.default_included || false)
    );
    setSelected(room.room_number);
  };

  const setItemQty = (name: string, delta: number) => {
    setDraftItems((prev) => {
      const next = Math.max(0, (prev[name] || 0) + delta);
      return { ...prev, [name]: next };
    });
  };

  // Sauvegarde la chambre dans nettobloc puis l'envoie au PMS si configuré.
  const validateRoom = async () => {
    if (!selected || !hotelId) { setSelected(null); return; }
    setSavingRoom(true);
    const items = (config?.breakfast_types || [])
      .map((t) => ({
        name: t.name,
        qty: draftItems[t.name] || 0,
        price: t.price,
        pms_product_id: t.pms_product_id ?? null,
        pms_tax_code: t.pms_tax_code ?? null,
      }))
      .filter((i) => i.qty > 0);
    const peopleCount = items.reduce((s, i) => s + i.qty, 0);
    const firstType = items[0]?.name || null;
    const firstUnit = items[0]?.price || 0;

    await upsertBreakfastLog({
      hotelId,
      roomNumber: selected,
      peopleCount,
      breakfastType: firstType,
      unitPrice: firstUnit,
      included: draftIncluded,
      items,
      loggedBy: 'Cafetière',
    });
    await refreshLogs();

    // Envoi direct au PMS si configuré et facturable
    if (pmsConfigured && !draftIncluded && peopleCount > 0) {
      const res = await sendBreakfastsToPms(hotelId, todayDate(), selected);
      if (res.ok && res.sent > 0) {
        toast.success(`Chambre ${selected} enregistrée et envoyée au PMS`);
      } else if (res.ok) {
        toast.success(`Chambre ${selected} enregistrée`);
      } else {
        toast.warning(`Chambre ${selected} enregistrée — envoi PMS échoué`);
      }
    } else {
      toast.success(`Chambre ${selected} enregistrée`);
    }
    setSavingRoom(false);
    setSelected(null);
  };

  const handleSendPms = async () => {
    if (!hotelId) return;
    setSending(true);
    const res = await sendBreakfastsToPms(hotelId);
    setSending(false);
    if (res.ok) {
      toast.success(`${res.sent} petit(s)-déjeuner(s) envoyé(s) au PMS${res.failed ? `, ${res.failed} échec(s)` : ''}`);
      refreshLogs();
    } else {
      toast.error(res.error || "Échec de l'envoi au PMS");
    }
  };

  const currency = config?.currency || 'EUR';
  const draftTotal = draftIncluded
    ? 0
    : (config?.breakfast_types || []).reduce((s, t) => s + (draftItems[t.name] || 0) * t.price, 0);


  const totalBillable = useMemo(
    () => Object.values(logs).reduce((s, l) => s + Number(l.total_amount || 0), 0),
    [logs]
  );
  const pendingPms = useMemo(
    () => Object.values(logs).filter((l) => !l.included && Number(l.total_amount) > 0 && l.pms_status !== 'sent').length,
    [logs]
  );

  if (!hotelId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Aucun hôtel sélectionné.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header — amber/coffee identity for cafetière */}
      <header className="sticky top-0 z-10 bg-amber-700 text-white px-4 py-3 flex items-center gap-3 shadow">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Coffee className="h-5 w-5" />
        <div className="flex-1">
          <h1 className="font-semibold leading-tight">Cafetière</h1>
          <p className="text-xs text-white/80">Touchez une chambre pour déclarer</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/80">Total du jour</p>
          <p className="font-bold">{totalBillable.toFixed(2)} {currency}</p>
        </div>
      </header>

      {loading ? (
        <p className="p-6 text-muted-foreground">Chargement…</p>
      ) : rooms.length === 0 ? (
        <p className="p-6 text-muted-foreground">Aucune chambre.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3">
          {rooms.map((room) => {
            const log = logs[room.room_number];
            const isIncluded = log ? log.included : room.breakfast_included;
            const hasCount = log && !log.included && log.people_count > 0;
            const sent = log?.pms_status === 'sent';
            return (
              <button
                key={room.room_number}
                onClick={() => openRoom(room)}
                className={[
                  'relative aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition active:scale-95',
                  hasCount
                    ? 'bg-amber-700 text-white border-amber-700'
                    : isIncluded
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-card text-foreground border-border hover:bg-muted/50',
                ].join(' ')}
              >
                {sent && (
                  <span className="absolute top-1 right-1 text-[9px] bg-white/25 rounded px-1">PMS</span>
                )}
                <span className="font-bold text-base">{room.room_number}</span>
                {hasCount ? (
                  <span className="text-xs font-medium">{log.people_count} pers.</span>
                ) : isIncluded ? (
                  <span className="text-[10px] font-medium flex items-center gap-0.5">
                    <Check className="h-3 w-3" /> Inclus
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Send to PMS bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card px-4 py-3">
        <Button
          className="w-full bg-amber-700 hover:bg-amber-800"
          disabled={sending || pendingPms === 0}
          onClick={handleSendPms}
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Envoi…' : `Envoyer au PMS (${pendingPms})`}
        </Button>
      </div>

      {/* Bottom sheet for entry */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o && !savingRoom) setSelected(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-center">Chambre {selected}</SheetTitle>
          </SheetHeader>

          <div className="py-6 space-y-5">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="font-medium">Inclus dans le séjour</span>
              <Switch checked={draftIncluded} onCheckedChange={setDraftIncluded} />
            </div>

            {!draftIncluded && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Quantité par prestation</p>
                {(config?.breakfast_types || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune prestation configurée. Configurez les types de petit-déjeuner dans l'administration.
                  </p>
                ) : (
                  (config?.breakfast_types || []).map((t) => {
                    const qty = draftItems[t.name] || 0;
                    return (
                      <div key={t.name} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.price.toFixed(2)} {currency}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Button
                            variant="outline" size="icon" className="h-10 w-10 rounded-full"
                            onClick={() => setItemQty(t.name, -1)}
                          >
                            <Minus className="h-5 w-5" />
                          </Button>
                          <span className="text-2xl font-bold w-8 text-center">{qty}</span>
                          <Button
                            variant="outline" size="icon" className="h-10 w-10 rounded-full"
                            onClick={() => setItemQty(t.name, 1)}
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <p className="text-center text-lg font-semibold">
              Total : {draftTotal.toFixed(2)} {currency}
            </p>

            <Button
              className="w-full bg-amber-700 hover:bg-amber-800"
              disabled={savingRoom}
              onClick={validateRoom}
            >
              {savingRoom ? 'Enregistrement…' : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {pmsConfigured ? 'Valider et envoyer au PMS' : 'Valider'}
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
