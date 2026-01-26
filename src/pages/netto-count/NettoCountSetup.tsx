/**
 * Netto Count - Setup Page
 * Configure which items to count (dynamic checklist)
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Trash2, 
  ArrowRight, 
  Package,
  Loader2,
  GripVertical,
  Shirt
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ItemType {
  id?: string;
  name: string;
  icon: string;
  description?: string;
  isDefault?: boolean;
}

const DEFAULT_ITEMS: ItemType[] = [
  { name: "Taies d'oreiller", icon: "🛏️", isDefault: true },
  { name: "Petites serviettes", icon: "🧴", isDefault: true },
  { name: "Serviettes moyennes", icon: "🧻", isDefault: true },
  { name: "Grandes serviettes", icon: "🛁", isDefault: true },
  { name: "Grands draps", icon: "🛏️", isDefault: true },
  { name: "Draps housses", icon: "📦", isDefault: true },
  { name: "Couvertures", icon: "🧣", isDefault: true },
  { name: "Peignoirs", icon: "👘", isDefault: true },
];

export default function NettoCountSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [items, setItems] = useState<ItemType[]>(DEFAULT_ITEMS);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(DEFAULT_ITEMS.map(i => i.name)));
  const [newItemName, setNewItemName] = useState("");
  const [newItemIcon, setNewItemIcon] = useState("📦");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/netto-count/auth");
        return;
      }
      setUser(user);

      // Load existing item types
      const { data: existingItems } = await supabase
        .from("netto_count_item_types")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("display_order");

      if (existingItems && existingItems.length > 0) {
        setItems(existingItems.map(item => ({
          id: item.id,
          name: item.name,
          icon: item.icon || "📦",
          description: item.description || undefined,
        })));
        setSelectedItems(new Set(existingItems.map(item => item.name)));
      }
    };

    checkAuth();
  }, [navigate]);

  const toggleItem = (itemName: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemName)) {
      newSelected.delete(itemName);
    } else {
      newSelected.add(itemName);
    }
    setSelectedItems(newSelected);
  };

  const addCustomItem = () => {
    if (!newItemName.trim()) return;
    
    const newItem: ItemType = {
      name: newItemName.trim(),
      icon: newItemIcon || "📦",
    };
    
    setItems([...items, newItem]);
    setSelectedItems(new Set([...selectedItems, newItem.name]));
    setNewItemName("");
    setNewItemIcon("📦");
  };

  const removeItem = (itemName: string) => {
    setItems(items.filter(i => i.name !== itemName));
    const newSelected = new Set(selectedItems);
    newSelected.delete(itemName);
    setSelectedItems(newSelected);
  };

  const handleSave = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "Selection required",
        description: "Please select at least one item type to count.",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setIsSaving(true);

    try {
      // Delete existing items
      await supabase
        .from("netto_count_item_types")
        .delete()
        .eq("user_id", user.id);

      // Insert selected items
      const itemsToInsert = items
        .filter(item => selectedItems.has(item.name))
        .map((item, index) => ({
          user_id: user.id,
          name: item.name,
          icon: item.icon,
          description: item.description,
          display_order: index,
          is_active: true,
        }));

      const { error } = await supabase
        .from("netto_count_item_types")
        .insert(itemsToInsert);

      if (error) throw error;

      toast({
        title: "Setup complete!",
        description: "Your item types have been saved.",
      });

      navigate("/netto-count/scan");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save items",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const EMOJI_OPTIONS = ["📦", "🛏️", "🧴", "🧻", "🛁", "🧣", "👘", "🧺", "👕", "👖", "🧦", "🧤"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shirt className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Configure Your Items</h1>
          <p className="text-muted-foreground mt-2">
            Select which items you want to count with AI
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Item Types to Count</CardTitle>
            <CardDescription>
              Check the items you want the AI to identify and count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item) => (
                <div
                  key={item.name}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer
                    ${selectedItems.has(item.name) 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted hover:border-muted-foreground/30'
                    }
                  `}
                  onClick={() => toggleItem(item.name)}
                >
                  <Checkbox 
                    checked={selectedItems.has(item.name)}
                    onCheckedChange={() => toggleItem(item.name)}
                  />
                  <span className="text-2xl">{item.icon}</span>
                  <span className="flex-1 font-medium">{item.name}</span>
                  {!item.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Add Custom Item</CardTitle>
            <CardDescription>
              Add your own item types to track
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Label className="sr-only">Icon</Label>
                <select 
                  value={newItemIcon}
                  onChange={(e) => setNewItemIcon(e.target.value)}
                  className="h-10 w-14 text-2xl text-center border rounded-md"
                >
                  {EMOJI_OPTIONS.map(emoji => (
                    <option key={emoji} value={emoji}>{emoji}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <Label className="sr-only">Item name</Label>
                <Input
                  placeholder="e.g., Nappes, Housses..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addCustomItem()}
                />
              </div>
              <Button onClick={addCustomItem} disabled={!newItemName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <Badge variant="secondary" className="text-sm">
            {selectedItems.size} items selected
          </Badge>
          
          <Button 
            size="lg" 
            onClick={handleSave}
            disabled={isSaving || selectedItems.size === 0}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Continue to Scan
          </Button>
        </div>
      </div>
    </div>
  );
}
