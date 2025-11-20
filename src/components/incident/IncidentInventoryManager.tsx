import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Save, X, Package, AlertTriangle, Users, Tags } from "lucide-react";
import { useIncidentDefaults } from "@/hooks/use-incident-defaults";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface IncidentInventoryManagerProps {
  hotelId: string;
}

export const IncidentInventoryManager = ({ hotelId }: IncidentInventoryManagerProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("categories");
  const [loading, setLoading] = useState(false);
  
  // Initialiser les données par défaut si nécessaire
  useIncidentDefaults(hotelId);

  // Categories
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '🛏️', display_order: 0 });

  // Items
  const [items, setItems] = useState<any[]>([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', category_id: '', display_order: 0 });

  // Types
  const [types, setTypes] = useState<any[]>([]);
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [editingType, setEditingType] = useState<any | null>(null);
  const [typeForm, setTypeForm] = useState({ name: '', color: '#ef4444', severity: 'medium' as 'low' | 'medium' | 'high' | 'critical' });

  // Roles
  const [roles, setRoles] = useState<any[]>([]);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });

  const [deleteDialogState, setDeleteDialogState] = useState<{ open: boolean; type: string; id: string | null }>({ open: false, type: '', id: null });

  useEffect(() => {
    loadAll();
  }, [hotelId]);

  const loadAll = async () => {
    await Promise.all([
      loadCategories(),
      loadItems(),
      loadTypes(),
      loadRoles()
    ]);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('incident_categories')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('display_order', { ascending: true });

    if (!error && data) setCategories(data);
  };

  const loadItems = async () => {
    const { data, error } = await supabase
      .from('incident_items')
      .select('*, incident_categories(name, icon)')
      .eq('hotel_id', hotelId)
      .order('display_order', { ascending: true });

    if (!error && data) setItems(data);
  };

  const loadTypes = async () => {
    const { data, error } = await supabase
      .from('incident_types')
      .select('*')
      .eq('hotel_id', hotelId);

    if (!error && data) setTypes(data);
  };

  const loadRoles = async () => {
    const { data, error } = await supabase
      .from('staff_roles')
      .select('*')
      .eq('hotel_id', hotelId);

    if (!error && data) setRoles(data);
  };

  const handleSaveCategory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      if (editingCategory) {
        await supabase
          .from('incident_categories')
          .update(categoryForm)
          .eq('id', editingCategory.id);
      } else {
        await supabase
          .from('incident_categories')
          .insert([{ ...categoryForm, hotel_id: hotelId }]);
      }

      toast({ title: "Succès", description: "Catégorie sauvegardée" });
      setShowCategoryDialog(false);
      setCategoryForm({ name: '', icon: '🛏️', display_order: 0 });
      setEditingCategory(null);
      loadCategories();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    }
  };

  const handleSaveItem = async () => {
    try {
      if (!itemForm.category_id) {
        toast({ title: "Erreur", description: "Sélectionnez une catégorie", variant: "destructive" });
        return;
      }

      if (editingItem) {
        await supabase
          .from('incident_items')
          .update(itemForm)
          .eq('id', editingItem.id);
      } else {
        await supabase
          .from('incident_items')
          .insert([{ ...itemForm, hotel_id: hotelId }]);
      }

      toast({ title: "Succès", description: "Item sauvegardé" });
      setShowItemDialog(false);
      setItemForm({ name: '', description: '', category_id: '', display_order: 0 });
      setEditingItem(null);
      loadItems();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    }
  };

  const handleSaveType = async () => {
    try {
      if (editingType) {
        await supabase
          .from('incident_types')
          .update(typeForm)
          .eq('id', editingType.id);
      } else {
        await supabase
          .from('incident_types')
          .insert([{ ...typeForm, hotel_id: hotelId }]);
      }

      toast({ title: "Succès", description: "Type sauvegardé" });
      setShowTypeDialog(false);
      setTypeForm({ name: '', color: '#ef4444', severity: 'medium' });
      setEditingType(null);
      loadTypes();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    }
  };

  const handleSaveRole = async () => {
    try {
      if (editingRole) {
        await supabase
          .from('staff_roles')
          .update(roleForm)
          .eq('id', editingRole.id);
      } else {
        await supabase
          .from('staff_roles')
          .insert([{ ...roleForm, hotel_id: hotelId }]);
      }

      toast({ title: "Succès", description: "Rôle sauvegardé" });
      setShowRoleDialog(false);
      setRoleForm({ name: '', description: '' });
      setEditingRole(null);
      loadRoles();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    const { type, id } = deleteDialogState;
    if (!id) return;

    try {
      switch(type) {
        case 'category':
          await supabase.from('incident_categories').delete().eq('id', id);
          loadCategories();
          break;
        case 'item':
          await supabase.from('incident_items').delete().eq('id', id);
          loadItems();
          break;
        case 'type':
          await supabase.from('incident_types').delete().eq('id', id);
          loadTypes();
          break;
        case 'role':
          await supabase.from('staff_roles').delete().eq('id', id);
          loadRoles();
          break;
      }
      
      toast({ title: "Succès", description: "Supprimé avec succès" });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    } finally {
      setDeleteDialogState({ open: false, type: '', id: null });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gestion de l'Inventaire des Incidents</h2>
        <p className="text-muted-foreground">
          Configurez les catégories, items, types et rôles pour la gestion des incidents
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories">
            <Package className="h-4 w-4 mr-2" />
            Catégories
          </TabsTrigger>
          <TabsTrigger value="items">
            <Tags className="h-4 w-4 mr-2" />
            Items
          </TabsTrigger>
          <TabsTrigger value="types">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Types
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Users className="h-4 w-4 mr-2" />
            Rôles Personnel
          </TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', icon: '🛏️', display_order: categories.length }); setShowCategoryDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Catégorie
          </Button>

          <div className="grid gap-3">
            {categories.map(cat => (
              <Card key={cat.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <p className="font-medium">{cat.name}</p>
                      <p className="text-sm text-muted-foreground">Ordre: {cat.display_order}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, icon: cat.icon, display_order: cat.display_order }); setShowCategoryDialog(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteDialogState({ open: true, type: 'category', id: cat.id as string })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Button onClick={() => { setEditingItem(null); setItemForm({ name: '', description: '', category_id: '', display_order: items.length }); setShowItemDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel Item
          </Button>

          <div className="grid gap-3">
            {items.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{item.name}</p>
                      <Badge variant="outline">{(item.incident_categories as any)?.name}</Badge>
                    </div>
                    {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingItem(item); setItemForm({ name: item.name, description: item.description || '', category_id: item.category_id, display_order: item.display_order }); setShowItemDialog(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteDialogState({ open: true, type: 'item', id: item.id as string })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="types" className="space-y-4">
          <Button onClick={() => { setEditingType(null); setTypeForm({ name: '', color: '#ef4444', severity: 'medium' }); setShowTypeDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Type
          </Button>

          <div className="grid gap-3">
            {types.map(type => (
              <Card key={type.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: type.color }} />
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <Badge>{type.severity}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingType(type); setTypeForm({ name: type.name, color: type.color, severity: type.severity }); setShowTypeDialog(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteDialogState({ open: true, type: 'type', id: type.id as string })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <Button onClick={() => { setEditingRole(null); setRoleForm({ name: '', description: '' }); setShowRoleDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Rôle
          </Button>

          <div className="grid gap-3">
            {roles.map(role => (
              <Card key={role.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{role.name}</p>
                    {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingRole(role); setRoleForm({ name: role.name, description: role.description || '' }); setShowRoleDialog(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteDialogState({ open: true, type: 'role', id: role.id as string })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs for Create/Edit */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Modifier' : 'Nouvelle'} Catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nom</Label>
              <Input value={categoryForm.name} onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label>Icône (Emoji)</Label>
              <Input value={categoryForm.icon} onChange={(e) => setCategoryForm(prev => ({ ...prev, icon: e.target.value }))} maxLength={2} />
            </div>
            <div>
              <Label>Ordre d'affichage</Label>
              <Input type="number" value={categoryForm.display_order} onChange={(e) => setCategoryForm(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveCategory}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Modifier' : 'Nouvel'} Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Catégorie</Label>
              <Select value={itemForm.category_id} onValueChange={(v) => setItemForm(prev => ({ ...prev, category_id: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom</Label>
              <Input value={itemForm.name} onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Textarea value={itemForm.description} onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveItem}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Modifier' : 'Nouveau'} Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nom</Label>
              <Input value={typeForm.name} onChange={(e) => setTypeForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label>Couleur</Label>
              <Input type="color" value={typeForm.color} onChange={(e) => setTypeForm(prev => ({ ...prev, color: e.target.value }))} />
            </div>
            <div>
              <Label>Sévérité</Label>
              <Select value={typeForm.severity} onValueChange={(v: any) => setTypeForm(prev => ({ ...prev, severity: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="high">Élevé</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTypeDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveType}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Modifier' : 'Nouveau'} Rôle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nom</Label>
              <Input value={roleForm.name} onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Technicien, Équipier, etc." />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Textarea value={roleForm.description} onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveRole}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogState.open} onOpenChange={(open) => setDeleteDialogState({ ...deleteDialogState, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Êtes-vous sûr ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};