import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Camera } from "lucide-react";
import { LinenPhotoCounter } from "./LinenPhotoCounter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LinenInventoryFormProps {
  taskId: string;
  hotelId: string;
  onComplete: () => void;
}

export const LinenInventoryForm = ({ taskId, hotelId, onComplete }: LinenInventoryFormProps) => {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [currentLinenType, setCurrentLinenType] = useState<string>("");

  const { data: linenTypes = [] } = useQuery({
    queryKey: ["linen-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_types")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingEntries = [] } = useQuery({
    queryKey: ["linen-entries", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_inventory_entries")
        .select("*")
        .eq("task_id", taskId);
      if (error) throw error;
      
      const entriesMap: Record<string, any> = {};
      data.forEach((entry: any) => {
        entriesMap[entry.linen_type_id] = {
          clean: entry.quantity_clean || 0,
          dirty: entry.quantity_dirty || 0,
          damaged: entry.quantity_damaged || 0,
          photoUrl: entry.photo_url,
          confidence: entry.ai_confidence,
        };
      });
      setEntries(entriesMap);
      
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entriesToSave = Object.entries(entries).map(([linenTypeId, values]) => ({
        task_id: taskId,
        linen_type_id: linenTypeId,
        quantity_clean: parseInt(values.clean) || 0,
        quantity_dirty: parseInt(values.dirty) || 0,
        quantity_damaged: parseInt(values.damaged) || 0,
        count_method: values.photoUrl ? "ai_photo" : "manual",
        photo_url: values.photoUrl || null,
        ai_confidence: values.confidence || null,
      }));

      // Delete existing entries
      const { error: deleteError } = await supabase
        .from("linen_inventory_entries")
        .delete()
        .eq("task_id", taskId);

      if (deleteError) throw deleteError;

      // Insert new entries
      const { error: insertError } = await supabase
        .from("linen_inventory_entries")
        .insert(entriesToSave);

      if (insertError) throw insertError;

      // Update task status
      const { error: updateError } = await supabase
        .from("linen_inventory_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linen-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["linen-entries"] });
      toast.success("Inventaire enregistré");
      onComplete();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const updateEntry = (linenTypeId: string, field: string, value: any) => {
    setEntries((prev) => ({
      ...prev,
      [linenTypeId]: {
        ...prev[linenTypeId],
        [field]: value,
      },
    }));
  };

  const handlePhotoCount = (linenTypeId: string) => {
    setCurrentLinenType(linenTypeId);
    setPhotoDialogOpen(true);
  };

  const handleCountComplete = (count: number, confidence: number, photoUrl: string) => {
    updateEntry(currentLinenType, "clean", count.toString());
    updateEntry(currentLinenType, "photoUrl", photoUrl);
    updateEntry(currentLinenType, "confidence", confidence);
    setPhotoDialogOpen(false);
    toast.success("Comptage enregistré");
  };

  return (
    <div className="space-y-4">
      {linenTypes.map((type: any) => {
        const entry = entries[type.id] || {};
        
        return (
          <Card key={type.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{type.icon}</span>
                <div>
                  <div className="font-medium">{type.name}</div>
                  {type.dimensions && (
                    <div className="text-sm text-muted-foreground">{type.dimensions}</div>
                  )}
                </div>
              </div>
              <Button
                onClick={() => handlePhotoCount(type.id)}
                variant="outline"
                size="sm"
              >
                <Camera className="h-4 w-4 mr-2" />
                Compter par photo
              </Button>
            </div>

            {entry.photoUrl && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>📷 Compté par IA</span>
                <span>•</span>
                <span>Confiance: {Math.round((entry.confidence || 0) * 100)}%</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Propre</Label>
                <Input
                  type="number"
                  value={entry.clean || ""}
                  onChange={(e) => updateEntry(type.id, "clean", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Sale</Label>
                <Input
                  type="number"
                  value={entry.dirty || ""}
                  onChange={(e) => updateEntry(type.id, "dirty", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Abîmé</Label>
                <Input
                  type="number"
                  value={entry.damaged || ""}
                  onChange={(e) => updateEntry(type.id, "damaged", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </Card>
        );
      })}

      <Button onClick={() => saveMutation.mutate()} className="w-full" size="lg">
        <Save className="h-4 w-4 mr-2" />
        Enregistrer l'inventaire
      </Button>

      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compter par photo</DialogTitle>
          </DialogHeader>
          {currentLinenType && (
            <LinenPhotoCounter
              linenTypeId={currentLinenType}
              hotelId={hotelId}
              onCountComplete={handleCountComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};