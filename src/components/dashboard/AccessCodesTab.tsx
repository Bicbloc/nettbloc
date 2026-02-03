/**
 * Composant Demandes d'accès
 * Gestion des demandes d'accès des femmes de chambre, gouvernantes et techniciens
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X, Clock, Loader2, RefreshCw, UserPlus, Crown, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useHotel } from "@/contexts/HotelContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AccessCodesTabProps {
  currentHotelId: string | null;
}

interface HousekeeperRequest {
  id: string;
  housekeeper_profile_id: string;
  hotel_id: string;
  hotel_code: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  housekeeper_profiles: {
    name: string;
    email: string;
  };
}

interface GovernessRequest {
  id: string;
  governess_profile_id: string;
  hotel_id: string;
  status: string;
  requested_at: string;
  governess_profiles: {
    name: string;
    email: string;
  } | null;
}

interface TechnicianRequest {
  id: string;
  technician_profile_id: string;
  hotel_id: string;
  hotel_code: string;
  status: string;
  requested_at: string;
  technician_profiles: {
    name: string;
    email: string;
  } | null;
}

export function AccessCodesTab({ currentHotelId }: AccessCodesTabProps) {
  const { user } = useAuth();
  const { hotelId } = useHotel();
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [housekeeperRequests, setHousekeeperRequests] = useState<HousekeeperRequest[]>([]);
  const [governessRequests, setGovernessRequests] = useState<GovernessRequest[]>([]);
  const [technicianRequests, setTechnicianRequests] = useState<TechnicianRequest[]>([]);

  const activeHotelId = currentHotelId || hotelId;

  const loadAllRequests = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get user hotels
      const { data: userHotels } = await supabase
        .from('hotels')
        .select('id')
        .eq('user_id', user.id);

      const hotelIds = userHotels?.map(h => h.id) || [];
      if (hotelIds.length === 0) {
        setLoading(false);
        return;
      }

      // Load all requests in parallel
      const [housekeeperRes, governessRes, technicianRes] = await Promise.all([
        supabase
          .from('housekeeper_access_requests')
          .select(`
            id, housekeeper_profile_id, hotel_id, hotel_code, status, requested_at,
            housekeeper_profiles!inner(name, email)
          `)
          .in('hotel_id', hotelIds)
          .order('requested_at', { ascending: false }),
        
        supabase
          .from('governess_access_requests')
          .select(`
            id, governess_profile_id, hotel_id, status, requested_at,
            governess_profiles(name, email)
          `)
          .in('hotel_id', hotelIds)
          .order('requested_at', { ascending: false }),
        
        supabase
          .from('technician_access_requests')
          .select(`
            id, technician_profile_id, hotel_id, hotel_code, status, requested_at,
            technician_profiles(name, email)
          `)
          .in('hotel_id', hotelIds)
          .order('requested_at', { ascending: false })
      ]);

      setHousekeeperRequests(housekeeperRes.data as any[] || []);
      setGovernessRequests(governessRes.data as any[] || []);
      setTechnicianRequests(technicianRes.data as any[] || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllRequests();
  }, [user, activeHotelId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('all_access_requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'housekeeper_access_requests' }, () => {
        toast.success('📨 Nouvelle demande femme de chambre !');
        loadAllRequests();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'governess_access_requests' }, () => {
        toast.success('📨 Nouvelle demande gouvernante !');
        loadAllRequests();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'technician_access_requests' }, () => {
        toast.success('📨 Nouvelle demande technicien !');
        loadAllRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Approve/Reject handlers
  const handleApproveHousekeeper = async (request: HousekeeperRequest) => {
    setProcessingId(request.id);
    try {
      const { error } = await supabase.rpc('approve_housekeeper_access_request', {
        request_id: request.id,
        admin_user_id: user?.id
      });
      if (error) throw error;

      // Create housekeeper entry
      const nameInitials = request.housekeeper_profiles.name.toUpperCase().slice(0, 3);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const accessCode = `${request.hotel_code}-${nameInitials}-${randomSuffix}`;

      await supabase.from('housekeepers').upsert({
        hotel_id: request.hotel_id,
        name: request.housekeeper_profiles.name,
        access_code: accessCode,
        user_id: request.housekeeper_profile_id,
        is_active: true
      }, { onConflict: 'hotel_id,user_id' });

      await supabase.from('housekeeper_hotel_history').insert({
        housekeeper_profile_id: request.housekeeper_profile_id,
        hotel_id: request.hotel_id,
        rooms_cleaned: 0
      });

      toast.success('Femme de chambre approuvée !');
      loadAllRequests();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'approbation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectHousekeeper = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await supabase
        .from('housekeeper_access_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', requestId);
      toast.success('Demande refusée');
      loadAllRequests();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveGoverness = async (request: GovernessRequest) => {
    setProcessingId(request.id);
    try {
      await supabase
        .from('governess_access_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', request.id);

      const { data: hotel } = await supabase.from('hotels').select('name').eq('id', request.hotel_id).single();

      await supabase.from('governess_hotel_sessions').insert({
        governess_profile_id: request.governess_profile_id,
        hotel_id: request.hotel_id,
        hotel_name: hotel?.name || 'Hôtel',
        is_active: true
      });

      toast.success('Gouvernante approuvée !');
      loadAllRequests();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectGoverness = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await supabase
        .from('governess_access_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', requestId);
      toast.success('Demande refusée');
      loadAllRequests();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveTechnician = async (request: TechnicianRequest) => {
    setProcessingId(request.id);
    try {
      await supabase
        .from('technician_access_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', request.id);

      toast.success('Technicien approuvé !');
      loadAllRequests();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTechnician = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await supabase
        .from('technician_access_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', requestId);
      toast.success('Demande refusée');
      loadAllRequests();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> En attente</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-700 gap-1"><Check className="h-3 w-3" /> Approuvé</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Refusé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingHousekeepers = housekeeperRequests.filter(r => r.status === 'pending');
  const pendingGovernesses = governessRequests.filter(r => r.status === 'pending');
  const pendingTechnicians = technicianRequests.filter(r => r.status === 'pending');
  const totalPending = pendingHousekeepers.length + pendingGovernesses.length + pendingTechnicians.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderRequestTable = (
    requests: any[],
    type: 'housekeeper' | 'governess' | 'technician',
    onApprove: (req: any) => void,
    onReject: (id: string) => void
  ) => {
    const profileKey = type === 'housekeeper' ? 'housekeeper_profiles' : type === 'governess' ? 'governess_profiles' : 'technician_profiles';

    if (requests.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Aucune demande
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">
                {request[profileKey]?.name || 'N/A'}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {request[profileKey]?.email || 'N/A'}
              </TableCell>
              <TableCell>
                {getStatusBadge(request.status)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(request.requested_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short'
                })}
              </TableCell>
              <TableCell className="text-right">
                {request.status === 'pending' && (
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onReject(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 bg-green-600 hover:bg-green-700"
                      onClick={() => onApprove(request)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Valider
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Demandes d'accès</h2>
          {totalPending > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {totalPending} en attente
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadAllRequests}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {totalPending > 0 && (
        <Alert className="bg-orange-50 border-orange-200">
          <Bell className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>{totalPending} demande{totalPending > 1 ? 's' : ''}</strong> en attente de validation
          </AlertDescription>
        </Alert>
      )}

      {/* 3 Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Housekeepers Column */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-blue-100">
                <UserPlus className="h-4 w-4 text-blue-600" />
              </div>
              Femmes de chambre
              {pendingHousekeepers.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {pendingHousekeepers.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {renderRequestTable(
              housekeeperRequests,
              'housekeeper',
              handleApproveHousekeeper,
              handleRejectHousekeeper
            )}
          </CardContent>
        </Card>

        {/* Governesses Column */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-amber-100">
                <Crown className="h-4 w-4 text-amber-600" />
              </div>
              Gouvernantes
              {pendingGovernesses.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {pendingGovernesses.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {renderRequestTable(
              governessRequests,
              'governess',
              handleApproveGoverness,
              handleRejectGoverness
            )}
          </CardContent>
        </Card>

        {/* Technicians Column */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-purple-100">
                <Wrench className="h-4 w-4 text-purple-600" />
              </div>
              Techniciens
              {pendingTechnicians.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {pendingTechnicians.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {renderRequestTable(
              technicianRequests,
              'technician',
              handleApproveTechnician,
              handleRejectTechnician
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
