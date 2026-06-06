/**
 * Onglet admin : page Petit-déjeuner.
 * Page principale = chambres (registre / Mews) + petits-déjeuners du jour.
 * La configuration (facturation, types, PMS) est regroupée dans un panneau réglages.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Coffee, Plus, Trash2, Save, ExternalLink, Plug, Download, Eye, BedDouble,
  RefreshCw, Check, Settings,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  BreakfastConfig, BreakfastType, loadBreakfastConfig, saveBreakfastConfig, testPmsConnectivity,
  fetchPmsProducts, fetchPmsRooms, PmsProduct, PmsRoom,
} from '@/services/breakfastConfigService';
import { BreakfastBilledSection } from '@/components/dashboard/BreakfastBilledSection';

interface BreakfastTabProps {
  currentHotelId: string | null;
}

export function BreakfastTab({ currentHotelId }: BreakfastTabProps) {
  const [config, setConfig] = useState<BreakfastConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [previewProducts, setPreviewProducts] = useState<PmsProduct[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Chambres : registre (canonique) + inclusion PDJ depuis le PMS.
  const [registryRooms, setRegistryRooms] = useState<string[]>([]);
  const [pmsRooms, setPmsRooms] = useState<PmsRoom[] | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [roomStatusFilter, setRoomStatusFilter] = useState<'all' | 'current' | 'arrival' | 'departure'>('all');



  useEffect(() => {
    if (!currentHotelId) return;
    setLoading(true);
    loadBreakfastConfig(currentHotelId)
      .then(setConfig)
      .finally(() => setLoading(false));
  }, [currentHotelId]);

  // Charge les chambres du registre + l'inclusion PDJ récupérée du PMS.
  const loadRooms = useCallback(async () => {
    if (!currentHotelId) return;
    setRoomsLoading(true);
    const [{ data: reg }, pms] = await Promise.all([
      supabase.from('hotel_rooms_registry')
        .select('room_number')
        .eq('hotel_id', currentHotelId)
        .eq('is_active', true)
        .order('room_number'),
      fetchPmsRooms(currentHotelId),
    ]);
    setRegistryRooms((reg || []).map((r) => r.room_number));
    setPmsRooms(pms.ok ? pms.rooms : []);
    setRoomsLoading(false);
  }, [currentHotelId]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  if (!currentHotelId) {
    return <p className="text-muted-foreground">Sélectionnez un hôtel.</p>;
  }
  if (loading || !config) {
    return <p className="text-muted-foreground">Chargement…</p>;
  }

  const update = (patch: Partial<BreakfastConfig>) =>
    setConfig((c) => (c ? { ...c, ...patch } : c));

  const updateType = (i: number, patch: Partial<BreakfastType>) =>
    update({
      breakfast_types: config.breakfast_types.map((t, idx) =>
        idx === i ? { ...t, ...patch } : t
      ),
    });

  const addType = () =>
    update({ breakfast_types: [...config.breakfast_types, { name: '', price: config.price_per_person }] });

  const removeType = (i: number) =>
    update({ breakfast_types: config.breakfast_types.filter((_, idx) => idx !== i) });

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveBreakfastConfig(config);
    setSaving(false);
    toast[ok ? 'success' : 'error'](
      ok ? 'Configuration enregistrée' : "Échec de l'enregistrement"
    );
  };

  const handleTest = async () => {
    if (!currentHotelId) return;
    setTesting(true);
    setTestResult(null);
    const res = await testPmsConnectivity(currentHotelId);
    setTesting(false);
    setTestResult(res);
    if (res.ok) {
      toast.success(`Connexion ${String(res.pms || 'PMS').toUpperCase()} OK`);
    } else {
      toast.error(res.error || 'Connexion PMS impossible');
    }
  };

  const handleImportProducts = async () => {
    if (!currentHotelId) return;
    setImporting(true);
    const res = await fetchPmsProducts(currentHotelId);
    setImporting(false);
    if (!res.ok) {
      toast.error(res.error || 'Import des prestations impossible');
      return;
    }
    if (res.products.length === 0) {
      toast.warning('Aucune prestation trouvée dans le PMS pour ce service.');
      return;
    }
    const types: BreakfastType[] = res.products.map((p) => ({
      name: p.name,
      price: p.price,
      pms_product_id: p.id,
      pms_tax_code: p.taxCode,
    }));
    update({
      breakfast_types: types,
      pricing_source: 'pms',
      ...(res.service_id ? { pms_service_id: res.service_id } : {}),
    });
    toast.success(`${types.length} prestation(s) importée(s) depuis le PMS. Pensez à enregistrer.`);
  };

  // Prévisualise les prestations récupérables depuis le PMS, sans les importer.
  const handlePreviewProducts = async () => {
    if (!currentHotelId) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewProducts(null);
    const res = await fetchPmsProducts(currentHotelId);
    setPreviewLoading(false);
    if (!res.ok) {
      toast.error(res.error || 'Récupération impossible');
      setPreviewProducts([]);
      return;
    }
    setPreviewProducts(res.products);
  };

  // Pour la facturation, on ne propose QUE les chambres en cours de séjour
  // (occupées dans le PMS). À défaut de PMS, on retombe sur le registre.
  const inStayRooms = (pmsRooms || []).filter((r) => r.occupied).map((r) => r.room_number);
  const availableRooms = (inStayRooms.length > 0
    ? inStayRooms
    : registryRooms
  )
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));


  const inclusionByRoom: Record<string, boolean> = {};
  const occupiedByRoom: Record<string, boolean> = {};
  const guestByRoom: Record<string, string | null> = {};
  const statusByRoom: Record<string, string | null> = {};
  for (const r of pmsRooms || []) {
    const key = String(r.room_number).trim().toLowerCase();
    inclusionByRoom[key] = r.breakfast_included;
    occupiedByRoom[key] = r.occupied;
    guestByRoom[key] = r.guest_name;
    statusByRoom[key] = r.status;
  }

  // Étiquette d'occupation : « En cours » pour les chambres pas encore parties,
  // « Arrivée » pour les check-in du jour, « Check-out » pour les départs.
  const stayLabel = (status: string | null | undefined): { label: string; tone: string } | null => {
    if (status === 'departure') return { label: 'Check-out', tone: 'text-rose-600' };
    if (status === 'arrival') return { label: 'Arrivée', tone: 'text-blue-600' };
    if (status) return { label: 'En cours', tone: 'text-emerald-600' };
    return null;
  };

  // On affiche d'abord les chambres en séjour (occupées), puis le reste.
  const gridRooms = (availableRooms.length > 0
    ? availableRooms
    : (pmsRooms || []).map((r) => r.room_number)
  ).slice().sort((a, b) => {
    const oa = occupiedByRoom[a.trim().toLowerCase()] ? 0 : 1;
    const ob = occupiedByRoom[b.trim().toLowerCase()] ? 0 : 1;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  // Filtre par statut de séjour + recherche (numéro de chambre / nom du client).
  const filteredGridRooms = gridRooms.filter((rn) => {
    const key = rn.trim().toLowerCase();
    if (roomStatusFilter !== 'all') {
      const s = (statusByRoom[key] || '').toLowerCase();
      const isDeparture = s.includes('depart') || s.includes('checkout') || s.includes('check-out');
      const isArrival = s.includes('arriv') || s.includes('reserved');
      const isCurrent = !isDeparture && !isArrival && (occupiedByRoom[key] || s.length > 0);
      if (roomStatusFilter === 'departure' && !isDeparture) return false;
      if (roomStatusFilter === 'arrival' && !isArrival) return false;
      if (roomStatusFilter === 'current' && !isCurrent) return false;
    }
    const q = roomSearch.trim().toLowerCase();
    if (q) {
      const hay = `${rn} ${guestByRoom[key] || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const includedCount = gridRooms.filter((rn) => inclusionByRoom[rn.trim().toLowerCase()]).length;
  const occupiedCount = gridRooms.filter((rn) => occupiedByRoom[rn.trim().toLowerCase()]).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coffee className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Petit-déjeuner</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={() => window.open(`/cafetiere?hotel=${currentHotelId}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" /> Interface Cafetière
          </Button>
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-2">
                <Settings className="h-4 w-4" /> Configuration
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Configuration petit-déjeuner</SheetTitle>
                <SheetDescription>
                  Facturation, types de prestations et connexion PMS.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-4">
                {/* Facturation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Facturation</CardTitle>
                    <CardDescription>
                      Activez la facturation et choisissez la source des tarifs.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bf-active">Activer la facturation petit-déjeuner</Label>
                      <Switch
                        id="bf-active"
                        checked={config.is_active}
                        onCheckedChange={(v) => update({ is_active: v })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Source du prix</Label>
                      <Select
                        value={config.pricing_source}
                        onValueChange={(v) => update({ pricing_source: v as 'manual' | 'pms' })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Configuré par le client</SelectItem>
                          <SelectItem value="pms">Récupéré depuis le PMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bf-price">Prix par personne</Label>
                        <Input
                          id="bf-price"
                          type="number"
                          min={0}
                          step="0.01"
                          value={config.price_per_person}
                          disabled={config.pricing_source === 'pms'}
                          onChange={(e) => update({ price_per_person: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bf-currency">Devise</Label>
                        <Input
                          id="bf-currency"
                          value={config.currency}
                          onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="bf-incl">Chambres incluses par défaut</Label>
                        <p className="text-xs text-muted-foreground">
                          Marque les nouvelles déclarations comme « inclus » (non facturé).
                        </p>
                      </div>
                      <Switch
                        id="bf-incl"
                        checked={config.default_included}
                        onCheckedChange={(v) => update({ default_included: v })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Types de petit-déjeuner */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Types de petit-déjeuner</CardTitle>
                    <CardDescription>
                      Importez les prestations directement depuis votre PMS (Mews / Apaleo) —
                      une seule configuration — ou ajoutez-les manuellement.
                    </CardDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button
                        variant="secondary" size="sm" className="gap-2 w-fit"
                        onClick={handleImportProducts} disabled={importing}
                      >
                        <Download className="h-4 w-4" />
                        {importing ? 'Import en cours…' : 'Importer depuis le PMS'}
                      </Button>
                      <Button
                        variant="outline" size="sm" className="gap-2 w-fit"
                        onClick={handlePreviewProducts} disabled={previewLoading}
                        title="Voir les prestations récupérables depuis le PMS"
                      >
                        <Eye className="h-4 w-4" />
                        {previewLoading ? 'Test…' : 'Tester / voir'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {config.breakfast_types.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Aucun type. Le prix par personne est utilisé par défaut.
                      </p>
                    )}
                    {config.breakfast_types.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          placeholder="Nom"
                          value={t.name}
                          onChange={(e) => updateType(i, { name: e.target.value })}
                        />
                        <Input
                          className="w-28"
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Prix"
                          value={t.price}
                          onChange={(e) => updateType(i, { price: Number(e.target.value) })}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeType(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addType} className="gap-2">
                      <Plus className="h-4 w-4" /> Ajouter un type
                    </Button>
                  </CardContent>
                </Card>

                {/* Facturation PMS */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Connexion PMS</CardTitle>
                    <CardDescription>
                      La facturation utilise la connexion PMS configurée dans
                      « Chambres → Connexion API PMS ». Service et code de taxe (Mews)
                      détectés automatiquement.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
                      <Plug className="h-4 w-4" />
                      {testing ? 'Test en cours…' : 'Tester la connexion PMS'}
                    </Button>
                    {testResult && (
                      <div className="rounded-lg border p-3 text-xs bg-muted/40 space-y-1">
                        {testResult.ok ? (
                          <>
                            <p className="font-medium text-emerald-600">
                              Connexion {String(testResult.pms || '').toUpperCase()} : OK
                            </p>
                            {'reservations_in_house' in testResult && (
                              <p>Réservations en cours : {String(testResult.reservations_in_house)}</p>
                            )}
                            {'services' in testResult && (
                              <p>Services PMS détectés : {String(testResult.services)}
                                {'orderable_services' in testResult && ` (dont ${String(testResult.orderable_services)} facturables)`}
                              </p>
                            )}
                            {testResult.suggested_service_name && (
                              <p>Service utilisé : <span className="font-medium">{String(testResult.suggested_service_name)}</span></p>
                            )}
                            {'billable_rooms' in testResult && (
                              <p>Chambres facturables aujourd'hui : {String(testResult.billable_rooms)}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-destructive">{String(testResult.error || 'Erreur')}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
                  <Save className="h-4 w-4" />
                  {saving ? 'Enregistrement…' : 'Enregistrer la configuration'}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Page principale : chambres + petits-déjeuners du jour */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Chambres &amp; petit-déjeuner</CardTitle>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={loadRooms} disabled={roomsLoading}>
              <RefreshCw className={`h-4 w-4 ${roomsLoading ? 'animate-spin' : ''}`} />
              {roomsLoading ? 'Chargement…' : 'Actualiser'}
            </Button>
          </div>
          <CardDescription>
            Chambres du registre (synchronisées avec le PMS). En vert : petit-déjeuner
            déjà inclus dans la réservation ; en ambre : occupée non incluse ; en gris : libre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roomsLoading && pmsRooms === null ? (
            <p className="text-sm text-muted-foreground">Chargement des chambres…</p>
          ) : gridRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune chambre. Importez le registre des chambres ou configurez la connexion PMS.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 mb-3 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                  Inclus ({includedCount})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-amber-500 inline-block" />
                  Occupée non incluse
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-muted inline-block border" />
                  Libre
                </span>
                <span className="ml-auto text-muted-foreground">En séjour : {occupiedCount}</span>
              </div>

              {/* Recherche + filtres par statut de séjour */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    placeholder="Rechercher une chambre ou un client…"
                    className="pl-9 h-9"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto">
                  {([
                    { key: 'all', label: 'Toutes' },
                    { key: 'current', label: 'En cours' },
                    { key: 'arrival', label: 'Arrivée' },
                    { key: 'departure', label: 'Départ' },
                  ] as const).map((f) => (
                    <Button
                      key={f.key}
                      size="sm"
                      variant={roomStatusFilter === f.key ? 'default' : 'outline'}
                      className="shrink-0 h-9"
                      onClick={() => setRoomStatusFilter(f.key)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>

              {filteredGridRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Aucune chambre ne correspond au filtre.</p>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {filteredGridRooms.map((rn) => {

                  const key = rn.trim().toLowerCase();
                  const included = inclusionByRoom[key];
                  const occupied = occupiedByRoom[key];
                  const guest = guestByRoom[key];
                  const stay = stayLabel(statusByRoom[key]);
                  const cls = included
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : occupied
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-card border-border text-muted-foreground';
                  return (
                    <div key={rn} className={`rounded-lg border p-2 text-center ${cls}`}>
                      <div className="flex items-center justify-center gap-1">
                        <p className="font-bold text-sm">{rn}</p>
                        {stay && <span className={`text-[9px] font-semibold ${stay.tone}`}>{stay.label}</span>}
                      </div>
                      {guest && (
                        <p className="text-[10px] truncate text-foreground/80" title={guest}>{guest}</p>
                      )}
                      <p className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                        {included ? (<><Check className="h-3 w-3" /> Inclus</>) : occupied ? 'Non inclus' : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
              )}
            </>

          )}
        </CardContent>
      </Card>

      <BreakfastBilledSection
        hotelId={currentHotelId}
        currency={config.currency || 'EUR'}
        breakfastTypes={config.breakfast_types}
        pricePerPerson={config.price_per_person}
        availableRooms={availableRooms}
        roomMeta={Object.fromEntries(
          availableRooms.map((rn) => {
            const key = rn.trim().toLowerCase();
            return [rn, { guest_name: guestByRoom[key] ?? null, status: statusByRoom[key] ?? null }];
          })
        )}
      />


      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Prestations récupérables depuis le PMS</DialogTitle>
            <DialogDescription>
              Aperçu des prestations petit-déjeuner détectées. Utilisez « Importer » pour les ajouter.
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <p className="text-sm text-muted-foreground py-4">Récupération en cours…</p>
          ) : !previewProducts || previewProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aucune prestation trouvée.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {previewProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="font-medium shrink-0 ml-2">
                    {p.price.toFixed(2)} {p.currency || config.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
