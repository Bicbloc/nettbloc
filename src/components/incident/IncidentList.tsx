import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, List, X, Camera, Filter } from "lucide-react";
import { IncidentCardModern } from "./IncidentCardModern";
import { IncidentKanbanView } from "./IncidentKanbanView";

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
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

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

  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, comment }: { commentId: string; comment: string }) => {
      const { error } = await supabase
        .from("incident_comments")
        .update({ comment })
        .eq("id", commentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      toast({ title: "Commentaire modifié" });
    },
    onError: () => {
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
      queryClient.invalidateQueries({ queryKey: ["incidents", hotelId] });
      toast({ title: "Commentaire supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters and view toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Incidents</h2>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "kanban")}>
            <TabsList className="h-9">
              <TabsTrigger value="list" className="gap-1.5 px-3">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Liste</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5 px-3">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="new">📌 Nouveau</SelectItem>
                <SelectItem value="in_progress">⏳ En cours</SelectItem>
                <SelectItem value="resolved">✅ Résolu</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                <SelectItem value="low">🔵 Faible</SelectItem>
                <SelectItem value="medium">🟡 Moyen</SelectItem>
                <SelectItem value="high">🟠 Élevé</SelectItem>
                <SelectItem value="urgent">🔴 Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "kanban" ? (
        <IncidentKanbanView
          incidents={incidents || []}
          onIncidentClick={(incident) => setSelectedIncident(incident.id)}
          onStatusChange={(incidentId, status) => 
            updateStatusMutation.mutate({ incidentId, status })
          }
        />
      ) : (
        <div className="grid gap-4">
          {incidents?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun incident trouvé
            </div>
          ) : (
            incidents?.map((incident) => (
              <IncidentCardModern
                key={incident.id}
                incident={incident}
                staffMembers={staffMembers}
                onStatusChange={(status) => 
                  updateStatusMutation.mutate({ incidentId: incident.id, status })
                }
                onPriorityChange={(priority) =>
                  updatePriorityMutation.mutate({ incidentId: incident.id, priority })
                }
                onAssign={(staffId) =>
                  assignStaffMutation.mutate({ incidentId: incident.id, staffId })
                }
                onAddComment={() => setSelectedIncident(incident.id)}
                onEditComment={(commentId, newText) =>
                  updateCommentMutation.mutate({ commentId, comment: newText })
                }
                onDeleteComment={(commentId) =>
                  deleteCommentMutation.mutate(commentId)
                }
              />
            ))
          )}
        </div>
      )}

      {/* Comment Dialog */}
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
                <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed rounded cursor-pointer hover:bg-accent transition-colors">
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
              className="w-full"
            >
              {addCommentMutation.isPending ? "Envoi..." : "Ajouter le commentaire"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
