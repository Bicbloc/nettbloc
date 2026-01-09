import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Save, Edit2, X, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BillingInfo {
  billing_siret: string | null;
  billing_address: string | null;
  billing_email: string | null;
  company_name: string | null;
}

export const BillingInfoForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    billing_siret: null,
    billing_address: null,
    billing_email: null,
    company_name: null,
  });
  const [editedInfo, setEditedInfo] = useState<BillingInfo>(billingInfo);

  useEffect(() => {
    if (user) {
      loadBillingInfo();
    }
  }, [user]);

  const loadBillingInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('billing_siret, billing_address, billing_email, company_name')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      
      const info = {
        billing_siret: data?.billing_siret || null,
        billing_address: data?.billing_address || null,
        billing_email: data?.billing_email || null,
        company_name: data?.company_name || null,
      };
      setBillingInfo(info);
      setEditedInfo(info);
    } catch (error) {
      console.error('Error loading billing info:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate SIRET format (14 digits)
      if (editedInfo.billing_siret && !/^\d{14}$/.test(editedInfo.billing_siret.replace(/\s/g, ''))) {
        toast({
          variant: "destructive",
          title: "SIRET invalide",
          description: "Le numéro SIRET doit contenir 14 chiffres"
        });
        setIsSaving(false);
        return;
      }

      // Validate email format
      if (editedInfo.billing_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedInfo.billing_email)) {
        toast({
          variant: "destructive",
          title: "Email invalide",
          description: "Veuillez entrer une adresse email valide"
        });
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          billing_siret: editedInfo.billing_siret?.replace(/\s/g, '') || null,
          billing_address: editedInfo.billing_address || null,
          billing_email: editedInfo.billing_email || null,
          company_name: editedInfo.company_name || null,
        })
        .eq('id', user?.id);

      if (error) throw error;

      setBillingInfo(editedInfo);
      setIsEditing(false);
      toast({
        title: "Informations enregistrées",
        description: "Vos informations de facturation ont été mises à jour"
      });
    } catch (error) {
      console.error('Error saving billing info:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer les informations"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedInfo(billingInfo);
    setIsEditing(false);
  };

  const isComplete = billingInfo.billing_siret && billingInfo.billing_address && billingInfo.billing_email;

  return (
    <Card className={isComplete ? 'border-green-500/30' : 'border-orange-500/30'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informations de facturation
              {isComplete && <Check className="h-4 w-4 text-green-500" />}
            </CardTitle>
            <CardDescription>
              Ces informations apparaîtront sur vos factures
            </CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nom de l'établissement</Label>
                <Input
                  id="company_name"
                  value={editedInfo.company_name || ''}
                  onChange={(e) => setEditedInfo({ ...editedInfo, company_name: e.target.value })}
                  placeholder="Hôtel Example"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_siret">Numéro SIRET *</Label>
                <Input
                  id="billing_siret"
                  value={editedInfo.billing_siret || ''}
                  onChange={(e) => setEditedInfo({ ...editedInfo, billing_siret: e.target.value })}
                  placeholder="12345678901234"
                  maxLength={14}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_address">Adresse de l'établissement *</Label>
              <Textarea
                id="billing_address"
                value={editedInfo.billing_address || ''}
                onChange={(e) => setEditedInfo({ ...editedInfo, billing_address: e.target.value })}
                placeholder="123 Rue de l'Hôtel&#10;75001 Paris"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_email">Email comptabilité *</Label>
              <Input
                id="billing_email"
                type="email"
                value={editedInfo.billing_email || ''}
                onChange={(e) => setEditedInfo({ ...editedInfo, billing_email: e.target.value })}
                placeholder="comptabilite@hotel.com"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Établissement</p>
              <p className="font-medium">{billingInfo.company_name || 'Non renseigné'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SIRET</p>
              <p className="font-mono font-medium">{billingInfo.billing_siret || 'Non renseigné'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Adresse</p>
              <p className="font-medium whitespace-pre-line">{billingInfo.billing_address || 'Non renseignée'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Email comptabilité</p>
              <p className="font-medium">{billingInfo.billing_email || 'Non renseigné'}</p>
            </div>
          </div>
        )}

        {!isComplete && !isEditing && (
          <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-sm text-orange-600 dark:text-orange-400">
              ⚠️ Veuillez compléter vos informations de facturation pour recevoir vos factures
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
