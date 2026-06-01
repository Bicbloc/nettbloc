import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AutoCloseSettingsDialogProps {
  hotelId: string;
}

// 1 = Monday ... 0 = Sunday (matches JS getDay)
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
];

export function AutoCloseSettingsDialog({ hotelId }: AutoCloseSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('23:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    if (!open || !hotelId) return;
    setLoading(true);
    supabase
      .from('hotels')
      .select('auto_close_enabled, auto_close_time, auto_close_days')
      .eq('id', hotelId)
      .single()
      .then(({ data }) => {
        if (data) {
          setEnabled(!!data.auto_close_enabled);
          setTime((data.auto_close_time || '23:00').slice(0, 5));
          setDays(data.auto_close_days || [0, 1, 2, 3, 4, 5, 6]);
        }
        setLoading(false);
      });
  }, [open, hotelId]);

  const toggleDay = (value: number) => {
    setDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (enabled && days.length === 0) {
      toast.error('Sélectionnez au moins un jour de clôture.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('hotels')
      .update({
        auto_close_enabled: enabled,
        auto_close_time: time.length === 5 ? `${time}:00` : time,
        auto_close_days: days,
      })
      .eq('id', hotelId);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de l'enregistrement.");
      return;
    }
    toast.success('Clôture automatique enregistrée.');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Clôture auto</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôture automatique</DialogTitle>
          <DialogDescription>
            Définissez les jours et l'heure auxquels la journée est clôturée automatiquement.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-close-enabled" className="font-medium">
                Activer la clôture automatique
              </Label>
              <Switch id="auto-close-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className={cn('space-y-2', !enabled && 'opacity-50 pointer-events-none')}>
              <Label htmlFor="auto-close-time">Heure de clôture</Label>
              <Input
                id="auto-close-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <div className={cn('space-y-2', !enabled && 'opacity-50 pointer-events-none')}>
              <Label>Jours de clôture</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      'h-9 w-12 rounded-md border text-sm font-medium transition-colors',
                      days.includes(day.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              La clôture s'effectue selon le fuseau horaire de l'établissement, dans les 15 minutes
              suivant l'heure définie. Les données sont archivées dans les rapports.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
