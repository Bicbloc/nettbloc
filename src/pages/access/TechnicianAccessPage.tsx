import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ArrowLeft, Check, X, Ban, RotateCcw, Trash2, Clock, Loader2, RefreshCw, Wrench } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
    phone?: string;
  } | null;
  hotels?: {
    name: string;
  };
}

const TechnicianAccessPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<TechnicianRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: userHotels } = await supabase
        .from('hotels')
        .select('id')
        .eq('user_id', user.id);

      const hotelIds = userHotels?.map(h => h.id) || [];
      if (hotelIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('technician_access_requests')
        .select(`
          id, technician_profile_id, hotel_id, hotel_code, status, requested_at,
          technician_profiles(name, email, phone),
          hotels(name)
        `)
        .in('hotel_id', hotelIds)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data as any[] || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
      return;
    }
    loadRequests();
  }, [user, authLoading, isAuthenticated]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('technician_requests_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_access_requests' }, () => {
        loadRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleApprove = async (request: TechnicianRequest) => {
    setProcessingId(request.id);
    try {
      await supabase
        .from('technician_access_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', request.id);

      toast.success('Technicien approuvé !');
      loadRequests();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await supabase
        .from('technician_access_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', requestId);
      toast.success('Demande refusée');
      loadRequests();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSuspend = async (request: TechnicianRequest) => {
    setProcessingId(request.id);
    try {
      await supabase
        .from('technician_access_requests')
        .update({ status: 'suspended', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', request.id);
      
      toast.success('Accès suspendu');
      loadRequests();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevokeSuspension = async (request: TechnicianRequest) => {
    setProcessingId(request.id);
    try {
      await supabase
        .from('technician_access_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', request.id);
      
      toast.success('Suspension révoquée');
      loadRequests();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Supprimer définitivement cette demande ?')) return;
    setProcessingId(requestId);
    try {
      await supabase.from('technician_access_requests').delete().eq('id', requestId);
      toast.success('Demande supprimée');
      loadRequests();
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
        return <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30"><Check className="h-3 w-3" /> Approuvé</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Refusé</Badge>;
      case 'suspended':
        return <Badge className="gap-1 bg-orange-500/10 text-orange-600 border-orange-500/30"><Ban className="h-3 w-3" /> Suspendu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-500" />
              <h1 className="text-xl font-semibold">Demandes d'accès - Techniciens</h1>
            </div>
            <Button variant="outline" size="sm" onClick={loadRequests} className="ml-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </header>

        <main className="container mx-auto py-6 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-500" />
                {requests.length} demande{requests.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Aucune demande d'accès
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Nom</TableHead>
                        <TableHead className="min-w-[200px]">Email</TableHead>
                        <TableHead className="min-w-[120px]">Téléphone</TableHead>
                        <TableHead className="min-w-[150px]">Hôtel</TableHead>
                        <TableHead className="min-w-[120px]">Statut</TableHead>
                        <TableHead className="min-w-[140px]">Date demande</TableHead>
                        <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.technician_profiles?.name || '-'}</TableCell>
                          <TableCell>{request.technician_profiles?.email || '-'}</TableCell>
                          <TableCell>{request.technician_profiles?.phone || '-'}</TableCell>
                          <TableCell>{(request as any).hotels?.name || request.hotel_code}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>{format(new Date(request.requested_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {processingId === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  {request.status === 'pending' && (
                                    <>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-100" onClick={() => handleApprove(request)}>
                                            <Check className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Approuver</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-100" onClick={() => handleReject(request.id)}>
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
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-600 hover:bg-orange-100" onClick={() => handleSuspend(request)}>
                                          <Ban className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Suspendre</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {request.status === 'suspended' && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-100" onClick={() => handleRevokeSuspension(request)}>
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Révoquer suspension</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {(request.status === 'rejected' || request.status === 'suspended') && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-100" onClick={() => handleDelete(request.id)}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Supprimer</TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default TechnicianAccessPage;
