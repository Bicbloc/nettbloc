import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Clock, MessageSquare, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface IncidentListProps {
  hotelId: string;
}

export function IncidentList({ hotelId }: IncidentListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["incidents", hotelId, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("incidents")
        .select(`
          *,
          incident_types(name, color, severity),
          incident_categories(name, icon),
          incident_items(name),
          staff_roles(name),
          incident_comments(
            id,
            comment,
            user_name,
            user_type,
            created_at
          ),
          incident_images(
            id,
            image_url,
            uploaded_at
          )
        `)
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ incidentId, status }: { incidentId: string; status: string }) => {
      const { error } = await supabase
        .from("incidents")
        .update({ 
          status,
          resolved_at: status === "resolved" ? new Date().toISOString() : null,
          resolved_by: status === "resolved" ? (await supabase.auth.getUser()).data.user?.id : null
        })
        .eq("id", incidentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      toast({ title: "Statut mis à jour" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ incidentId, comment }: { incidentId: string; comment: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("incident_comments")
        .insert({
          incident_id: incidentId,
          comment,
          user_id: user?.id || "",
          user_name: user?.email || "Anonyme",
          user_type: "admin"
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      setComment("");
      toast({ title: "Commentaire ajouté" });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "new": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "in_progress": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "resolved": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "new": return "Nouveau";
      case "in_progress": return "En cours";
      case "resolved": return "Résolu";
      default: return status;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Incidents</h2>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="new">Nouveau</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="resolved">Résolu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {incidents?.map((incident) => (
          <Card key={incident.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(incident.status)}
                    <CardTitle className="text-lg">{incident.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{getStatusLabel(incident.status)}</Badge>
                    {incident.incident_types && (
                      <Badge style={{ backgroundColor: incident.incident_types.color }}>
                        {incident.incident_types.name}
                      </Badge>
                    )}
                    {incident.priority && (
                      <Badge variant={incident.priority === "high" ? "destructive" : "outline"}>
                        {incident.priority === "high" ? "Urgent" : incident.priority === "medium" ? "Moyen" : "Faible"}
                      </Badge>
                    )}
                  </div>
                </div>
                <Select
                  value={incident.status}
                  onValueChange={(status) => updateStatusMutation.mutate({ incidentId: incident.id, status })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nouveau</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="resolved">Résolu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {incident.description && (
                <p className="text-sm text-muted-foreground">{incident.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Catégorie:</span>{" "}
                  {incident.incident_categories?.name || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Article:</span>{" "}
                  {incident.incident_items?.name || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Lieu:</span>{" "}
                  {incident.location_type === "room" ? `Chambre ${incident.location_reference}` : incident.location_reference}
                </div>
                <div>
                  <span className="font-semibold">Assigné à:</span>{" "}
                  {incident.staff_roles?.name || incident.assigned_to_other || "Non assigné"}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Signalé par {incident.reported_by_name} ({incident.reported_by_type}) le{" "}
                {format(new Date(incident.created_at), "PPp", { locale: fr })}
              </div>

              {incident.incident_images && incident.incident_images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {incident.incident_images.map((img: any) => (
                    <a
                      key={img.id}
                      href={img.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative w-20 h-20 rounded border overflow-hidden hover:opacity-80 transition-opacity"
                    >
                      <img src={img.image_url} alt="Incident" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {incident.incident_comments && incident.incident_comments.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Commentaires ({incident.incident_comments.length})
                  </h4>
                  {incident.incident_comments.slice(0, 2).map((comment: any) => (
                    <div key={comment.id} className="bg-muted p-2 rounded text-sm">
                      <div className="font-semibold">{comment.user_name}</div>
                      <div className="text-muted-foreground">{comment.comment}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(comment.created_at), "PPp", { locale: fr })}
                      </div>
                    </div>
                  ))}
                  {incident.incident_comments.length > 2 && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setSelectedIncident(incident.id)}
                    >
                      Voir tous les commentaires
                    </Button>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIncident(incident.id)}
                >
                  Ajouter un commentaire
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter un commentaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Votre commentaire..."
              rows={4}
            />
            <Button
              onClick={() => {
                if (selectedIncident && comment.trim()) {
                  addCommentMutation.mutate({ incidentId: selectedIncident, comment });
                  setSelectedIncident(null);
                }
              }}
              disabled={!comment.trim()}
            >
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
