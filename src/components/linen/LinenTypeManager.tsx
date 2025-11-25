import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LinenType {
  id: string;
  name: string;
  category: string;
  dimensions: string | null;
  color: string | null;
  icon: string;
  display_order: number;
}

interface LinenTypeManagerProps {
  hotelId: string;
}

export const LinenTypeManager = ({ hotelId }: LinenTypeManagerProps) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "general",
    dimensions: "",
    color: "",
    icon: "🧺",
  });

  const { data: linenTypes = [], isLoading } = useQuery({
    queryKey: ["linen-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_types")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data as LinenType[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("linen_types").insert({
        hotel_id: hotelId,
        ...data,
        display_order: linenTypes.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linen-types"] });
      toast.success("Type de linge ajouté");
      resetForm();
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("linen_types")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linen-types"] });
      toast.success("Type de linge modifié");
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("linen_types")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linen-types"] });
      toast.success("Type de linge supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const resetForm = () => {
    setFormData({ name: "", category: "general", dimensions: "", color: "", icon: "🧺" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (type: LinenType) => {
    setFormData({
      name: type.name,
      category: type.category,
      dimensions: type.dimensions || "",
      color: type.color || "",
      icon: type.icon,
    });
    setEditingId(type.id);
    setIsAdding(false);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  const categories = [
    { value: "draps", label: "Draps" },
    { value: "serviettes", label: "Serviettes" },
    { value: "couvertures", label: "Couvertures" },
    { value: "taies", label: "Taies d'oreiller" },
    { value: "general", label: "Général" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Types de linge</h3>
        <Button onClick={() => setIsAdding(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un type
        </Button>
      </div>

      {(isAdding || editingId) && (
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nom *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Drap 1 place"
              />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dimensions</Label>
              <Input
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                placeholder="Ex: 140x190 cm"
              />
            </div>
            <div>
              <Label>Couleur</Label>
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="Ex: Blanc"
              />
            </div>
            <div>
              <Label>Icône (emoji)</Label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🧺"
                maxLength={2}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {editingId ? "Modifier" : "Ajouter"}
            </Button>
            <Button onClick={resetForm} variant="outline" size="sm">
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-2">
        {linenTypes.map((type) => (
          <Card key={type.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <div className="font-medium">{type.name}</div>
                <div className="text-sm text-muted-foreground">
                  {type.dimensions && `${type.dimensions} • `}
                  {type.color && `${type.color} • `}
                  {categories.find((c) => c.value === type.category)?.label}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleEdit(type)} variant="ghost" size="sm">
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button onClick={() => deleteMutation.mutate(type.id)} variant="ghost" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};