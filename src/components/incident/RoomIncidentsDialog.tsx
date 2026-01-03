import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Clock, MessageSquare, Send, Pencil, Trash2, X, Check } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { storageService } from "@/services/storageService";

interface RoomIncidentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  roomNumber: string;
}

export function RoomIncidentsDialog({ open, onOpenChange, hotelId, roomNumber }: RoomIncidentsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["room-incidents", hotelId, roomNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select(`
          *,
          incident_types(name, color, severity),
          incident_categories(name, icon),
          incident_items(name),
          incident_comments(
            id,
            comment,
            user_name,
            user_type,
            created_at
          ),
          incident_images(
            id,
            image_url
          )
        `)
        .eq("hotel_id", hotelId)
        .eq("location_reference", roomNumber)
        .neq("status", "resolved")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open && !!hotelId && !!roomNumber
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
      queryClient.invalidateQueries({ queryKey: ["room-incidents", hotelId, roomNumber] });
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      toast({ title: "Statut mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ incidentId, comment }: { incidentId: string; comment: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Récupérer les informations via storageService
      const housekeeperSession = storageService.getHousekeeperSession();
      
      // Déterminer le user_id, user_name et user_type
      let userId: string;
      let userName: string;
      let userType: string;
      
      if (user?.id) {
        // Utilisateur authentifié (admin)
        userId = user.id;
        userName = user.email || "Admin";
        userType = "admin";
      } else if (housekeeperSession?.id) {
        // Femme de chambre (non authentifiée via Supabase Auth)
        userId = housekeeperSession.id;
        userName = housekeeperSession.name || "Femme de chambre";
        userType = "housekeeper";
      } else {
        // Fallback
        userId = crypto.randomUUID();
        userName = "Anonyme";
        userType = "guest";
      }
      
      const { error } = await supabase
        .from("incident_comments")
        .insert({
          incident_id: incidentId,
          comment,
          user_id: userId,
          user_name: userName,
          user_type: userType
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-incidents", hotelId, roomNumber] });
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      setNewComment("");
      setSelectedIncidentId(null);
      toast({ title: "Commentaire ajouté" });
    },
    onError: (error) => {
      console.error("Error adding comment:", error);
      toast({ title: "Erreur lors de l'ajout du commentaire", variant: "destructive" });
    }
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, comment }: { commentId: string; comment: string }) => {
      const { error } = await supabase
        .from("incident_comments")
        .update({ comment })
        .eq("id", commentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-incidents", hotelId, roomNumber] });
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      setEditingCommentId(null);
      setEditingCommentText("");
      toast({ title: "Commentaire modifié" });
    },
    onError: (error) => {
      console.error("Error updating comment:", error);
      toast({ title: "Erreur lors de la modification", variant: "destructive" });
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("incident_comments")
        .delete()
        .eq("id", commentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-incidents", hotelId, roomNumber] });
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      toast({ title: "Commentaire supprimé" });
    },
    onError: (error) => {
      console.error("Error deleting comment:", error);
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "new": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "in_progress": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "resolved": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      low: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };
    const labels: Record<string, string> = {
      low: "Faible",
      medium: "Moyen",
      high: "Élevé",
      urgent: "Urgent"
    };
    return (
      <Badge variant="outline" className={variants[priority] || ""}>
        {labels[priority] || priority}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Incidents - Chambre {roomNumber}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : incidents && incidents.length > 0 ? (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <div key={incident.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    {getStatusIcon(incident.status)}
                    <span className="font-semibold">{incident.title}</span>
                    {incident.priority && getPriorityBadge(incident.priority)}
                  </div>
                  <Select
                    value={incident.status}
                    onValueChange={(status) => updateStatusMutation.mutate({ incidentId: incident.id, status })}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">📌 Nouveau</SelectItem>
                      <SelectItem value="in_progress">⏳ En cours</SelectItem>
                      <SelectItem value="resolved">✅ Résolu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  {incident.incident_categories && (
                    <Badge variant="outline">
                      {(incident.incident_categories as any).icon} {(incident.incident_categories as any).name}
                    </Badge>
                  )}
                  {incident.incident_items && (
                    <Badge variant="secondary">
                      {(incident.incident_items as any).name}
                    </Badge>
                  )}
                  {incident.incident_types && (
                    <Badge style={{ backgroundColor: (incident.incident_types as any).color, color: '#fff' }}>
                      {(incident.incident_types as any).name}
                    </Badge>
                  )}
                </div>

                {incident.description && (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                    {incident.description}
                  </p>
                )}

                {/* Images */}
                {incident.incident_images && (incident.incident_images as any[]).length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {(incident.incident_images as any[]).map((img) => (
                      <a
                        key={img.id}
                        href={img.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 h-16 rounded border overflow-hidden hover:opacity-80"
                      >
                        <img src={img.image_url} alt="Incident" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Commentaires */}
                {incident.incident_comments && (incident.incident_comments as any[]).length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <span className="text-xs font-semibold flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Commentaires ({(incident.incident_comments as any[]).length})
                    </span>
                    {(incident.incident_comments as any[]).map((c) => (
                      <div key={c.id} className="bg-muted p-2 rounded text-xs group">
                        {editingCommentId === c.id ? (
                          <div className="flex gap-2">
                            <Textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              rows={2}
                              className="flex-1 text-xs"
                            />
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  if (editingCommentText.trim()) {
                                    updateCommentMutation.mutate({ commentId: c.id, comment: editingCommentText });
                                  }
                                }}
                                disabled={!editingCommentText.trim() || updateCommentMutation.isPending}
                              >
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentText("");
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-semibold">{c.user_name}:</span> {c.comment}
                              <span className="text-muted-foreground ml-2">
                                {format(new Date(c.created_at), "dd/MM HH:mm", { locale: fr })}
                              </span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0"
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setEditingCommentText(c.comment);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                onClick={() => deleteCommentMutation.mutate(c.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Ajouter commentaire */}
                {selectedIncidentId === incident.id ? (
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Votre commentaire..."
                      rows={2}
                      className="flex-1"
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (newComment.trim()) {
                            addCommentMutation.mutate({ incidentId: incident.id, comment: newComment });
                          }
                        }}
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedIncidentId(null);
                          setNewComment("");
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setSelectedIncidentId(incident.id)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Ajouter un commentaire
                  </Button>
                )}

                <div className="text-xs text-muted-foreground">
                  Signalé le {format(new Date(incident.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucun incident en cours pour cette chambre
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Wrench(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}