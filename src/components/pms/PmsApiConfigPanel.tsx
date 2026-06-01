import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { FeatureGuard } from '@/components/FeatureGuard';
import { 
  Plug, TestTube, RefreshCw, CheckCircle2, XCircle, Clock, 
  Eye, EyeOff, Trash2, Loader2, Wifi, DoorOpen, Download, Users, ListChecks, ChevronDown
} from 'lucide-react';
import { PendingRoomsSection } from './PendingRoomsSection';

interface PreviewRoom {
  roomNumber: string;
  floor: number | null;
  roomType: string | null;
  cleaningType: string;
  condition?: string | null;
  guestName: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
}

const cleaningLabel = (t: string): { label: string; className: string } => {
  const v = (t || '').toLowerCase();
  if (v === 'depart' || v === 'a_blanc' || v === 'full') return { label: 'À blanc', className: 'bg-orange-500/15 text-orange-600 border-orange-500/30' };
  if (v === 'arrivee') return { label: 'Arrivée', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
  if (v === 'recouche' || v === 'quick' || v === 'occupied') return { label: 'Recouche', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' };
  if (v === 'hors_service') return { label: 'Hors service', className: 'bg-red-500/15 text-red-600 border-red-500/30' };
  return { label: 'Rien à faire', className: 'bg-muted text-muted-foreground' };
};

const conditionLabel = (c: string | null): { label: string; className: string } => {
  switch (c) {
    case 'Clean': return { label: 'Propre', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
    case 'CleanToBeInspected': return { label: 'À inspecter', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
    case 'Dirty': return { label: 'Sale', className: 'bg-orange-500/15 text-orange-600 border-orange-500/30' };
    case 'OutOfService':
    case 'OutOfOrder': return { label: 'Hors service', className: 'bg-red-500/15 text-red-600 border-red-500/30' };
    default: return { label: '—', className: 'bg-muted text-muted-foreground' };
  }
};


interface PmsConfig {
  id?: string;
  pms_type: string;
  credentials: Record<string, string>;
  base_url: string;
  property_id: string;
  is_active: boolean;
  sync_frequency: number;
  auto_sync_enabled: boolean;
  auto_sync_time: string;
  last_auto_sync_date: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

const PMS_TYPES = [
  { value: 'mews', label: 'Mews', fields: ['clientToken', 'accessToken'], fieldLabels: { clientToken: 'Client Token', accessToken: 'Access Token' } },
  { value: 'apaleo', label: 'Apaleo', fields: ['clientId', 'clientSecret', 'propertyId'], fieldLabels: { clientId: 'Client ID', clientSecret: 'Client Secret', propertyId: 'Property ID' } },
  { value: 'opera', label: 'Opera Cloud', fields: ['clientId', 'clientSecret', 'propertyId'], fieldLabels: { clientId: 'Client ID', clientSecret: 'Client Secret', propertyId: 'Property ID' } },
  { value: 'mister_booking', label: 'Mister Booking', fields: ['apiKey', 'propertyId'], fieldLabels: { apiKey: 'Clé API', propertyId: 'ID Établissement' } },
  { value: 'protel', label: 'Protel', fields: ['apiKey', 'baseUrl'], fieldLabels: { apiKey: 'Token API', baseUrl: 'URL Serveur' } },
  { value: 'medialog', label: 'Medialog', fields: ['apiKey'], fieldLabels: { apiKey: 'Clé API' } },
];

const SYNC_FREQUENCIES = [
  { value: 15, label: 'Toutes les 15 minutes' },
  { value: 30, label: 'Toutes les 30 minutes' },
  { value: 60, label: 'Toutes les heures' },
  { value: 120, label: 'Toutes les 2 heures' },
];

export function PmsApiConfigPanel({ onActiveChange }: { onActiveChange?: (active: boolean) => void } = {}) {
  const { hotelId } = useHotel();
  const navigate = useNavigate();
  const [config, setConfig] = useState<PmsConfig>({
    pms_type: '',
    credentials: {},
    base_url: '',
    property_id: '',
    is_active: false,
    sync_frequency: 30,
    auto_sync_enabled: true,
    auto_sync_time: '06:00',
    last_auto_sync_date: null,
    last_sync_at: null,
    last_sync_status: null,
    last_sync_error: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [previewRooms, setPreviewRooms] = useState<PreviewRoom[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);

  // Once the connection is configured (saved + active), collapse the section
  // and let the parent hide the manual import controls.
  const isConfigured = !!config.id && config.is_active;
  useEffect(() => {
    onActiveChange?.(isConfigured);
  }, [isConfigured, onActiveChange]);

  useEffect(() => {
    if (hotelId) loadConfig();
  }, [hotelId]);


  const loadConfig = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotel_pms_configs' as any)
        .select('*')
        .eq('hotel_id', hotelId)
        .maybeSingle();

      if (data && !error) {
        setConfig({
          id: (data as any).id,
          pms_type: (data as any).pms_type || '',
          credentials: (data as any).credentials || {},
          base_url: (data as any).base_url || '',
          property_id: (data as any).property_id || '',
          is_active: (data as any).is_active || false,
          sync_frequency: (data as any).sync_frequency || 30,
          auto_sync_enabled: (data as any).auto_sync_enabled ?? true,
          auto_sync_time: ((data as any).auto_sync_time || '06:00:00').slice(0, 5),
          last_auto_sync_date: (data as any).last_auto_sync_date ?? null,
          last_sync_at: (data as any).last_sync_at,
          last_sync_status: (data as any).last_sync_status,
          last_sync_error: (data as any).last_sync_error,
        });
      }
    } catch (err) {
      console.error('Error loading PMS config:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!hotelId || !config.pms_type) return;
    setSaving(true);
    try {
      const payload = {
        hotel_id: hotelId,
        pms_type: config.pms_type,
        credentials: config.credentials,
        base_url: config.base_url || null,
        property_id: config.property_id || null,
        is_active: config.is_active,
        sync_frequency: config.sync_frequency,
        auto_sync_enabled: config.auto_sync_enabled,
        auto_sync_time: config.auto_sync_time,

      };

      if (config.id) {
        await supabase
          .from('hotel_pms_configs' as any)
          .update(payload as any)
          .eq('id', config.id);
      } else {
        const { data } = await supabase
          .from('hotel_pms_configs' as any)
          .insert(payload as any)
          .select('id')
          .single();
        if (data) setConfig(prev => ({ ...prev, id: (data as any).id }));
      }

      toast({ title: 'Configuration sauvegardée', description: 'Les paramètres API PMS ont été enregistrés.' });
    } catch (err) {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder la configuration.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!hotelId) return;
    setTesting(true);
    setPreviewRooms(null);
    setImported(false);
    try {
      // Save first
      await saveConfig();

      const { data, error } = await supabase.functions.invoke('pms-sync', {
        body: { hotel_id: hotelId, action: 'test' },
      });

      if (error) {
        toast({
          title: '❌ Échec de connexion',
          description: "Le serveur n'a pas répondu correctement. Vérifiez vos identifiants et réessayez.",
          variant: 'destructive',
        });
        return;
      }

      if (data?.success) {
        setPreviewRooms(Array.isArray(data.rooms) ? data.rooms : []);
        toast({ title: '✅ Connexion réussie', description: data.message });
      } else {
        toast({ title: '❌ Échec de connexion', description: data?.error || 'Erreur inconnue', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Test échoué', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const importRooms = async () => {
    if (!hotelId) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('pms-sync', {
        body: { hotel_id: hotelId, action: 'import' },
      });

      if (error) {
        toast({ title: 'Erreur', description: "L'import n'a pas pu être effectué.", variant: 'destructive' });
        return;
      }

      if (data?.success) {
        setImported(true);
        toast({
          title: '✅ Chambres enregistrées',
          description: `${data.rooms_synced ?? previewRooms?.length ?? 0} chambres ajoutées au registre.`,
        });
        loadConfig();
      } else {
        toast({ title: '❌ Échec', description: data?.error || 'Import impossible', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Import échoué', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };


  const syncNow = async () => {
    if (!hotelId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pms-sync', {
        body: { hotel_id: hotelId, action: 'sync' },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: '✅ Synchronisation terminée', description: data.message });
        loadConfig(); // Refresh to show last_sync
        setPendingRefreshKey(k => k + 1);
      } else {
        toast({ title: '❌ Échec synchronisation', description: data?.error || 'Erreur', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Sync échouée', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const registerWebhook = async () => {
    if (!hotelId) return;
    setRegisteringWebhook(true);
    try {
      await saveConfig();
      const { data, error } = await supabase.functions.invoke('apaleo-register-webhook', {
        body: { hotel_id: hotelId },
      });
      if (error) throw error;
      if (data?.ok) {
        toast({
          title: '✅ Temps réel activé',
          description:
            data.status === 'already_registered'
              ? 'Les notifications check-in / check-out étaient déjà activées dans Apaleo.'
              : 'Apaleo enverra désormais les check-in / check-out instantanément à Nettobloc.',
        });
      } else {
        toast({ title: '❌ Activation impossible', description: data?.error || 'Erreur inconnue', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Activation échouée', variant: 'destructive' });
    } finally {
      setRegisteringWebhook(false);
    }
  };

  const deleteConfig = async () => {
    if (!config.id) return;
    try {
      await supabase
        .from('hotel_pms_configs' as any)
        .delete()
        .eq('id', config.id);
      
      setConfig({
        pms_type: '', credentials: {}, base_url: '', property_id: '',
        is_active: false, sync_frequency: 30,
        auto_sync_enabled: true, auto_sync_time: '06:00', last_auto_sync_date: null,
        last_sync_at: null, last_sync_status: null, last_sync_error: null,
      });
      toast({ title: 'Configuration supprimée' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const selectedPms = PMS_TYPES.find(p => p.value === config.pms_type);

  const toggleSecret = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const collapsed = isConfigured && !expanded;

  return (
    <FeatureGuard feature="api_access">
      <Card data-pms-config>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Connexion API PMS</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {config.is_active && (
                <Badge variant="default" className="bg-primary">
                  <Wifi className="h-3 w-3 mr-1" />
                  Actif
                </Badge>
              )}
              {isConfigured && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(e => !e)}
                  className="gap-1"
                >
                  {expanded ? 'Réduire' : 'Configurer'}
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            {collapsed
              ? `${selectedPms?.label || config.pms_type} connecté — synchronisation en temps réel active`
              : 'Connectez votre PMS pour synchroniser automatiquement les chambres'}
          </CardDescription>
        </CardHeader>



        {!collapsed && (
        <CardContent className="space-y-6">
          {/* PMS Type Selection */}
          <div className="space-y-2">
            <Label>Type de PMS</Label>
            <Select 
              value={config.pms_type} 
              onValueChange={(v) => setConfig(prev => ({ ...prev, pms_type: v, credentials: {} }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir votre PMS" />
              </SelectTrigger>
              <SelectContent>
                {PMS_TYPES.map(pms => (
                  <SelectItem key={pms.value} value={pms.value}>
                    {pms.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Credential Fields */}
          {selectedPms && (
            <div className="space-y-4">
              <Separator />
              <h4 className="font-medium text-sm text-muted-foreground">Identifiants API</h4>
              
              {selectedPms.fields.map(field => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={field}>
                    {selectedPms.fieldLabels[field as keyof typeof selectedPms.fieldLabels] || field}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={field}
                      type={showSecrets[field] ? 'text' : 'password'}
                      value={config.credentials[field] || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        credentials: { ...prev.credentials, [field]: e.target.value }
                      }))}
                      placeholder={`Entrer ${selectedPms.fieldLabels[field as keyof typeof selectedPms.fieldLabels] || field}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSecret(field)}
                      type="button"
                    >
                      {showSecrets[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sync Settings */}
          {config.pms_type && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Paramètres de synchronisation</h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Synchronisation automatique</Label>
                    <p className="text-xs text-muted-foreground">Active la synchro périodique</p>
                  </div>
                  <Switch
                    checked={config.is_active}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, is_active: v }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Fréquence</Label>
                  <Select
                    value={String(config.sync_frequency)}
                    onValueChange={(v) => setConfig(prev => ({ ...prev, sync_frequency: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYNC_FREQUENCIES.map(f => (
                        <SelectItem key={f.value} value={String(f.value)}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Synchro automatique chaque matin</Label>
                      <p className="text-xs text-muted-foreground">
                        Recrée les chambres du jour (départs, recouches…) prêtes pour l'affectation
                      </p>
                    </div>
                    <Switch
                      checked={config.auto_sync_enabled}
                      onCheckedChange={(v) => setConfig(prev => ({ ...prev, auto_sync_enabled: v }))}
                    />
                  </div>

                  {config.auto_sync_enabled && (
                    <div className="space-y-2">
                      <Label>Heure de synchro</Label>
                      <Input
                        type="time"
                        value={config.auto_sync_time}
                        onChange={(e) => setConfig(prev => ({ ...prev, auto_sync_time: e.target.value }))}
                        className="w-40"
                      />
                      <p className="text-xs text-muted-foreground">
                        Heure locale de l'établissement. Par défaut 06:00.
                        {config.last_auto_sync_date && (
                          <> Dernière synchro auto : {config.last_auto_sync_date}.</>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </>
          )}

          {/* Last Sync Status */}
          {config.last_sync_at && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {config.last_sync_status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : config.last_sync_status === 'error' ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">
                    Dernière synchro : {new Date(config.last_sync_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                {config.last_sync_error && (
                  <p className="text-xs text-destructive">{config.last_sync_error}</p>
                )}
              </div>
            </>
          )}

          {/* Aperçu des chambres récupérées depuis le PMS */}
          {previewRooms && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">
                    {previewRooms.length} chambre{previewRooms.length > 1 ? 's' : ''} trouvée{previewRooms.length > 1 ? 's' : ''}
                  </h4>
                </div>

                {previewRooms.length > 0 && (
                  <ScrollArea className="h-64 rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur text-muted-foreground">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium">Chambre</th>
                          <th className="px-3 py-2 font-medium">Étage</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">État ménage</th>
                          <th className="px-3 py-2 font-medium">Nettoyage</th>
                          <th className="px-3 py-2 font-medium">Client</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRooms.map((r) => {
                          const c = cleaningLabel(r.cleaningType);
                          const cond = conditionLabel(r.condition ?? null);
                          return (
                            <tr key={r.roomNumber} className="border-t">
                              <td className="px-3 py-2 font-medium">{r.roomNumber}</td>
                              <td className="px-3 py-2">{r.floor ?? '—'}</td>
                              <td className="px-3 py-2">{r.roomType ?? '—'}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className={cond.className}>{cond.label}</Badge>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className={c.className}>{c.label}</Badge>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{r.guestName ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}

                {previewRooms.length > 0 && !imported && (
                  <Button onClick={importRooms} disabled={importing} className="w-full sm:w-auto">
                    {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Enregistrer ces {previewRooms.length} chambres dans le registre
                  </Button>
                )}

                {imported && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      Chambres enregistrées dans le registre
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate('/room-registry')}>
                        <ListChecks className="h-4 w-4 mr-2" />
                        Voir le registre
                      </Button>
                      <Button size="sm" onClick={() => navigate('/')}>
                        <Users className="h-4 w-4 mr-2" />
                        Affecter les chambres
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <PendingRoomsSection hotelId={hotelId} refreshKey={pendingRefreshKey} />



          {/* Actions */}

          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving || !config.pms_type}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Sauvegarder
            </Button>
            
            <Button variant="outline" onClick={testConnection} disabled={testing || !config.pms_type}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
              Tester la connexion
            </Button>

            <Button variant="outline" onClick={syncNow} disabled={syncing || !config.id || !config.is_active}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Synchroniser maintenant
            </Button>

            {config.id && (
              <Button variant="ghost" size="icon" className="text-destructive" onClick={deleteConfig}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
        )}
      </Card>
    </FeatureGuard>
  );
}
