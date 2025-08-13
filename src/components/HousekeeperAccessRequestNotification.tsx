import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  Hotel, 
  CheckCircle, 
  X, 
  Clock,
  UserCheck,
  AlertCircle 
} from 'lucide-react';

interface HousekeeperAccessRequest {
  id: string;
  housekeeper_profile_id: string;
  hotel_id: string;
  hotel_code: string;
  requested_at: string;
  status: string;
  housekeeper_profile?: {
    name: string;
    email: string;
    phone?: string;
    total_rooms_cleaned: number;
    total_hotels_worked: number;
  } | null;
}

interface HousekeeperAccessRequestNotificationProps {
  hotelId?: string;
}

export const HousekeeperAccessRequestNotification: React.FC<HousekeeperAccessRequestNotificationProps> = ({ 
  hotelId 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingRequests, setPendingRequests] = useState<HousekeeperAccessRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<HousekeeperAccessRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPendingRequests();
    setupRealtimeSubscription();
  }, [user, hotelId]);

  const loadPendingRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('housekeeper_access_requests')
        .select(`
          *,
          housekeeper_profile:housekeeper_profiles(
            name,
            email,
            phone,
            total_rooms_cleaned,
            total_hotels_worked
          )
        `)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (error) throw error;

      const requests = (data || []).map(request => ({
        ...request,
        housekeeper_profile: Array.isArray(request.housekeeper_profile) 
          ? request.housekeeper_profile[0] || null 
          : request.housekeeper_profile
      })) as HousekeeperAccessRequest[];

      setPendingRequests(requests);
      
      // Auto-open dialog if there's a new request
      if (requests.length > 0 && !isDialogOpen) {
        setSelectedRequest(requests[0]);
        setIsDialogOpen(true);
      }
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('housekeeper_access_requests_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'housekeeper_access_requests',
          filter: `status=eq.pending`
        },
        (payload) => {
          console.log('New access request received:', payload);
          loadPendingRequests();
          
          toast({
            title: "🔔 Nouvelle demande d'accès",
            description: "Une femme de chambre demande l'accès à votre hôtel",
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const approveRequest = async () => {
    if (!selectedRequest || !user) return;

    setIsProcessing(true);
    try {
      // Generate access code using the existing RPC
      const { data: accessCode, error: codeError } = await supabase
        .rpc('generate_housekeeper_access_code_with_name', {
          p_hotel_id: selectedRequest.hotel_id,
          p_housekeeper_name: selectedRequest.housekeeper_profile?.name || 'Invité'
        });

      if (codeError) throw codeError;

      // Create access code entry
      const { error: insertError } = await supabase
        .from('housekeeper_access_codes')
        .insert({
          hotel_id: selectedRequest.hotel_id,
          access_code: accessCode,
          invited_name: selectedRequest.housekeeper_profile?.name,
          invited_email: selectedRequest.housekeeper_profile?.email,
          created_by: user.id,
          is_active: true
        });

      if (insertError) throw insertError;

      // Update request status
      const { error: updateError } = await supabase
        .from('housekeeper_access_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // Log action using the secure RPC
      await supabase
        .rpc('log_housekeeper_action', {
          p_hotel_id: selectedRequest.hotel_id,
          p_type: 'access_approved',
          p_housekeeper_name: selectedRequest.housekeeper_profile?.name,
          p_description: `Accès approuvé pour ${selectedRequest.housekeeper_profile?.name}. Code: ${accessCode}`
        });

      toast({
        title: "✅ Demande approuvée",
        description: `Code d'accès créé: ${accessCode}`,
        duration: 8000,
      });

      setIsDialogOpen(false);
      setSelectedRequest(null);
      loadPendingRequests();
      
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'approuver la demande"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const rejectRequest = async () => {
    if (!selectedRequest || !user) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('housekeeper_access_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast({
        title: "❌ Demande refusée",
        description: "La demande d'accès a été refusée"
      });

      setIsDialogOpen(false);
      setSelectedRequest(null);
      loadPendingRequests();
      
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de refuser la demande"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const showNextRequest = () => {
    const currentIndex = pendingRequests.findIndex(r => r.id === selectedRequest?.id);
    if (currentIndex < pendingRequests.length - 1) {
      setSelectedRequest(pendingRequests[currentIndex + 1]);
    } else {
      setIsDialogOpen(false);
      setSelectedRequest(null);
    }
  };

  if (!selectedRequest) return null;

  const housekeeper = selectedRequest.housekeeper_profile;

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Demande d'accès en attente
          </DialogTitle>
        </DialogHeader>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{housekeeper?.name}</h3>
                  <p className="text-sm text-muted-foreground">{housekeeper?.email}</p>
                  {housekeeper?.phone && (
                    <p className="text-sm text-muted-foreground">{housekeeper.phone}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Hotel className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Code hôtel: <strong>{selectedRequest.hotel_code}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Demandé le: {new Date(selectedRequest.requested_at).toLocaleString()}</span>
                </div>
              </div>

              {housekeeper && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="text-center">
                    <div className="font-semibold text-lg">{housekeeper.total_rooms_cleaned}</div>
                    <div className="text-xs text-muted-foreground">Chambres nettoyées</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg">{housekeeper.total_hotels_worked}</div>
                    <div className="text-xs text-muted-foreground">Hôtels travaillés</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Cette femme de chambre demande l'accès à votre hôtel. Souhaitez-vous approuver cette demande ?
          </p>
          
          {pendingRequests.length > 1 && (
            <Badge variant="secondary" className="text-xs">
              {pendingRequests.findIndex(r => r.id === selectedRequest.id) + 1} sur {pendingRequests.length} demandes
            </Badge>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={rejectRequest}
            disabled={isProcessing}
          >
            <X className="h-4 w-4 mr-2" />
            Refuser
          </Button>
          
          <Button
            onClick={approveRequest}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approuver
          </Button>
        </DialogFooter>

        {pendingRequests.length > 1 && (
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={showNextRequest}>
              Demande suivante
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};