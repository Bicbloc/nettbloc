import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Check, 
  X, 
  Eye, 
  AlertTriangle, 
  Clock, 
  Building2 
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PatternRequest {
  id: string;
  hotel_id: string;
  submitted_by: string;
  report_sample: string;
  detected_keywords: string[];
  expected_pms_type: string | null;
  detected_pms_type: string;
  mismatch_score: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  hotels?: { name: string };
}

export function PatternImprovementRequestsPanel() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<PatternRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ['pattern-improvement-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pattern_improvement_requests')
        .select(`
          *,
          hotels:hotel_id (name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PatternRequest[];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from('pattern_improvement_requests')
        .update({ status, admin_notes: notes })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pattern-improvement-requests'] });
      toast({
        title: "Demande mise à jour",
        description: "Le statut de la demande a été modifié."
      });
      setSelectedRequest(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour la demande."
      });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" /> En attente</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" /> Approuvée</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Rejetée</Badge>;
      case 'processing':
        return <Badge variant="outline"><AlertTriangle className="h-3 w-3 mr-1" /> En traitement</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Demandes d'amélioration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Demandes d'amélioration de pattern
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!requests || requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune demande d'amélioration
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div 
                  key={request.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{request.hotels?.name || 'Hôtel inconnu'}</p>
                        <p className="text-sm text-muted-foreground">
                          Attendu: {request.expected_pms_type || 'N/A'} → 
                          Détecté: {request.detected_pms_type}
                          <span className="ml-2">
                            ({request.mismatch_score?.toFixed(0)}% correspondance)
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(request.status)}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setAdminNotes(request.admin_notes || '');
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Voir
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Soumis le {new Date(request.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demande d'amélioration</DialogTitle>
            <DialogDescription>
              Hôtel: {selectedRequest?.hotels?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">PMS Attendu</label>
                  <p className="text-lg">{selectedRequest.expected_pms_type || 'Non défini'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">PMS Détecté</label>
                  <p className="text-lg">{selectedRequest.detected_pms_type}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Score de correspondance</label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        selectedRequest.mismatch_score >= 70 ? 'bg-green-500' :
                        selectedRequest.mismatch_score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${selectedRequest.mismatch_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{selectedRequest.mismatch_score?.toFixed(0)}%</span>
                </div>
              </div>

              {selectedRequest.detected_keywords.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Mots-clés détectés</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRequest.detected_keywords.map((keyword, i) => (
                      <Badge key={i} variant="outline">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Extrait du rapport</label>
                <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48">
                  {selectedRequest.report_sample}
                </pre>
              </div>

              <div>
                <label className="text-sm font-medium">Notes administrateur</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Ajouter des notes..."
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => updateMutation.mutate({ 
                    id: selectedRequest.id, 
                    status: 'rejected',
                    notes: adminNotes 
                  })}
                  disabled={updateMutation.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Rejeter
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateMutation.mutate({ 
                    id: selectedRequest.id, 
                    status: 'processing',
                    notes: adminNotes 
                  })}
                  disabled={updateMutation.isPending}
                >
                  <Clock className="h-4 w-4 mr-1" />
                  En traitement
                </Button>
                <Button
                  onClick={() => updateMutation.mutate({ 
                    id: selectedRequest.id, 
                    status: 'approved',
                    notes: adminNotes 
                  })}
                  disabled={updateMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approuver
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
