import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Clock, Crown, Gift } from 'lucide-react';

interface SubscriptionManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  currentStatus: string;
  currentTrialEnd?: string;
  onSuccess: () => void;
}

export function SubscriptionManagementDialog({
  isOpen,
  onClose,
  userId,
  userEmail,
  currentStatus,
  currentTrialEnd,
  onSuccess
}: SubscriptionManagementDialogProps) {
  const [action, setAction] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [extensionDays, setExtensionDays] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExtendTrial = async () => {
    if (!extensionDays || parseInt(extensionDays) <= 0) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir un nombre de jours valide"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('extend_trial_period', {
        p_user_id: userId,
        p_extension_days: parseInt(extensionDays),
        p_reason: reason || null
      });

      if (error) throw error;

      // Envoyer un email de notification à l'utilisateur
      await supabase.functions.invoke('send-activation-email', {
        body: {
          email: userEmail,
          type: 'trial_extension',
          extensionDays: parseInt(extensionDays),
          reason: reason
        }
      });

      toast({
        title: "✅ Période d'essai étendue",
        description: `${extensionDays} jours ajoutés avec succès. Email de notification envoyé à ${userEmail}`
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Erreur lors de l\'extension:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'étendre la période d'essai"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!newStatus) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner un statut"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('change_subscription_status', {
        p_user_id: userId,
        p_new_status: newStatus,
        p_reason: reason || null
      });

      if (error) throw error;

      // Envoyer un email de notification à l'utilisateur
      await supabase.functions.invoke('send-activation-email', {
        body: {
          email: userEmail,
          type: 'status_change',
          newStatus: newStatus,
          reason: reason
        }
      });

      toast({
        title: "✅ Statut modifié",
        description: `Statut changé vers "${newStatus}" avec succès. Email de notification envoyé à ${userEmail}`
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Erreur lors du changement de statut:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de changer le statut"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAction('');
    setNewStatus('');
    setExtensionDays('');
    setReason('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'trial': return <Clock className="h-4 w-4" />;
      case 'premium': return <Crown className="h-4 w-4" />;
      case 'free': return <Gift className="h-4 w-4" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'trial': return 'Période d\'essai';
      case 'premium': return 'Premium';
      case 'free': return 'Gratuit';
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🔧 Gestion d'abonnement
          </DialogTitle>
          <DialogDescription>
            Modifier le statut d'abonnement pour <strong>{userEmail}</strong>
            <br />
            <div className="flex items-center gap-2 mt-2">
              Statut actuel: {getStatusIcon(currentStatus)}
              <span className="font-medium">{getStatusLabel(currentStatus)}</span>
              {currentTrialEnd && (
                <span className="text-sm text-muted-foreground">
                  (expire le {new Date(currentTrialEnd).toLocaleDateString('fr-FR')})
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="action">Action à effectuer</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue placeholder="Choisissez une action..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="extend">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Étendre la période d'essai
                  </div>
                </SelectItem>
                <SelectItem value="change">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Changer le statut d'abonnement
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {action === 'extend' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="days">Nombre de jours à ajouter</Label>
                <Input
                  id="days"
                  type="number"
                  min="1"
                  max="365"
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(e.target.value)}
                  placeholder="Ex: 30"
                />
              </div>
            </div>
          )}

          {action === 'change' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="status">Nouveau statut</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un statut..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        Gratuit
                      </div>
                    </SelectItem>
                    <SelectItem value="trial">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Période d'essai
                      </div>
                    </SelectItem>
                    <SelectItem value="premium">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Premium
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {action && (
            <div>
              <Label htmlFor="reason">Raison (optionnel)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Expliquez la raison de cette modification..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          {action === 'extend' && (
            <Button 
              onClick={handleExtendTrial} 
              disabled={isSubmitting || !extensionDays}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Extension...' : 'Étendre la période'}
            </Button>
          )}
          {action === 'change' && (
            <Button 
              onClick={handleChangeStatus} 
              disabled={isSubmitting || !newStatus}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Modification...' : 'Changer le statut'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}