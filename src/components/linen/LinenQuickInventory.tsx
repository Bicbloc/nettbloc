import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Camera, Save, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinenCameraScanner } from './LinenCameraScanner';

interface LinenQuickInventoryProps {
  taskId: string;
  hotelId: string;
  onClose: () => void;
}

export const LinenQuickInventory: React.FC<LinenQuickInventoryProps> = ({
  taskId: initialTaskId,
  hotelId,
  onClose,
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
  useEffect(() => {
    const ensureRealTask = async () => {
      if (!isTemporaryTask) {
        setRealTaskId(initialTaskId);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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
        }
      } catch (err) {
        console.error('Error creating task:', err);
      }
    };

    ensureRealTask();
  }, [initialTaskId, hotelId, isTemporaryTask]);

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
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header with prominent close button */}
      <div className="sticky top-0 bg-background border-b z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">📦 Inventaire Linge</h1>
            <p className="text-xs text-muted-foreground">
              {totalItems > 0 ? `${totalItems} pièces • ${totalScanned} type(s)` : 'Scannez le linge'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 shrink-0 text-muted-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Linen types list */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        <div className="space-y-3">
          {linenTypes.map(type => {
            const entry = entries[type.id];
            const count = entry?.quantity_clean || 0;

            return (
              <Card key={type.id} className="p-4">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{getLinenIcon(type.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{type.name}</h3>
                      {entry && (
                        <Badge variant="secondary" className="shrink-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {Math.round((entry.ai_confidence || 0) * 100)}%
                        </Badge>
                      )}
                    </div>
                    {count > 0 && (
                      <p className="text-2xl font-bold text-primary">{count} pièces</p>
                    )}
                  </div>
                  <Button
                    onClick={() => setActiveScanType(type.id)}
                    variant={count > 0 ? "outline" : "default"}
                    size="lg"
                    className="h-12 px-4 shrink-0"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    {count > 0 ? 'Rescanner' : 'Scanner'}
                  </Button>
                </div>
              </Card>
            );
          })}
          
          {linenTypes.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <p className="text-lg mb-1">Aucun type de linge configuré</p>
              <p className="text-sm">Contactez l'administrateur</p>
            </Card>
          )}
        </div>
      </div>

      {/* Fixed bottom save button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg">
        <Button
          onClick={handleSave}
          disabled={isSaving || totalScanned === 0 || !realTaskId}
          size="lg"
          className="w-full h-14 text-lg"
        >
          <Save className="h-5 w-5 mr-2" />
          {isSaving ? "Enregistrement..." : 
           !realTaskId ? "Initialisation..." :
           `Enregistrer (${totalItems} pièces)`}
        </Button>
      </div>
    </div>
  );
};
