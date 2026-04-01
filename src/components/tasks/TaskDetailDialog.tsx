import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  CalendarIcon, Clock, MapPin, User, Send, Pencil, Save, X,
  MessageCircle, CheckCheck, XCircle, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string | null;
  location_type: string;
  location_reference: string | null;
  assigned_to_type: string;
  assigned_to_name: string | null;
  task_date: string;
  status: string;
  priority: string;
  started_at: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
  validated_at: string | null;
  notes: string | null;
  created_at?: string;
}

interface Comment {
  id: string;
  task_id: string;
  author_name: string;
  author_type: string;
  comment: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Terminée', color: 'bg-amber-100 text-amber-700' },
  validated: { label: 'Validée', color: 'bg-green-100 text-green-700' },
};

const PRIORITIES = [
  { value: 'low', label: 'Faible' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Élevée' },
  { value: 'urgent', label: 'Urgent' },
];

interface TaskDetailDialogProps {
  task: Task | null;
  hotelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate?: (taskId: string) => void;
  onReject?: (taskId: string) => void;
}

export function TaskDetailDialog({ 
  task, hotelId, open, onOpenChange, onValidate, onReject 
}: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', priority: 'normal' });
  const [newComment, setNewComment] = useState('');
  const [newDate, setNewDate] = useState<Date | undefined>();

  // Load comments
  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ["task-comments", task?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", task!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Comment[];
    },
    enabled: !!task?.id && open,
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("manual_tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", task!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-tasks", hotelId] });
      toast({ title: "Ticket mis à jour" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur de mise à jour" });
    },
  });

  // Add comment mutation
  const addComment = useMutation({
    mutationFn: async (comment: string) => {
      const { error } = await supabase
        .from("task_comments")
        .insert({
          task_id: task!.id,
          hotel_id: hotelId,
          author_name: "Admin",
          author_type: "admin",
          comment,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", task?.id] });
      setNewComment('');
      toast({ title: "Commentaire ajouté" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur" });
    },
  });

  // Extend date mutation
  const extendDate = useMutation({
    mutationFn: async (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      const { error } = await supabase
        .from("manual_tasks")
        .update({ task_date: dateStr, updated_at: new Date().toISOString() })
        .eq("id", task!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-tasks", hotelId] });
      setNewDate(undefined);
      toast({ title: "Date prolongée" });
    },
  });

  if (!task) return null;

  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;

  const startEditing = () => {
    setEditData({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'normal',
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    updateTask.mutate({
      title: editData.title,
      description: editData.description || null,
      priority: editData.priority,
    });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate(newComment.trim());
  };

  const handleExtendDate = () => {
    if (!newDate) return;
    extendDate.mutate(newDate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📋 Détails du ticket
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {/* Title & Description */}
            {isEditing ? (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-xs">Titre</Label>
                  <Input 
                    value={editData.title} 
                    onChange={(e) => setEditData({...editData, title: e.target.value})} 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea 
                    value={editData.description} 
                    onChange={(e) => setEditData({...editData, description: e.target.value})} 
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Priorité</Label>
                  <Select value={editData.priority} onValueChange={(v) => setEditData({...editData, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={updateTask.isPending}>
                    <Save className="h-3 w-3 mr-1" /> Sauvegarder
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="h-3 w-3 mr-1" /> Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg">{task.title}</h3>
                  <Button size="sm" variant="ghost" onClick={startEditing}>
                    <Pencil className="h-3 w-3 mr-1" /> Modifier
                  </Button>
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                )}
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {task.location_reference && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{task.location_reference}</span>
                </div>
              )}
              {task.assigned_to_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 shrink-0" />
                  <span>{task.assigned_to_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4 shrink-0" />
                <span>{task.task_date}</span>
              </div>
              {task.started_at && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Débuté {format(new Date(task.started_at), 'HH:mm', { locale: fr })}</span>
                </div>
              )}
              {task.completed_at && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCheck className="h-4 w-4 shrink-0" />
                  <span>Terminé {format(new Date(task.completed_at), 'HH:mm', { locale: fr })} par {task.completed_by_name}</span>
                </div>
              )}
            </div>

            {/* Extend date */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prolonger la validité</Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("justify-start", !newDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {newDate ? format(newDate, 'dd/MM/yyyy') : 'Nouvelle date…'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newDate}
                      onSelect={setNewDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {newDate && (
                  <Button size="sm" onClick={handleExtendDate} disabled={extendDate.isPending}>
                    {extendDate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Prolonger'}
                  </Button>
                )}
              </div>
            </div>

            {/* Validate/Reject actions */}
            {task.status === 'completed' && (onValidate || onReject) && (
              <>
                <Separator />
                <div className="flex gap-2">
                  {onValidate && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onValidate(task.id)}>
                      <CheckCheck className="h-4 w-4 mr-1" /> Valider
                    </Button>
                  )}
                  {onReject && (
                    <Button size="sm" variant="outline" className="text-orange-600 border-orange-300" onClick={() => onReject(task.id)}>
                      <XCircle className="h-4 w-4 mr-1" /> Rejeter
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Comments section */}
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Commentaires ({comments?.length || 0})
              </h4>

              {loadingComments ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : comments && comments.length > 0 ? (
                <div className="space-y-2">
                  {comments.map((c) => (
                    <div key={c.id} className={cn(
                      "p-2 rounded-lg text-sm",
                      c.author_type === 'admin' ? 'bg-primary/10 ml-4' : 'bg-muted mr-4'
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">{c.author_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{c.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Aucun commentaire</p>
              )}

              {/* Add comment */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ajouter un commentaire…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button 
                  size="icon" 
                  className="shrink-0 self-end" 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addComment.isPending}
                >
                  {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
