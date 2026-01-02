import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Mail, Plus, Loader2, UserPlus, Clock, CheckCircle, XCircle, Send, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface StaffInvitationsTabProps {
  currentHotelId: string | null;
  hotelName?: string;
}

interface Invitation {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  invitation_code: string;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  housekeeper: 'Femme de chambre',
  technician: 'Technicien',
  governess: 'Gouvernante'
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'En attente', variant: 'secondary' },
  sent: { label: 'Envoyé', variant: 'default' },
  accepted: { label: 'Accepté', variant: 'default' },
  expired: { label: 'Expiré', variant: 'destructive' },
  cancelled: { label: 'Annulé', variant: 'destructive' }
};

export const StaffInvitationsTab: React.FC<StaffInvitationsTabProps> = ({ currentHotelId, hotelName }) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'housekeeper' as 'housekeeper' | 'technician' | 'governess'
  });

  useEffect(() => {
    if (currentHotelId) {
      loadInvitations();
    }
  }, [currentHotelId]);

  const loadInvitations = async () => {
    if (!currentHotelId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_invitations')
        .select('*')
        .eq('hotel_id', currentHotelId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Erreur chargement invitations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!currentHotelId || !formData.email || !formData.name) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez remplir tous les champs' });
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Email invalide' });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await supabase.functions.invoke('send-staff-invitation', {
        body: {
          email: formData.email,
          name: formData.name,
          role: formData.role,
          hotelId: currentHotelId,
          hotelName: hotelName || 'Votre hôtel',
          invitedBy: user?.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: '✅ Invitation envoyée',
        description: `Un email a été envoyé à ${formData.email}`
      });

      setFormData({ email: '', name: '', role: 'housekeeper' });
      setIsDialogOpen(false);
      loadInvitations();
    } catch (error: any) {
      console.error('Erreur envoi invitation:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || "Impossible d'envoyer l'invitation"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelInvitation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('staff_invitations')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Invitation annulée' });
      loadInvitations();
    } catch (error) {
      console.error('Erreur annulation:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible d'annuler l'invitation" });
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await supabase.functions.invoke('send-staff-invitation', {
        body: {
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          hotelId: currentHotelId,
          hotelName: hotelName || 'Votre hôtel',
          invitedBy: user?.id
        }
      });

      if (response.error) throw new Error(response.error.message);

      toast({
        title: '✅ Invitation renvoyée',
        description: `Un nouvel email a été envoyé à ${invitation.email}`
      });
      
      loadInvitations();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } finally {
      setIsSending(false);
    }
  };

  if (!currentHotelId) {
    return (
      <Card className="p-8 text-center">
        <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sélectionnez un hôtel pour gérer les invitations</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Invitations du personnel
              </CardTitle>
              <CardDescription>
                Invitez des femmes de chambre, techniciens ou gouvernantes par email
              </CardDescription>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nouvelle invitation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Inviter un membre du personnel</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
                    <Input
                      id="name"
                      placeholder="Marie Dupont"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="marie@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Rôle</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: 'housekeeper' | 'technician' | 'governess') => 
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="housekeeper">Femme de chambre</SelectItem>
                        <SelectItem value="technician">Technicien</SelectItem>
                        <SelectItem value="governess">Gouvernante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleSendInvitation} disabled={isSending} className="gap-2">
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Envoyer l'invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Aucune invitation</h3>
              <p className="text-muted-foreground text-sm">
                Commencez par inviter un membre du personnel
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.name}</TableCell>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabels[invitation.role] || invitation.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[invitation.status]?.variant || 'secondary'}>
                        {statusConfig[invitation.status]?.label || invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(parseISO(invitation.created_at), 'd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {(invitation.status === 'pending' || invitation.status === 'sent') && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleResendInvitation(invitation)}
                              disabled={isSending}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleCancelInvitation(invitation.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
