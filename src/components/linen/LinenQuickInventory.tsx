import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Camera, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

  // Check if taskId is temporary (starts with 'temp-') and create real task if needed
  const isTemporaryTask = initialTaskId.startsWith('temp-');

  // Create a real task if we have a temporary ID
  useEffect(() => {
    const ensureRealTask = async () => {
      if (!isTemporaryTask) {
        setRealTaskId(initialTaskId);
        return;
      }

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user');
          return;
        }

        // Create a real task
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

        if (error) {
          console.error('Error creating task:', error);
          toast({
            title: "Erreur",
            description: "Impossible de créer la tâche d'inventaire",
            variant: "destructive"
          });
          return;
        }

        console.log('✅ Created real task:', newTask.id);
        setRealTaskId(newTask.id);
      } catch (err) {
        console.error('Error in ensureRealTask:', err);
      }
    };

    ensureRealTask();
  }, [initialTaskId, hotelId, isTemporaryTask, toast]);

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

  // Fetch task info (only for non-temporary tasks)
  const { data: task } = useQuery({
    queryKey: ['linen-task', realTaskId],
    queryFn: async () => {
      if (!realTaskId) return null;
      const { data, error } = await supabase
        .from('linen_inventory_tasks')
        .select('*')
        .eq('id', realTaskId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!realTaskId
  });

  // Save function
  const handleSave = async () => {
    if (!realTaskId) {
      toast({
        title: "Erreur",
        description: "Tâche non initialisée. Réessayez.",
        variant: "destructive"
      });
      return;
    }

    if (Object.keys(entries).length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Scannez au moins un type de linge",
        variant: "default"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Delete existing entries for this task
      const { error: deleteError } = await supabase
        .from('linen_inventory_entries')
        .delete()
        .eq('task_id', realTaskId);

      if (deleteError) {
        console.error('Error deleting old entries:', deleteError);
      }

      // Prepare entries to insert
      const entriesToInsert = Object.entries(entries)
        .filter(([_, entry]) => entry.quantity_clean || entry.quantity_dirty || entry.quantity_damaged)
        .map(([linenTypeId, entry]) => ({
          task_id: realTaskId,
          linen_type_id: linenTypeId,
          quantity_clean: entry.quantity_clean || 0,
          quantity_dirty: entry.quantity_dirty || 0,
          quantity_damaged: entry.quantity_damaged || 0,
          count_method: entry.count_method || 'manual',
          photo_url: entry.photo_url || null,
          ai_confidence: entry.ai_confidence || null,
          notes: entry.notes || null,
          counted_at: new Date().toISOString()
        }));

      console.log('📦 Saving entries:', entriesToInsert);

      if (entriesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('linen_inventory_entries')
          .insert(entriesToInsert);
        
        if (insertError) {
          console.error('Error inserting entries:', insertError);
          throw insertError;
        }
      }

      // Update task status
      const { error: updateError } = await supabase
        .from('linen_inventory_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', realTaskId);

      if (updateError) {
        console.error('Error updating task:', updateError);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['linen-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['linen-entries'] });
      
      toast({
        title: "✅ Inventaire enregistré",
        description: `${entriesToInsert.length} type(s) de linge sauvegardé(s)`,
      });
      
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer l'inventaire. Réessayez.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleScanComplete = (typeId: string, result: any) => {
    console.log('📷 Scan complete:', typeId, result);
    setEntries(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        quantity_clean: result.count,
        count_method: 'photo',
        photo_url: result.photoUrl,
        ai_confidence: result.confidence,
        notes: result.notes
      }
    }));
    setActiveScanType(null);
    
    toast({
      title: "✅ Comptage enregistré",
      description: `${result.count} pièce(s) détectée(s)`,
    });
  };

  const getTotalCount = (typeId: string) => {
    const entry = entries[typeId];
    if (!entry) return 0;
    return (entry.quantity_clean || 0) + (entry.quantity_dirty || 0) + (entry.quantity_damaged || 0);
  };

  const getLinenIcon = (category: string) => {
    const icons: Record<string, string> = {
      'bed': '🛏️',
      'bath': '🧴',
      'table': '🍽️',
      'towel': '🧻',
      'other': '📦'
    };
    return icons[category?.toLowerCase()] || '📦';
  };

  const totalEntries = Object.keys(entries).length;
  const totalItems = Object.values(entries).reduce((sum: number, entry: any) => {
    return sum + (entry.quantity_clean || 0) + (entry.quantity_dirty || 0) + (entry.quantity_damaged || 0);
  }, 0);

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
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="min-h-screen p-4 pb-28">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur z-10 pb-3 mb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">📦 Inventaire Linge</h1>
              <p className="text-xs text-muted-foreground">
                {task ? new Date(task.task_date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}
                {totalItems > 0 && ` • ${totalItems} pièces`}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Linen Types Grid */}
        <div className="space-y-2 mb-20">
          {linenTypes.map(type => {
            const count = getTotalCount(type.id);
            const entry = entries[type.id];
            const hasPhoto = entry?.photo_url;
            const confidence = entry?.ai_confidence;

            return (
              <Card key={type.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{getLinenIcon(type.category)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{type.name}</h3>
                      {hasPhoto && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          <CheckCircle className="h-3 w-3 mr-0.5" />
                          {confidence ? `${Math.round(confidence * 100)}%` : 'OK'}
                        </Badge>
                      )}
                    </div>
                    {count > 0 && (
                      <p className="text-xl font-bold text-primary mb-2">
                        {count} pièces
                      </p>
                    )}
                    <Button
                      onClick={() => setActiveScanType(type.id)}
                      variant={count > 0 ? "outline" : "default"}
                      size="default"
                      className="w-full h-12"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {count > 0 ? 'Rescanner' : 'Scanner'}
                    </Button>
                  </div>
                </div>

                {entry?.notes && (
                  <div className="mt-2 p-2 bg-muted rounded-lg text-xs flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{entry.notes}</span>
                  </div>
                )}
              </Card>
            );
          })}
          
          {linenTypes.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">
              <p>Aucun type de linge configuré</p>
              <p className="text-sm mt-1">Contactez l'administrateur</p>
            </Card>
          )}
        </div>

        {/* Bottom Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background border-t shadow-lg">
          <Button
            onClick={handleSave}
            disabled={isSaving || totalEntries === 0 || !realTaskId}
            size="lg"
            className="w-full h-12"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Enregistrement..." : 
             !realTaskId ? "Initialisation..." :
             `Enregistrer (${totalItems} pièces)`}
          </Button>
          {totalEntries === 0 && (
            <p className="text-center text-xs text-muted-foreground mt-1">
              Scannez au moins un type de linge
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
