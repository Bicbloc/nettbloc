/**
 * Interface dédiée Cafetière : déclaration des petits-déjeuners par chambre.
 * Grille de toutes les chambres → un clic = nombre de personnes + type.
 * Les petits-déjeuners facturés alimentent la page « Petit-déjeuner » (admin)
 * et peuvent être envoyés au PMS pour facturation directe.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Coffee, Minus, Plus, ArrowLeft, Check, Search, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { stayLabel } from '@/utils/stayStatus';
import { toast } from 'sonner';
import {
  BreakfastConfig, BreakfastLog, loadBreakfastConfig, loadBreakfastLogs,
  upsertBreakfastLog, sendBreakfastsToPms, hasActivePmsConfig, fetchPmsRooms, todayDate,
  type PmsRoom,
} from '@/services/breakfastConfigService';

interface SimpleRoom {
  room_number: string;
  breakfast_included: boolean;
  guest_name: string | null;
  occupied: boolean;
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  pms_comment: string | null;
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
  const [savingRoom, setSavingRoom] = useState(false);
  const [pmsConfigured, setPmsConfigured] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmBillIncluded, setConfirmBillIncluded] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'current' | 'arrival' | 'departure'>('all');

  // Quantité par prestation (clé = nom du type) + inclus dans le séjour
  const [draftItems, setDraftItems] = useState<Record<string, number>>({});
  const [draftIncluded, setDraftIncluded] = useState(false);
  const [draftComment, setDraftComment] = useState('');

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
    const [{ data: roomData }, { data: pendingRooms }, cfg, pmsOk] = await Promise.all([
      supabase.from('hotel_rooms_registry')
        .select('room_number')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('room_number'),
      supabase.from('pms_pending_rooms')
        .select('room_number')
        .eq('hotel_id', hotelId)
        .eq('status', 'pending')
        .order('room_number'),
      loadBreakfastConfig(hotelId),
      hasActivePmsConfig(hotelId),
    ]);
    // Inclusion + occupation récupérées en temps réel depuis le PMS (Mews/Apaleo).
    // On ne facture QUE les chambres en cours de séjour : par défaut on affiche
    // les chambres occupées du PMS, avec le nom du client.
    let pmsMap: Record<string, PmsRoom> = {};
    let hasPmsRooms = false;
    if (pmsOk) {
      const pmsRooms = await fetchPmsRooms(hotelId);
      if (pmsRooms.ok && pmsRooms.rooms.length > 0) {
        hasPmsRooms = true;
        pmsMap = Object.fromEntries(
          pmsRooms.rooms.map((r) => [String(r.room_number).trim().toLowerCase(), r])
        );
      }
    }

    const roomNumbers = Array.from(new Set([
      ...(roomData || []).map((r) => r.room_number),
      ...(pendingRooms || []).map((r) => r.room_number),
      ...Object.values(pmsMap).map((r) => r.room_number),
    ]));

    const list: SimpleRoom[] = roomNumbers
      .map((roomNumber) => {
        const pmsRoom = pmsMap[String(roomNumber).trim().toLowerCase()];
        return {
          room_number: roomNumber,
          breakfast_included: pmsRoom?.breakfast_included ?? false,
          guest_name: pmsRoom?.guest_name ?? null,
          occupied: pmsRoom?.occupied ?? false,
          status: pmsRoom?.status ?? null,
          check_in: pmsRoom?.check_in ?? null,
          check_out: pmsRoom?.check_out ?? null,
          pms_comment: pmsRoom?.comment ?? null,
        };
      })
      .sort((a, b) => {
        if (a.occupied !== b.occupied) return a.occupied ? -1 : 1;
        return a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
      });

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
    setDraftComment(existing?.comment || '');
    setSelected(room.room_number);
  };

  const setItemQty = (name: string, delta: number) => {
    setDraftItems((prev) => {
      const next = Math.max(0, (prev[name] || 0) + delta);
      return { ...prev, [name]: next };
    });
  };

  // Sauvegarde la chambre dans nettobloc puis l'envoie au PMS si configuré.
  const doSaveRoom = async () => {
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
      comment: draftComment.trim() || null,
    });
    await refreshLogs();

    // Chaque prestation ajoutée est immédiatement envoyée au PMS. La fonction
    // edge ne facture que le delta (nouvelles prestations non encore envoyées),
    // donc on peut en ajouter autant que voulu sans jamais facturer en double.
    if (pmsConfigured && !draftIncluded && peopleCount > 0) {
      const res = await sendBreakfastsToPms(hotelId, todayDate(), selected);
      if (res.ok && res.sent > 0) {
        toast.success(`Chambre ${selected} enregistrée et envoyée au PMS`);
      } else if (res.ok) {
        toast.success(`Chambre ${selected} enregistrée (aucune nouvelle prestation à envoyer)`);
      } else {
        toast.warning(`Chambre ${selected} enregistrée — envoi PMS échoué`);
      }
    } else {
      toast.success(`Chambre ${selected} enregistrée`);
    }
    setSavingRoom(false);
    setSelected(null);
  };

  const validateRoom = async () => {
    if (!selected || !hotelId) { setSelected(null); return; }
    const room = rooms.find((r) => r.room_number === selected);
    const peopleCount = (config?.breakfast_types || [])
      .reduce((s, t) => s + (draftItems[t.name] || 0), 0);
    // La chambre a déjà le petit-déjeuner inclus mais on tente de la facturer :
    // demander une reconfirmation avant de facturer quand même.
    if (room?.breakfast_included && !draftIncluded && peopleCount > 0) {
      setConfirmBillIncluded(true);
      return;
    }
    await doSaveRoom();
  };



  const currency = config?.currency || 'EUR';
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';
  const stayRange = (ci: string | null, co: string | null) =>
    ci || co ? `${fmtDate(ci)}${co ? ` → ${fmtDate(co)}` : ''}` : '';
  const draftTotal = draftIncluded
    ? 0
    : (config?.breakfast_types || []).reduce((s, t) => s + (draftItems[t.name] || 0) * t.price, 0);


  const totalBillable = useMemo(
    () => Object.values(logs).reduce((s, l) => s + Number(l.total_amount || 0), 0),
    [logs]
  );
  const selectedRoom = useMemo(
    () => rooms.find((r) => r.room_number === selected) ?? null,
    [rooms, selected]
  );
  const selectedGuestName = selectedRoom?.guest_name ?? null;

  // Filtre par statut de séjour + recherche par numéro/nom de client.
  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((room) => {
      if (statusFilter !== 'all') {
        const s = (room.status || '').toLowerCase();
        const isDeparture = s.includes('depart') || s.includes('checkout') || s.includes('check-out');
        const isArrival = s.includes('arriv') || s.includes('reserved');
        const isCurrent = !isDeparture && !isArrival && (room.occupied || s.length > 0);
        if (statusFilter === 'departure' && !isDeparture) return false;
        if (statusFilter === 'arrival' && !isArrival) return false;
        if (statusFilter === 'current' && !isCurrent) return false;
      }
      if (q) {
        const hay = `${room.room_number} ${room.guest_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rooms, search, statusFilter]);


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

      {/* Recherche + filtres par statut de séjour */}
      <div className="px-3 pt-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une chambre ou un client…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { key: 'all', label: 'Toutes' },
            { key: 'current', label: 'En cours' },
            { key: 'arrival', label: 'Arrivée' },
            { key: 'departure', label: 'Départ' },
          ] as const).map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? 'default' : 'outline'}
              className={statusFilter === f.key ? 'bg-amber-700 hover:bg-amber-800 shrink-0' : 'shrink-0'}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-muted-foreground">Chargement…</p>
      ) : rooms.length === 0 ? (
        <p className="p-6 text-muted-foreground">Aucune chambre en cours de séjour.</p>
      ) : filteredRooms.length === 0 ? (
        <p className="p-6 text-muted-foreground">Aucune chambre ne correspond au filtre.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3">
          {filteredRooms.map((room) => {
            const log = logs[room.room_number];
            const isIncluded = log ? log.included : room.breakfast_included;
            const hasCount = log && !log.included && log.people_count > 0;
            const sent = log?.pms_status === 'sent';
            const stay = stayLabel(room.status, room.occupied);
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
                {(log?.comment || room.pms_comment) && (
                  <MessageSquare className="absolute top-1 left-1 h-3 w-3 opacity-70" />
                )}
                <span className="font-bold text-base">{room.room_number}</span>
                {room.guest_name && (
                  <span className="text-[9px] leading-tight text-center px-0.5 line-clamp-2 opacity-90">
                    {room.guest_name}
                  </span>
                )}
                {stayRange(room.check_in, room.check_out) && (
                  <span className={[
                    'text-[8px] tabular-nums',
                    hasCount ? 'text-white/80' : 'text-muted-foreground',
                  ].join(' ')}>
                    {stayRange(room.check_in, room.check_out)}
                  </span>
                )}
                {stay.label && (
                  <span className={[
                    'text-[8px] font-semibold uppercase tracking-wide',
                    hasCount ? 'text-white/90' : stay.className,
                  ].join(' ')}>
                    {stay.label}
                  </span>
                )}
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


      {/* Bottom sheet for entry */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o && !savingRoom) setSelected(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-center">Chambre {selected}</SheetTitle>
            {selectedGuestName && (
              <p className="text-center text-sm text-muted-foreground">{selectedGuestName}</p>
            )}
            {stayRange(selectedRoom?.check_in ?? null, selectedRoom?.check_out ?? null) && (
              <p className="text-center text-xs text-muted-foreground">
                Séjour : {stayRange(selectedRoom?.check_in ?? null, selectedRoom?.check_out ?? null)}
              </p>
            )}
          </SheetHeader>

          <div className="py-6 space-y-5">
            {selectedRoom?.pms_comment && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm flex gap-2">
                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Commentaire PMS</p>
                  <p>{selectedRoom.pms_comment}</p>
                </div>
              </div>
            )}
            {rooms.find((r) => r.room_number === selected)?.breakfast_included && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Cette chambre a le petit-déjeuner <strong>inclus</strong> dans le séjour.
                Vous pouvez tout de même la facturer en désactivant « Inclus dans le séjour » —
                une confirmation vous sera demandée.
              </div>
            )}
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

            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Commentaire
              </label>
              <Textarea
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                placeholder="Remarque (optionnel)…"
                rows={2}
              />
            </div>

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

      {/* Reconfirmation : facturer une chambre dont le PDJ est déjà inclus */}
      <AlertDialog open={confirmBillIncluded} onOpenChange={setConfirmBillIncluded}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Facturer un petit-déjeuner inclus ?</AlertDialogTitle>
            <AlertDialogDescription>
              La chambre {selected} a déjà le petit-déjeuner inclus dans le séjour.
              Voulez-vous quand même la facturer ({draftTotal.toFixed(2)} {currency})
              et l'envoyer au PMS ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-700 hover:bg-amber-800"
              onClick={async () => { setConfirmBillIncluded(false); await doSaveRoom(); }}
            >
              Facturer quand même
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
