import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHotel } from '@/contexts/HotelContext';
import { Crown, Check, X, Clock, Loader2, RefreshCw } from 'lucide-react';

interface AccessRequest {
  id: string;
  governess_profile_id: string;
  hotel_id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  governess_profiles: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export function GovernessAccessRequests() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { hotelId } = useHotel();
  const { toast } = useToast();

  useEffect(() => {
    if (hotelId) {
      loadRequests();
    }
  }, [hotelId]);

  const loadRequests = async () => {
    if (!hotelId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('governess_access_requests')
        .select(`
          id,
          governess_profile_id,
          hotel_id,
          status,
          requested_at,
          reviewed_at,
          governess_profiles (
            id,
            name,
            email
          )
        `)
        .eq('hotel_id', hotelId)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request: AccessRequest) => {
    if (!hotelId) return;
    
    setProcessingId(request.id);
    try {
      // Mettre à jour le statut de la demande
      const { error: updateError } = await supabase
        .from('governess_access_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Créer la session d'accès
      const { data: hotel } = await supabase
        .from('hotels')
        .select('name')
        .eq('id', hotelId)
        .single();

      const { error: sessionError } = await supabase
        .from('governess_hotel_sessions')
        .insert({
          governess_profile_id: request.governess_profile_id,
          hotel_id: hotelId,
          hotel_name: hotel?.name || 'Hôtel',
          is_active: true,
          started_at: new Date().toISOString()
        });

      if (sessionError) throw sessionError;

      toast({
        title: "Accès accordé",
        description: `${request.governess_profiles?.name} a maintenant accès à votre établissement.`
      });

      loadRequests();
    } catch (error: any) {
      console.error('Erreur approbation:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: AccessRequest) => {
    setProcessingId(request.id);
    try {
      const { error } = await supabase
        .from('governess_access_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: "Demande refusée",
        description: `La demande de ${request.governess_profiles?.name} a été refusée.`
      });

      loadRequests();
    } catch (error: any) {
      console.error('Erreur refus:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold">Demandes d'accès gouvernantes</h3>
          {pendingRequests.length > 0 && (
            <Badge variant="destructive">{pendingRequests.length}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={loadRequests}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {pendingRequests.length === 0 && processedRequests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune demande d'accès pour le moment
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Demandes en attente */}
          {pendingRequests.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  En attente ({pendingRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingRequests.map(request => (
                  <div 
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{request.governess_profiles?.name || 'Gouvernante'}</p>
                      <p className="text-sm text-muted-foreground">{request.governess_profiles?.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.requested_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleReject(request)}
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
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(request)}
                        disabled={processingId === request.id}
                      >
                        {processingId === request.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Accepter
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Demandes traitées */}
          {processedRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Historique</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {processedRequests.slice(0, 5).map(request => (
                  <div 
                    key={request.id}
                    className="flex items-center justify-between py-2 px-3 rounded bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{request.governess_profiles?.name}</span>
                      <Badge 
                        variant={request.status === 'approved' ? 'default' : 'secondary'}
                        className={request.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                      >
                        {request.status === 'approved' ? 'Approuvé' : 'Refusé'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {request.reviewed_at && new Date(request.reviewed_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
