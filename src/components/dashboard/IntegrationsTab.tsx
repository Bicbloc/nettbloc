/**
 * Onglet admin : intégrations (webhooks sortants vers Slack, Zapier/Make → Trello, Drive, etc.).
 * Permet à l'établissement de connecter ses outils collaboratifs et d'envoyer
 * les données par fonctionnalité en temps réel.
 */
import { useEffect, useState, useCallback } from 'react';
import { Webhook, Plus, Trash2, RefreshCw, Slack, Zap, Globe, ExternalLink, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  HotelWebhook, WebhookDelivery, WebhookProvider, WEBHOOK_EVENTS,
  loadWebhooks, loadDeliveries, createWebhook, updateWebhook, deleteWebhook,
} from '@/services/webhookService';

interface IntegrationsTabProps {
  currentHotelId: string | null;
}

const PROVIDER_LABELS: Record<WebhookProvider, string> = {
  slack: 'Slack',
  zapier: 'Zapier / Make (Trello, Drive…)',
  generic: 'Webhook générique',
};

interface ProviderPreset {
  value: WebhookProvider;
  label: string;
  description: string;
  icon: typeof Slack;
  placeholder: string;
  helpUrl: string;
  helpText: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    value: 'slack',
    label: 'Slack',
    description: 'Recevez les alertes dans un canal',
    icon: Slack,
    placeholder: 'https://hooks.slack.com/services/…',
    helpUrl: 'https://api.slack.com/messaging/webhooks',
    helpText: 'Créez un “Incoming Webhook” dans Slack et collez l’URL fournie.',
  },
  {
    value: 'zapier',
    label: 'Zapier / Make',
    description: 'Vers Trello, Google Drive, Sheets…',
    icon: Zap,
    placeholder: 'https://hooks.zapier.com/hooks/catch/…',
    helpUrl: 'https://zapier.com/apps/webhook/integrations',
    helpText: 'Créez un déclencheur “Webhooks by Zapier” (Catch Hook) et collez l’URL.',
  },
  {
    value: 'generic',
    label: 'Webhook générique',
    description: 'Toute URL qui reçoit du JSON',
    icon: Globe,
    placeholder: 'https://votre-service.com/webhook',
    helpUrl: '',
    helpText: 'Les événements sont envoyés en POST au format JSON.',
  },
];


export function IntegrationsTab({ currentHotelId }: IntegrationsTabProps) {
  const [webhooks, setWebhooks] = useState<HotelWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  // New webhook form
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<WebhookProvider>('slack');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentHotelId) return;
    setLoading(true);
    try {
      const [wh, dl] = await Promise.all([
        loadWebhooks(currentHotelId),
        loadDeliveries(currentHotelId),
      ]);
      setWebhooks(wh);
      setDeliveries(dl);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de charger les intégrations");
    } finally {
      setLoading(false);
    }
  }, [currentHotelId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!currentHotelId) {
    return <p className="text-muted-foreground">Sélectionnez un hôtel.</p>;
  }

  const toggleEvent = (value: string) =>
    setEvents((prev) => (prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]));

  const handleCreate = async () => {
    if (!url.trim()) { toast.error("L'URL du webhook est requise"); return; }
    if (events.length === 0) { toast.error("Sélectionnez au moins un événement"); return; }
    setCreating(true);
    try {
      await createWebhook(currentHotelId, {
        name: name.trim() || PROVIDER_LABELS[provider],
        provider,
        target_url: url.trim(),
        events,
      });
      toast.success('Intégration ajoutée');
      setName(''); setUrl(''); setEvents([]); setProvider('slack');
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("Impossible d'ajouter l'intégration");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (w: HotelWebhook) => {
    try {
      await updateWebhook(w.id, { is_active: !w.is_active });
      setWebhooks((prev) => prev.map((x) => (x.id === w.id ? { ...x, is_active: !x.is_active } : x)));
    } catch {
      toast.error('Échec de la mise à jour');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhook(id);
      setWebhooks((prev) => prev.filter((x) => x.id !== id));
      toast.success('Intégration supprimée');
    } catch {
      toast.error('Échec de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Webhook className="h-6 w-6 text-primary" /> Intégrations
        </h2>
        <p className="text-muted-foreground">
          Connectez vos outils (Slack, Trello, Drive…) et recevez les données en temps réel.
        </p>
      </div>

      {/* Add new */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ajouter une intégration</CardTitle>
          <CardDescription>
            Collez une URL Slack (Incoming Webhook) ou une URL Zapier/Make qui pousse vers Trello, Drive, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Slack #incidents" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as WebhookProvider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_LABELS) as WebhookProvider[]).map((p) => (
                    <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>URL du webhook</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/services/…" />
          </div>
          <div className="space-y-2">
            <Label>Événements à envoyer</Label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <button
                  key={ev.value}
                  type="button"
                  onClick={() => toggleEvent(ev.value)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    events.includes(ev.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {ev.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      {/* Existing */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Intégrations configurées</CardTitle>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Chargement…</p>
          ) : webhooks.length === 0 ? (
            <p className="text-muted-foreground">Aucune intégration pour le moment.</p>
          ) : (
            webhooks.map((w) => (
              <div key={w.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{w.name}</span>
                    <Badge variant="secondary">{PROVIDER_LABELS[w.provider]}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{w.target_url}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {w.events.map((e) => (
                      <Badge key={e} variant="outline" className="text-[10px]">
                        {WEBHOOK_EVENTS.find((x) => x.value === e)?.label ?? e}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={w.is_active} onCheckedChange={() => handleToggleActive(w)} />
                    <span className="text-xs text-muted-foreground">{w.is_active ? 'Actif' : 'Inactif'}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(w.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent deliveries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Derniers envois</CardTitle>
          <CardDescription>20 derniers événements envoyés</CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-muted-foreground">Aucun envoi pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span>{WEBHOOK_EVENTS.find((x) => x.value === d.event_type)?.label ?? d.event_type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()}
                    </span>
                    <Badge variant={d.status === 'sent' ? 'default' : 'destructive'}>
                      {d.status === 'sent' ? 'Envoyé' : 'Échec'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
