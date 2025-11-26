import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Camera, Save, AlertCircle } from 'lucide-react';
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
  taskId,
  hotelId,
  onClose,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [activeScanType, setActiveScanType] = useState<string | null>(null);

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

  // Fetch task info
  const { data: task } = useQuery({
    queryKey: ['linen-task', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('linen_inventory_tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing entries
      await supabase
        .from('linen_inventory_entries')
        .delete()
        .eq('task_id', taskId);

      // Insert new entries
      const entriesToInsert = Object.entries(entries)
        .filter(([_, entry]) => entry.quantity_clean || entry.quantity_dirty || entry.quantity_damaged)
        .map(([linenTypeId, entry]) => ({
          task_id: taskId,
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

      if (entriesToInsert.length > 0) {
        const { error } = await supabase
          .from('linen_inventory_entries')
          .insert(entriesToInsert);
        
        if (error) throw error;
      }

      // Update task status
      await supabase
        .from('linen_inventory_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linen-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['linen-entries'] });
      toast({
        title: "✅ Inventaire enregistré",
        description: "Toutes les données ont été sauvegardées",
      });
      onClose();
    },
    onError: (error) => {
      console.error('Erreur sauvegarde:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer l'inventaire",
        variant: "destructive"
      });
    }
  });

  const handleScanComplete = (typeId: string, result: any) => {
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
      <div className="min-h-screen p-4 pb-24">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur z-10 pb-4 mb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">📦 Inventaire Linge</h1>
              <p className="text-sm text-muted-foreground">
                {task ? new Date(task.task_date).toLocaleDateString('fr-FR') : ''}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Linen Types Grid */}
        <div className="space-y-3 mb-20">
          {linenTypes.map(type => {
            const count = getTotalCount(type.id);
            const entry = entries[type.id];
            const hasPhoto = entry?.photo_url;
            const confidence = entry?.ai_confidence;

            return (
              <Card key={type.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-4xl">{getLinenIcon(type.category)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{type.name}</h3>
                      {hasPhoto && (
                        <Badge variant="secondary" className="text-xs">
                          📷 {confidence ? `${Math.round(confidence * 100)}%` : 'Photo'}
                        </Badge>
                      )}
                    </div>
                    {count > 0 && (
                      <p className="text-2xl font-bold text-primary mb-2">
                        {count} pièces
                      </p>
                    )}
                    <Button
                      onClick={() => setActiveScanType(type.id)}
                      variant={count > 0 ? "outline" : "default"}
                      size="lg"
                      className="w-full h-14 text-lg"
                    >
                      <Camera className="h-5 w-5 mr-2" />
                      {count > 0 ? 'Reprendre la photo' : 'Scanner par photo'}
                    </Button>
                  </div>
                </div>

                {entry?.notes && (
                  <div className="mt-3 p-2 bg-muted rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{entry.notes}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Bottom Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || Object.keys(entries).length === 0}
            size="lg"
            className="w-full h-14 text-lg"
          >
            <Save className="h-5 w-5 mr-2" />
            {saveMutation.isPending ? "Enregistrement..." : "Enregistrer l'inventaire"}
          </Button>
          {Object.keys(entries).length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Scannez au moins un type de linge
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
