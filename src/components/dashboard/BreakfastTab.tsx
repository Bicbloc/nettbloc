/**
 * Onglet admin : configuration de la facturation des petits-déjeuners.
 */
import { useEffect, useState } from 'react';
import { Coffee, Plus, Trash2, Save, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  BreakfastConfig, BreakfastType, loadBreakfastConfig, saveBreakfastConfig,
} from '@/services/breakfastConfigService';

interface BreakfastTabProps {
  currentHotelId: string | null;
}

export function BreakfastTab({ currentHotelId }: BreakfastTabProps) {
  const [config, setConfig] = useState<BreakfastConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentHotelId) return;
    setLoading(true);
    loadBreakfastConfig(currentHotelId)
      .then(setConfig)
      .finally(() => setLoading(false));
  }, [currentHotelId]);

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coffee className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Petit-déjeuner</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.open(`/cafetiere?hotel=${currentHotelId}`, '_blank')}
        >
          <ExternalLink className="h-4 w-4" /> Ouvrir l'interface Cafetière
        </Button>
      </div>

      {config.is_active && (
        <BreakfastBilledSection hotelId={currentHotelId} currency={config.currency || 'EUR'} />
      )}



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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Types de petit-déjeuner</CardTitle>
          <CardDescription>
            Optionnel : proposez plusieurs formules (ex. Continental, Buffet).
          </CardDescription>
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

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </div>
  );
}
