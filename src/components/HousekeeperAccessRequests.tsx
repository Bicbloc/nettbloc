import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Check, X, Clock, Ban } from 'lucide-react';

interface AccessRequest {
  id: string;
  housekeeper_profile_id: string;
  hotel_id: string;
  hotel_code: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
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
  const { user } = useAuth();

  // Écouter les nouvelles demandes en temps réel
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('access_requests_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'housekeeper_access_requests'
        },
        (payload) => {
          console.log('Nouvelle demande reçue:', payload);
          toast.success('📨 Nouvelle demande d\'accès reçue !');
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

      // IMPORTANT: Créer ou mettre à jour une entrée dans housekeepers pour l'assignation
      // Vérifier si elle n'existe pas déjà par user_id OU par nom
      const { data: existingByUserId } = await supabase
        .from('housekeepers')
        .select('id, name')
        .eq('hotel_id', request.hotel_id)
        .eq('user_id', request.housekeeper_profile_id)
        .eq('is_active', true)
        .maybeSingle();

      const { data: existingByName } = await supabase
        .from('housekeepers')
        .select('id, user_id')
        .eq('hotel_id', request.hotel_id)
        .ilike('name', request.housekeeper_profiles.name)
        .eq('is_active', true)
        .maybeSingle();

      if (existingByUserId) {
        // Mettre à jour le nom si différent
        if (existingByUserId.name !== request.housekeeper_profiles.name) {
          await supabase
            .from('housekeepers')
            .update({ name: request.housekeeper_profiles.name, updated_at: new Date().toISOString() })
            .eq('id', existingByUserId.id);
        }
        console.log('✅ Housekeeper already exists for this profile:', request.housekeeper_profiles.name);
      } else if (existingByName && !existingByName.user_id) {
        // Une entrée existe avec ce nom mais sans user_id lié - la mettre à jour
        await supabase
          .from('housekeepers')
          .update({ 
            user_id: request.housekeeper_profile_id, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', existingByName.id);
        console.log('✅ Housekeeper entry linked to profile:', request.housekeeper_profiles.name);
      } else if (!existingByName) {
        // Aucune entrée existante - créer une nouvelle
        const nameInitials = request.housekeeper_profiles.name.toUpperCase().slice(0, 3);
        const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
        const accessCode = `${request.hotel_code}-${nameInitials}-${randomSuffix}`;

        const { error: housekeeperError } = await supabase
          .from('housekeepers')
          .insert({
            hotel_id: request.hotel_id,
            name: request.housekeeper_profiles.name,
            access_code: accessCode,
            user_id: request.housekeeper_profile_id,
            is_active: true
          });

        if (housekeeperError) {
          console.error('Error creating housekeeper entry:', housekeeperError);
        } else {
          console.log('✅ Housekeeper entry created:', request.housekeeper_profiles.name);
        }
      } else {
        console.log('ℹ️ Housekeeper with same name exists with different profile');
      }

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
          reviewed_by: user?.id 
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
                      {request.status === 'pending' ? '🔔 En attente' : 
                       request.status === 'approved' ? '✅ Validée' : '❌ Suspendue'}
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
                      Suspendre
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
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};