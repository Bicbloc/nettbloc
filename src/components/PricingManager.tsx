import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Euro, Save, Pencil, Crown, Package, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PricingPlan {
  id: string;
  plan_name: string;
  price_monthly: number;
  price_yearly: number | null;
  max_rooms: number | null;
  features: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function PricingManager() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      
      setPlans((data || []).map(p => ({
        ...p,
        features: typeof p.features === 'object' ? p.features as Record<string, boolean> : {}
      })));
    } catch (error) {
      console.error('Error loading pricing:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les tarifs"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = (plan: PricingPlan) => {
    setEditingPlan({ ...plan });
    setShowEditDialog(true);
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;

    try {
      const { error } = await supabase
        .from('pricing_config')
        .update({
          price_monthly: editingPlan.price_monthly,
          price_yearly: editingPlan.price_yearly,
          max_rooms: editingPlan.max_rooms,
          is_active: editingPlan.is_active
        })
        .eq('id', editingPlan.id);

      if (error) throw error;

      toast({
        title: "Tarif mis à jour",
        description: `Le plan ${editingPlan.plan_name} a été modifié avec succès.`
      });

      setShowEditDialog(false);
      loadPlans();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour le tarif"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Gestion des tarifs
              </CardTitle>
              <CardDescription>
                Modifiez les prix des différents plans d'abonnement
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadPlans}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Prix mensuel</TableHead>
                <TableHead>Prix annuel</TableHead>
                <TableHead>Max chambres</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière MAJ</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {plan.plan_name === 'premium' ? (
                        <Crown className="h-4 w-4 text-primary" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium capitalize">{plan.plan_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {plan.price_monthly.toFixed(2)} €
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {plan.price_yearly ? (
                      <Badge variant="outline" className="font-mono">
                        {plan.price_yearly.toFixed(2)} €
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.max_rooms ? (
                      <Badge variant="secondary">{plan.max_rooms} chambres</Badge>
                    ) : (
                      <Badge variant="default">Illimité</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(plan.updated_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Modifier le plan {editingPlan?.plan_name}
            </DialogTitle>
          </DialogHeader>
          
          {editingPlan && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_monthly">Prix mensuel (€)</Label>
                  <Input
                    id="price_monthly"
                    type="number"
                    step="0.01"
                    value={editingPlan.price_monthly}
                    onChange={(e) => setEditingPlan({
                      ...editingPlan,
                      price_monthly: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price_yearly">Prix annuel (€)</Label>
                  <Input
                    id="price_yearly"
                    type="number"
                    step="0.01"
                    value={editingPlan.price_yearly || ''}
                    onChange={(e) => setEditingPlan({
                      ...editingPlan,
                      price_yearly: e.target.value ? parseFloat(e.target.value) : null
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_rooms">Nombre max de chambres (vide = illimité)</Label>
                <Input
                  id="max_rooms"
                  type="number"
                  value={editingPlan.max_rooms || ''}
                  onChange={(e) => setEditingPlan({
                    ...editingPlan,
                    max_rooms: e.target.value ? parseInt(e.target.value) : null
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="is_active">Plan actif</Label>
                  <p className="text-sm text-muted-foreground">
                    Les utilisateurs peuvent souscrire à ce plan
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={editingPlan.is_active}
                  onCheckedChange={(checked) => setEditingPlan({
                    ...editingPlan,
                    is_active: checked
                  })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSavePlan}>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
