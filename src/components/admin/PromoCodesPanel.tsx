import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Gift, Plus, Trash2, Edit, RefreshCw, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount' | 'free_months';
  discount_value: number;
  applicable_plans: string[];
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export function PromoCodesPanel() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'fixed_amount' | 'free_months'>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formApplicablePlans, setFormApplicablePlans] = useState<string[]>(['essentiel', 'confort', 'business', 'entreprise']);

  const loadPromoCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromoCodes((data || []) as PromoCode[]);
    } catch (error) {
      console.error('Error loading promo codes:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les codes promo."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromoCodes();
  }, []);

  const resetForm = () => {
    setFormCode('');
    setFormDescription('');
    setFormDiscountType('percentage');
    setFormDiscountValue('');
    setFormMaxUses('');
    setFormValidUntil('');
    setFormApplicablePlans(['essentiel', 'confort', 'business', 'entreprise']);
    setEditingCode(null);
  };

  const handleCreate = async () => {
    if (!formCode.trim() || !formDiscountValue) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Code et valeur de réduction requis."
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('promo_codes')
        .insert({
          code: formCode.toUpperCase().trim(),
          description: formDescription || null,
          discount_type: formDiscountType,
          discount_value: parseFloat(formDiscountValue),
          max_uses: formMaxUses ? parseInt(formMaxUses) : null,
          valid_until: formValidUntil || null,
          applicable_plans: formApplicablePlans,
          created_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Code promo créé",
        description: `Le code ${formCode.toUpperCase()} a été créé avec succès.`
      });

      resetForm();
      setShowCreateDialog(false);
      loadPromoCodes();
    } catch (error) {
      console.error('Error creating promo code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer le code promo."
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingCode) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({
          code: formCode.toUpperCase().trim(),
          description: formDescription || null,
          discount_type: formDiscountType,
          discount_value: parseFloat(formDiscountValue),
          max_uses: formMaxUses ? parseInt(formMaxUses) : null,
          valid_until: formValidUntil || null,
          applicable_plans: formApplicablePlans,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingCode.id);

      if (error) throw error;

      toast({
        title: "Code promo modifié",
        description: "Les modifications ont été sauvegardées."
      });

      resetForm();
      setShowCreateDialog(false);
      loadPromoCodes();
    } catch (error) {
      console.error('Error updating promo code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le code promo."
      });
    }
  };

  const toggleActive = async (code: PromoCode) => {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !code.is_active })
        .eq('id', code.id);

      if (error) throw error;

      setPromoCodes(prev => prev.map(c => 
        c.id === code.id ? { ...c, is_active: !c.is_active } : c
      ));
    } catch (error) {
      console.error('Error toggling promo code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le statut."
      });
    }
  };

  const deleteCode = async (code: PromoCode) => {
    if (!confirm(`Supprimer le code ${code.code} ?`)) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', code.id);

      if (error) throw error;

      setPromoCodes(prev => prev.filter(c => c.id !== code.id));
      toast({
        title: "Code supprimé",
        description: `Le code ${code.code} a été supprimé.`
      });
    } catch (error) {
      console.error('Error deleting promo code:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer le code promo."
      });
    }
  };

  const openEditDialog = (code: PromoCode) => {
    setEditingCode(code);
    setFormCode(code.code);
    setFormDescription(code.description || '');
    setFormDiscountType(code.discount_type);
    setFormDiscountValue(code.discount_value.toString());
    setFormMaxUses(code.max_uses?.toString() || '');
    setFormValidUntil(code.valid_until ? code.valid_until.split('T')[0] : '');
    setFormApplicablePlans(code.applicable_plans);
    setShowCreateDialog(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copié",
      description: `${code} copié dans le presse-papiers.`
    });
  };

  const getDiscountDisplay = (code: PromoCode) => {
    switch (code.discount_type) {
      case 'percentage':
        return `${code.discount_value}%`;
      case 'fixed_amount':
        return `${code.discount_value}€`;
      case 'free_months':
        return `${code.discount_value} mois gratuit${code.discount_value > 1 ? 's' : ''}`;
    }
  };

  if (loading) {
    return <div className="animate-pulse">Chargement des codes promo...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Codes promo ({promoCodes.length})
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPromoCodes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCode ? 'Modifier le code promo' : 'Créer un code promo'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="EX: PROMO20"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Description optionnelle"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type de réduction</Label>
                    <Select value={formDiscountType} onValueChange={(v) => setFormDiscountType(v as typeof formDiscountType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Pourcentage</SelectItem>
                        <SelectItem value="fixed_amount">Montant fixe (€)</SelectItem>
                        <SelectItem value="free_months">Mois gratuits</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valeur</Label>
                    <Input
                      type="number"
                      value={formDiscountValue}
                      onChange={(e) => setFormDiscountValue(e.target.value)}
                      placeholder={formDiscountType === 'percentage' ? '20' : '50'}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Utilisations max (optionnel)</Label>
                    <Input
                      type="number"
                      value={formMaxUses}
                      onChange={(e) => setFormMaxUses(e.target.value)}
                      placeholder="Illimité"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valide jusqu'au (optionnel)</Label>
                    <Input
                      type="date"
                      value={formValidUntil}
                      onChange={(e) => setFormValidUntil(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Annuler
                  </Button>
                  <Button onClick={editingCode ? handleUpdate : handleCreate}>
                    {editingCode ? 'Modifier' : 'Créer'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {promoCodes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun code promo. Créez-en un pour commencer.
            </CardContent>
          </Card>
        ) : (
          promoCodes.map(code => (
            <Card key={code.id} className={!code.is_active ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg">{code.code}</span>
                        <Button variant="ghost" size="sm" onClick={() => copyCode(code.code)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {code.description && (
                        <p className="text-sm text-muted-foreground">{code.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="text-lg">
                      {getDiscountDisplay(code)}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      {code.current_uses}{code.max_uses ? `/${code.max_uses}` : ''} utilisations
                    </div>
                    <Switch
                      checked={code.is_active}
                      onCheckedChange={() => toggleActive(code)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(code)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteCode(code)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {code.valid_until && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Expire le {format(new Date(code.valid_until), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
