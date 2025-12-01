import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Check, X, Clock, Ban, Trash2 } from 'lucide-react';
import { SuspensionDialog } from '@/components/SuspensionDialog';

interface AccessRequest {
  id: string;
  housekeeper_profile_id: string;
  hotel_id: string;
  hotel_code: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'deactivated';
  requested_at: string;
  suspension_reason?: string | null;
  housekeeper_profiles: {
    name: string;
    email: string;
    phone?: string;
  };
  hotels: {
    name: string;
  };
}

export const HousekeeperAccessRequests = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [suspensionDialogOpen, setSuspensionDialogOpen] = useState(false);
  const { user } = useAuth();

  // Notifications en temps réel désactivées temporairement
  // useEffect(() => {
  //   if (!user) return;

  //   const channel = supabase
  //     .channel('access_requests_changes')
  //     .on(
  //       'postgres_changes',
  //       {
  //         event: 'INSERT',
  //         schema: 'public',
  //         table: 'housekeeper_access_requests'
  //       },
  //       (payload) => {
  //         console.log('Nouvelle demande reçue:', payload);
  //         toast.success('📨 Nouvelle demande d\'accès reçue !');
  //         loadRequests();
  //       }
  //     )
  //     .subscribe();

  //   return () => {
  //     supabase.removeChannel(channel);
  //   };
  // }, [user]);

  const loadRequests = async () => {
    if (!user) return;

    try {
      // Charger les demandes d'accès pour les hôtels de l'utilisateur
      const { data: userHotels, error: hotelsError } = await supabase
        .from('hotels')
        .select('id')
        .eq('user_id', user.id);

      if (hotelsError) throw hotelsError;

      const hotelIds = userHotels?.map(h => h.id) || [];

      if (hotelIds.length === 0) {
        setRequests([]);
        return;
      }

      const { data, error } = await supabase
        .from('housekeeper_access_requests')
        .select(`
          id,
          housekeeper_profile_id,
          hotel_id,
          hotel_code,
          status,
          requested_at,
          suspension_reason,
          housekeeper_profiles!inner(
            name,
            email,
            phone
          ),
          hotels!inner(
            name
          )
        `)
        .in('hotel_id', hotelIds)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      setRequests((data as any[])?.map(req => ({
        ...req,
        status: req.status as 'pending' | 'approved' | 'rejected'
      })) || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      // Récupérer les détails de la demande
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      // Appeler le RPC pour approuver la demande
      const { data, error } = await supabase.rpc('approve_housekeeper_access_request', {
        request_id: requestId,
        admin_user_id: user?.id
      });

      if (error) {
        console.error('Error approving request:', error);
        toast.error('Erreur lors de l\'approbation');
        return;
      }

      // Créer une entrée dans housekeeper_hotel_history
      await supabase
        .from('housekeeper_hotel_history')
        .insert({
          housekeeper_profile_id: request.housekeeper_profile_id,
          hotel_id: request.hotel_id,
          started_at: new Date().toISOString(),
          rooms_cleaned: 0
        });

      toast.success('Demande approuvée ! La femme de chambre peut maintenant accéder à l\'hôtel.');
      loadRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Erreur lors de l\'approbation');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('housekeeper_access_requests')
        .update({ 
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          suspension_reason: null
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Demande rejetée');
      loadRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Erreur lors du rejet');
    }
  };

  const handleOpenSuspend = (request: AccessRequest) => {
    setSelectedRequest(request);
    setSuspensionDialogOpen(true);
  };

  const handleConfirmSuspend = async (reason: string) => {
    if (!selectedRequest) return;

    try {
      const nextStatus: AccessRequest['status'] = selectedRequest.status === 'suspended' ? 'approved' : 'suspended';
      const { error } = await supabase
        .from('housekeeper_access_requests')
        .update({
          status: nextStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          suspension_reason: nextStatus === 'suspended' ? reason : null
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success(nextStatus === 'suspended' ? 'Accès suspendu' : 'Accès réactivé');
      setSuspensionDialogOpen(false);
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      console.error('Error updating suspension:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const handleDeactivateRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('housekeeper_access_requests')
        .update({
          status: 'deactivated',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          suspension_reason: null
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Accès désactivé');
      loadRequests();
    } catch (error) {
      console.error('Error deactivating request:', error);
      toast.error('Erreur lors de la désactivation');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('housekeeper_access_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Demande supprimée');
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    loadRequests();
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <Check className="h-4 w-4" />;
      case 'rejected':
        return <X className="h-4 w-4" />;
      case 'suspended':
        return <Ban className="h-4 w-4" />;
      case 'deactivated':
        return <Ban className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'suspended':
        return 'secondary';
      case 'deactivated':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-pulse">Chargement...</div>
        </div>
      </Card>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Demandes d'accès</h2>
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {pendingRequests.length} nouvelle{pendingRequests.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <Alert className="bg-orange-50 border-orange-200">
            <Bell className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>{pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} en attente</strong> de validation. 
              Les femmes de chambre pourront accéder à votre hôtel après votre approbation.
            </AlertDescription>
          </Alert>
        )}

        {requests.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Aucune demande d'accès pour le moment</p>
            <p className="text-sm text-muted-foreground mt-2">
              Les nouvelles demandes apparaîtront ici automatiquement
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-lg">{request.housekeeper_profiles.name}</h3>
                    <Badge variant={getStatusVariant(request.status)} className="gap-1">
                      {getStatusIcon(request.status)}
                      {request.status === 'pending' && '🔔 En attente'}
                      {request.status === 'approved' && '✅ Validée'}
                      {request.status === 'rejected' && '❌ Rejetée'}
                      {request.status === 'suspended' && '⏸️ Suspendue'}
                      {request.status === 'deactivated' && '🚫 Désactivée'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {request.housekeeper_profiles.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Hôtel: {request.hotels.name} ({request.hotel_code})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Demandé le {new Date(request.requested_at).toLocaleDateString()}
                  </p>
                  {request.suspension_reason && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Motif: {request.suspension_reason}
                    </p>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectRequest(request.id)}
                      className="gap-1"
                    >
                      <Ban className="h-4 w-4" />
                      Refuser
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApproveRequest(request.id)}
                      className="gap-1 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                      Valider
                    </Button>
                  </div>
                )}

                {request.status === 'approved' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSuspend(request)}
                      className="gap-1"
                    >
                      <Ban className="h-4 w-4" />
                      Suspendre
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDeactivateRequest(request.id)}
                      className="gap-1"
                    >
                      <Ban className="h-4 w-4" />
                      Désactiver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRequest(request.id)}
                      className="gap-1 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                )}

                {request.status === 'suspended' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSuspend(request)}
                      className="gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Réactiver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRequest(request.id)}
                      className="gap-1 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                )}

                {request.status === 'deactivated' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeactivateRequest(request.id)}
                      className="gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Réactiver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRequest(request.id)}
                      className="gap-1 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <SuspensionDialog
          open={suspensionDialogOpen}
          onClose={() => {
            setSuspensionDialogOpen(false);
            setSelectedRequest(null);
          }}
          onConfirm={handleConfirmSuspend}
          userEmail={selectedRequest?.housekeeper_profiles.email ?? ''}
          isSuspended={selectedRequest?.status === 'suspended'}
        />
      </div>
    </Card>
  );
};