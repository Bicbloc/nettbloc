import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Check, X, Clock, Ban, RotateCcw, Trash2 } from 'lucide-react';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AccessRequest {
  id: string;
  housekeeper_profile_id: string;
  hotel_id: string;
  hotel_code: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
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
  const { refreshHousekeepers } = useHousekeeping();

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
        status: req.status as 'pending' | 'approved' | 'rejected' | 'suspended'
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
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      const { data, error } = await supabase.rpc('approve_housekeeper_access_request', {
        request_id: requestId,
        admin_user_id: user?.id
      });

      if (error) {
        console.error('Error approving request:', error);
        toast.error('Erreur lors de l\'approbation');
        return;
      }

      await supabase
        .from('housekeeper_hotel_history')
        .insert({
          housekeeper_profile_id: request.housekeeper_profile_id,
          hotel_id: request.hotel_id,
          started_at: new Date().toISOString(),
          rooms_cleaned: 0
        });

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
        if (existingByUserId.name !== request.housekeeper_profiles.name) {
          await supabase
            .from('housekeepers')
            .update({ name: request.housekeeper_profiles.name, updated_at: new Date().toISOString() })
            .eq('id', existingByUserId.id);
        }
      } else if (existingByName && !existingByName.user_id) {
        await supabase
          .from('housekeepers')
          .update({ 
            user_id: request.housekeeper_profile_id, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', existingByName.id);
      } else if (!existingByName) {
        const nameInitials = request.housekeeper_profiles.name.toUpperCase().slice(0, 3);
        const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
        const accessCode = `${request.hotel_code}-${nameInitials}-${randomSuffix}`;

        await supabase
          .from('housekeepers')
          .insert({
            hotel_id: request.hotel_id,
            name: request.housekeeper_profiles.name,
            access_code: accessCode,
            user_id: request.housekeeper_profile_id,
            is_active: true
          });
      }

      toast.success('Demande approuvée !');
      await refreshHousekeepers();
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

  const handleSuspendRequest = async (requestId: string) => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      // Update request status to suspended
      const { error } = await supabase
        .from('housekeeper_access_requests')
        .update({ 
          status: 'suspended',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id 
        })
        .eq('id', requestId);

      if (error) throw error;

      // Deactivate the housekeeper in the hotel
      await supabase
        .from('housekeepers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('hotel_id', request.hotel_id)
        .eq('user_id', request.housekeeper_profile_id);

      // End any active sessions
      await supabase
        .from('hotel_access_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('hotel_id', request.hotel_id)
        .eq('housekeeper_profile_id', request.housekeeper_profile_id)
        .eq('is_active', true);

      toast.success('Accès suspendu');
      await refreshHousekeepers();
      loadRequests();
    } catch (error) {
      console.error('Error suspending request:', error);
      toast.error('Erreur lors de la suspension');
    }
  };

  const handleRevokeSuspension = async (requestId: string) => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      // Restore request status to approved
      const { error } = await supabase
        .from('housekeeper_access_requests')
        .update({ 
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id 
        })
        .eq('id', requestId);

      if (error) throw error;

      // Reactivate the housekeeper in the hotel
      await supabase
        .from('housekeepers')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('hotel_id', request.hotel_id)
        .eq('user_id', request.housekeeper_profile_id);

      toast.success('Suspension révoquée - Accès rétabli');
      await refreshHousekeepers();
      loadRequests();
    } catch (error) {
      console.error('Error revoking suspension:', error);
      toast.error('Erreur lors de la révocation');
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
      loadRequests();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    loadRequests();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="h-3 w-3" />
            En attente
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-300">
            <Check className="h-3 w-3" />
            Approuvée
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <X className="h-3 w-3" />
            Rejetée
          </Badge>
        );
      case 'suspended':
        return (
          <Badge className="gap-1 bg-orange-100 text-orange-800 border-orange-300">
            <Ban className="h-3 w-3" />
            Suspendue
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
            <h2 className="text-xl font-semibold">Demandes d'accès - Femmes de chambre</h2>
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {pendingRequests.length} nouvelle{pendingRequests.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <Alert className="bg-amber-50 border-amber-200">
            <Bell className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>{pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} en attente</strong> de validation.
            </AlertDescription>
          </Alert>
        )}

        {requests.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Aucune demande d'accès pour le moment</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Nom</TableHead>
                  <TableHead className="min-w-[180px]">Email</TableHead>
                  <TableHead className="min-w-[140px]">Hôtel</TableHead>
                  <TableHead className="min-w-[100px]">Statut</TableHead>
                  <TableHead className="min-w-[100px]">Date</TableHead>
                  <TableHead className="min-w-[140px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.housekeeper_profiles.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.housekeeper_profiles.email}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{request.hotels.name}</span>
                      <span className="text-xs text-muted-foreground block">{request.hotel_code}</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(request.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(request.requested_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                          {request.status === 'pending' && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleApproveRequest(request.id)}
                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Approuver</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleRejectRequest(request.id)}
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Refuser</TooltipContent>
                              </Tooltip>
                            </>
                          )}

                          {request.status === 'approved' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleSuspendRequest(request.id)}
                                  className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Suspendre</TooltipContent>
                            </Tooltip>
                          )}

                          {request.status === 'suspended' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleRevokeSuspension(request.id)}
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Révoquer la suspension</TooltipContent>
                            </Tooltip>
                          )}

                          {(request.status === 'rejected' || request.status === 'suspended') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteRequest(request.id)}
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer</TooltipContent>
                            </Tooltip>
                          )}
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Card>
  );
};
