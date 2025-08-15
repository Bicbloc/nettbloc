import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, Check, X, Clock } from 'lucide-react';

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

  const loadRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('housekeeper_access_requests')
        .select(`
          *,
          housekeeper_profiles!inner (
            name,
            email,
            phone
          ),
          hotels!inner (
            name,
            user_id
          )
        `)
        .eq('hotels.user_id', user.id)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error loading requests:', error);
        toast.error('Erreur lors du chargement des demandes');
        return;
      }

      setRequests((data as any) || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const { data, error } = await supabase.rpc('approve_housekeeper_access_request', {
        request_id: requestId,
        admin_user_id: user?.id
      });

      if (error) {
        console.error('Error approving request:', error);
        toast.error('Erreur lors de l\'approbation');
        return;
      }

      toast.success('Demande approuvée avec succès !');
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

      if (error) {
        console.error('Error rejecting request:', error);
        toast.error('Erreur lors du rejet');
        return;
      }

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
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Demandes d'accès des femmes de chambre</h2>
          {pendingRequests.length > 0 && (
            <Badge variant="secondary">{pendingRequests.length} en attente</Badge>
          )}
        </div>

        {requests.length === 0 ? (
          <p className="text-muted-foreground">Aucune demande d'accès</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{request.housekeeper_profiles.name}</h3>
                    <Badge variant={getStatusVariant(request.status)} className="gap-1">
                      {getStatusIcon(request.status)}
                      {request.status === 'pending' ? 'En attente' : 
                       request.status === 'approved' ? 'Approuvée' : 'Rejetée'}
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
                      variant="outline"
                      onClick={() => handleRejectRequest(request.id)}
                      className="gap-1"
                    >
                      <X className="h-4 w-4" />
                      Rejeter
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApproveRequest(request.id)}
                      className="gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Approuver
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