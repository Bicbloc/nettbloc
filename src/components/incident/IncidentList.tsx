import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Clock, MessageSquare, Image as ImageIcon, X, Camera } from "lucide-react";
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
  const [commentImages, setCommentImages] = useState<File[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["incidents", hotelId, filterStatus, filterPriority],
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

      if (filterPriority !== "all") {
        query = query.eq("priority", filterPriority);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Récupérer les membres du personnel spécifiques de cet hôtel
  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housekeepers")
        .select("id, name, staff_roles(name)")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");
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

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ incidentId, priority }: { incidentId: string; priority: string }) => {
      const { error } = await supabase
        .from("incidents")
        .update({ priority })
        .eq("id", incidentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      toast({ title: "Priorité mise à jour" });
    },
  });

  const assignStaffMutation = useMutation({
    mutationFn: async ({ incidentId, staffId }: { incidentId: string; staffId: string }) => {
      const { error } = await supabase
        .from("incidents")
        .update({ assigned_to_user_id: staffId })
        .eq("id", incidentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      toast({ title: "Personnel assigné" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ incidentId, comment, images }: { incidentId: string; comment: string; images: File[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insérer le commentaire
      const { data: commentData, error: commentError } = await supabase
        .from("incident_comments")
        .insert({
          incident_id: incidentId,
          comment,
          user_id: user?.id || "",
          user_name: user?.email || "Anonyme",
          user_type: "admin"
        })
        .select()
        .single();
      
      if (commentError) throw commentError;

      // Uploader les images si présentes
      if (images.length > 0) {
        for (const image of images) {
          const fileExt = image.name.split(".").pop();
          const fileName = `${incidentId}/comment-${commentData.id}-${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("incident-images")
            .upload(fileName, image);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("incident-images")
            .getPublicUrl(fileName);

          await supabase.from("incident_images").insert({
            incident_id: incidentId,
            image_url: publicUrl,
            uploaded_by: user?.id || "",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      setComment("");
      setCommentImages([]);
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
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Incidents</h2>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="new">Nouveau</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="resolved">Résolu</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les priorités</SelectItem>
              <SelectItem value="low">Faible</SelectItem>
              <SelectItem value="medium">Moyen</SelectItem>
              <SelectItem value="high">Élevé</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4">
        {incidents?.map((incident) => (
          <Card key={incident.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(incident.status)}
                    <CardTitle className="text-lg">{incident.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {incident.incident_categories && (
                      <Badge variant="outline">
                        {incident.incident_categories.icon} {incident.incident_categories.name}
                      </Badge>
                    )}
                    {incident.incident_items && (
                      <Badge variant="secondary">
                        {incident.incident_items.name}
                      </Badge>
                    )}
                    {incident.incident_types && (
                      <Badge style={{ backgroundColor: incident.incident_types.color, color: '#fff' }}>
                        {incident.incident_types.name}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    📍 Chambre {incident.location_reference}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Select
                    value={incident.status}
                    onValueChange={(status) => updateStatusMutation.mutate({ incidentId: incident.id, status })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">📌 Nouveau</SelectItem>
                      <SelectItem value="in_progress">⏳ En cours</SelectItem>
                      <SelectItem value="resolved">✅ Résolu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {incident.description && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                  {incident.description}
                </p>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Assigné à:</span>
                <Select
                  value={incident.assigned_to_user_id || "unassigned"}
                  onValueChange={(staffId) => {
                    if (staffId === "unassigned") return;
                    assignStaffMutation.mutate({ incidentId: incident.id, staffId });
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Non assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">❌ Non assigné</SelectItem>
                    {staffMembers?.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        👤 {member.name} {member.staff_roles ? `(${(member.staff_roles as any).name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground border-t pt-2">
                Signalé par {incident.reported_by_name} le{" "}
                {format(new Date(incident.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
              </div>

              {incident.incident_images && incident.incident_images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {incident.incident_images.map((img: any) => (
                    <a
                      key={img.id}
                      href={img.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative w-24 h-24 rounded border overflow-hidden hover:opacity-80 transition-opacity"
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
                  {incident.incident_comments.slice(-3).map((comment: any) => (
                    <div key={comment.id} className="bg-muted p-3 rounded text-sm">
                      <div className="font-semibold">{comment.user_name}</div>
                      <div className="text-muted-foreground mt-1">{comment.comment}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(comment.created_at), "dd/MM à HH:mm", { locale: fr })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIncident(incident.id)}
                className="w-full"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Ajouter un commentaire
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedIncident} onOpenChange={() => {
        setSelectedIncident(null);
        setComment("");
        setCommentImages([]);
      }}>
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
            
            {/* Image upload section */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Photos (optionnel)</label>
              <div className="flex flex-wrap gap-2">
                {commentImages.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Preview ${index}`}
                      className="w-20 h-20 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => setCommentImages(prev => prev.filter((_, i) => i !== index))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed rounded cursor-pointer hover:bg-accent">
                  <div className="text-center">
                    <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Ajouter</span>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        setCommentImages(prev => [...prev, ...Array.from(e.target.files || [])]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <Button
              onClick={() => {
                if (selectedIncident && comment.trim()) {
                  addCommentMutation.mutate({ 
                    incidentId: selectedIncident, 
                    comment,
                    images: commentImages 
                  });
                  setSelectedIncident(null);
                }
              }}
              disabled={!comment.trim() || addCommentMutation.isPending}
            >
              {addCommentMutation.isPending ? "Envoi..." : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
