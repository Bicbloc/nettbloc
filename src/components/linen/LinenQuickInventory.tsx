import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Camera, Save, CheckCircle, ArrowLeft, Package, Sparkles, ScanLine, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinenCameraScanner } from './LinenCameraScanner';

interface LinenQuickInventoryProps {
  taskId: string;
  hotelId: string;
  onClose: () => void;
  embedded?: boolean;
}

export const LinenQuickInventory: React.FC<LinenQuickInventoryProps> = ({
  taskId: initialTaskId,
  hotelId,
  onClose,
  embedded = false,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [activeScanType, setActiveScanType] = useState<string | null>(null);
  const [realTaskId, setRealTaskId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Considérer comme temporaire tout id qui n'est pas un UUID réel
  // (temp_, temp-, manual_, etc.) afin de créer une vraie tâche en base
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isTemporaryTask = !UUID_REGEX.test(initialTaskId);

  // Create real task if temporary
  const creatingTaskRef = useRef(false);
  useEffect(() => {
    const ensureRealTask = async () => {
      if (!isTemporaryTask) {
        setRealTaskId(initialTaskId);
        return;
      }

      // Empêche la création de plusieurs tâches (re-renders / StrictMode)
      if (creatingTaskRef.current || realTaskId) return;
      creatingTaskRef.current = true;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { creatingTaskRef.current = false; return; }

        const { data: newTask, error } = await supabase
          .from('linen_inventory_tasks')
          .insert({
            hotel_id: hotelId,
            assigned_to: user.id,
            assigned_by: user.id,
            status: 'in_progress',
            task_date: new Date().toISOString().split('T')[0],
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!error && newTask) {
          setRealTaskId(newTask.id);
        } else {
          creatingTaskRef.current = false;
        }
      } catch (err) {
        console.error('Error creating task:', err);
        creatingTaskRef.current = false;
      }
    };

    ensureRealTask();
  }, [initialTaskId, hotelId, isTemporaryTask, realTaskId]);

  // Fetch linen types
  const { data: linenTypes = [] } = useQuery({
    queryKey: ['linen-types', hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('linen_types')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleSave = async () => {
    if (!realTaskId) {
      toast({ 
        title: "Session non prête", 
        description: "Veuillez patienter quelques secondes et réessayer",
        variant: "destructive" 
      });
      return;
    }
    
    if (Object.keys(entries).length === 0) {
      toast({ title: "Aucune donnée", description: "Scannez au moins un type de linge" });
      return;
    }

    setIsSaving(true);

    try {
      // Delete existing entries
      const { error: deleteError } = await supabase
        .from('linen_inventory_entries')
        .delete()
        .eq('task_id', realTaskId);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        // Continue anyway - might not have existing entries
      }

      // Insert new entries
      const entriesToInsert = Object.entries(entries)
        .filter(([_, entry]) => entry.quantity_clean > 0)
        .map(([linenTypeId, entry]) => ({
          task_id: realTaskId,
          linen_type_id: linenTypeId,
          quantity_clean: entry.quantity_clean || 0,
          quantity_dirty: 0,
          quantity_damaged: 0,
          count_method: 'photo',
          photo_url: entry.photo_url || null,
          ai_confidence: entry.ai_confidence || null,
          notes: entry.notes || null,
          counted_at: new Date().toISOString()
        }));

      if (entriesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('linen_inventory_entries')
          .insert(entriesToInsert);
        
        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error(`Erreur insertion: ${insertError.message}`);
        }
      }

      // Mark task complete
      const { error: updateError } = await supabase
        .from('linen_inventory_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', realTaskId);
      
      if (updateError) {
        console.error('Update error:', updateError);
        // Non-critical, continue
      }

      queryClient.invalidateQueries({ queryKey: ['linen-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['linen-entries'] });
      
      toast({ title: "✅ Inventaire enregistré", description: `${entriesToInsert.length} type(s) sauvegardé(s)` });
      onClose();
    } catch (error: any) {
      console.error('Save error:', error);
      toast({ 
        title: "Erreur d'enregistrement", 
        description: error?.message || "Impossible d'enregistrer les données", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleScanComplete = (typeId: string, result: any) => {
    setEntries(prev => ({
      ...prev,
      [typeId]: {
        quantity_clean: result.count,
        photo_url: result.photoUrl,
        ai_confidence: result.confidence,
        notes: result.notes
      }
    }));
    setActiveScanType(null);
    toast({ title: "✅ Comptage enregistré", description: `${result.count} pièce(s)` });
  };

  const getLinenIcon = (category: string) => {
    const icons: Record<string, string> = { 'bed': '🛏️', 'bath': '🧴', 'table': '🍽️', 'towel': '🧻', 'other': '📦' };
    return icons[category?.toLowerCase()] || '📦';
  };

  const totalItems = Object.values(entries).reduce((sum: number, e: any) => sum + (e.quantity_clean || 0), 0);
  const totalScanned = Object.keys(entries).length;
  const progress = linenTypes.length > 0 ? Math.round((totalScanned / linenTypes.length) * 100) : 0;

  // Show scanner when active
  if (activeScanType) {
    const linenType = linenTypes.find(t => t.id === activeScanType);
    return (
      <LinenCameraScanner
        linenTypeId={activeScanType}
        linenTypeName={linenType?.name || ''}
        hotelId={hotelId}
        onCountComplete={(result) => handleScanComplete(activeScanType, result)}
        onClose={() => setActiveScanType(null)}
      />
    );
  }

  return (
    <div className={cn(
      'flex flex-col bg-background',
      embedded
        ? 'relative min-h-[70dvh] overflow-hidden rounded-[1.5rem] border'
        : 'fixed inset-0 z-50'
    )}>
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 pt-4 pb-3">
          <Button
            variant="outline"
            size="icon"
            onClick={onClose}
            className="h-11 w-11 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Package className="h-3.5 w-3.5" />
                Inventaire
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Femme de chambre
              </Badge>
            </div>
            <h1 className="mt-2 text-xl font-bold leading-tight">Inventaire linge</h1>
            <p className="text-sm text-muted-foreground">
              Un affichage plus clair, type par type, pensé pour mobile.
            </p>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-3 px-4 pb-4">
          <Card className="border bg-card px-3 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Pièces</p>
            <p className="mt-1 text-2xl font-bold">{totalItems}</p>
          </Card>
          <Card className="border bg-card px-3 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Types faits</p>
            <p className="mt-1 text-2xl font-bold">{totalScanned}/{linenTypes.length}</p>
          </Card>
          <Card className="border bg-card px-3 py-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Progression</p>
            <p className="mt-1 text-2xl font-bold">{progress}%</p>
          </Card>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <Progress value={progress} className="h-2.5" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
          {linenTypes.length > 0 && (
            <Card className="border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Scannez chaque type séparément</p>
                  <p className="text-sm text-muted-foreground">
                    Le résultat s’enregistre sur la carte du linge et reste visible jusqu’à l’envoi final.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {linenTypes.map(type => {
            const entry = entries[type.id];
            const count = entry?.quantity_clean || 0;
            const done = !!entry;
            const confidence = Math.round((entry?.ai_confidence || 0) * 100);

            return (
              <Card
                key={type.id}
                className={cn(
                  'overflow-hidden border transition-all',
                  done ? 'border-primary/30 bg-primary/5' : 'bg-card'
                )}
              >
                <div className="flex items-center gap-4 p-4">
                  <div className={cn(
                    'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl border',
                    done ? 'border-primary/20 bg-primary/10' : 'border-border bg-muted'
                  )}>
                    {getLinenIcon(type.category)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{type.name}</h3>
                      {done && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3.5 w-3.5" />
                          Compté
                        </Badge>
                      )}
                      {done && confidence > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {confidence}%
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-3xl font-bold leading-none">{count}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {done ? 'pièces détectées' : 'pas encore scanné'}
                        </p>
                      </div>

                      <Button
                        onClick={() => setActiveScanType(type.id)}
                        variant={done ? 'outline' : 'default'}
                        size="lg"
                        className="h-12 shrink-0 gap-2 px-4"
                      >
                        <Camera className="h-4 w-4" />
                        <span>{done ? 'Rescanner' : 'Scanner'}</span>
                        <ChevronRight className="h-4 w-4 opacity-70" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {linenTypes.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="text-lg font-medium">Aucun type de linge configuré</p>
              <p className="mt-1 text-sm">Contactez l’établissement</p>
            </Card>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Prêt à enregistrer</p>
            <p className="text-xs text-muted-foreground">
              {totalScanned > 0 ? `${totalScanned} type(s) scanné(s) • ${totalItems} pièces` : 'Commencez par scanner un type de linge'}
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || totalScanned === 0 || !realTaskId}
            size="lg"
            className="h-12 min-w-[150px] gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Enregistrement...' : !realTaskId ? 'Initialisation...' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
};
