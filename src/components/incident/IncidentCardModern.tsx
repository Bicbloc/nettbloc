import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  MapPin,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  Check,
  Send
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { IncidentTimeline } from "./IncidentTimeline";
import { Textarea } from "@/components/ui/textarea";

interface IncidentCardModernProps {
  incident: any;
  staffMembers?: any[];
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
  onAssign: (staffId: string) => void;
  onAddComment: () => void;
  onEditComment?: (commentId: string, newText: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onEdit?: () => void;
}

const PRIORITY_CONFIG = {
  urgent: { 
    color: "border-l-red-500 bg-red-500/5", 
    badge: "bg-red-500 text-white animate-pulse",
    icon: Zap,
    label: "Urgent"
  },
  high: { 
    color: "border-l-orange-500 bg-orange-500/5", 
    badge: "bg-orange-500 text-white",
    icon: AlertTriangle,
    label: "Élevé"
  },
  medium: { 
    color: "border-l-yellow-500 bg-yellow-500/5", 
    badge: "bg-yellow-500 text-white",
    icon: AlertCircle,
    label: "Moyen"
  },
  low: { 
    color: "border-l-blue-500 bg-blue-500/5", 
    badge: "bg-blue-500 text-white",
    icon: Clock,
    label: "Faible"
  },
};

const STATUS_CONFIG = {
  new: { 
    icon: AlertCircle, 
    color: "text-red-500", 
    bg: "bg-red-100 dark:bg-red-900/30",
    label: "Nouveau" 
  },
  in_progress: { 
    icon: Clock, 
    color: "text-yellow-500", 
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    label: "En cours" 
  },
  pending_validation: {
    icon: Clock,
    color: "text-purple-500",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    label: "À valider"
  },
  resolved: { 
    icon: CheckCircle2, 
    color: "text-green-500", 
    bg: "bg-green-100 dark:bg-green-900/30",
    label: "Résolu" 
  },
};

export function IncidentCardModern({
  incident,
  staffMembers,
  onStatusChange,
  onPriorityChange,
  onAssign,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onEdit,
}: IncidentCardModernProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [inlineComment, setInlineComment] = useState("");
  
  const priority = incident.priority || "medium";
  const status = incident.status || "new";
  const priorityConfig = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
  const StatusIcon = statusConfig.icon;
  const PriorityIcon = priorityConfig.icon;

  // Calculate time elapsed
  const timeAgo = formatDistanceToNow(new Date(incident.created_at), { 
    addSuffix: true, 
    locale: fr 
  });

  // Get reporter initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get reporter type badge
  const getReporterTypeBadge = (type: string) => {
    switch (type) {
      case 'admin':
        return { label: 'Admin', className: 'bg-purple-500 text-white' };
      case 'housekeeper':
        return { label: 'Femme de chambre', className: 'bg-blue-500 text-white' };
      case 'technician':
        return { label: 'Technicien', className: 'bg-orange-500 text-white' };
      case 'governess':
        return { label: 'Gouvernante', className: 'bg-pink-500 text-white' };
      default:
        return { label: type, className: 'bg-gray-500 text-white' };
    }
  };

  const reporterBadge = getReporterTypeBadge(incident.reported_by_type);

  return (
    <Card className={cn(
      "border-l-4 transition-all duration-300 hover:shadow-xl",
      "backdrop-blur-sm bg-card/80",
      priorityConfig.color,
      isExpanded && "ring-2 ring-primary/20"
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {/* Status + Title */}
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", statusConfig.bg)}>
                <StatusIcon className={cn("h-5 w-5", statusConfig.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg leading-tight">{incident.title}</h3>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={onEdit}
                      title="Modifier l'incident"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  <span>Chambre {incident.location_reference}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <Calendar className="h-3 w-3" />
                  <span>{timeAgo}</span>
                </div>
              </div>
            </div>

            {/* Tags Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {incident.incident_categories && (
                <Badge variant="outline" className="text-xs">
                  {incident.incident_categories.icon} {incident.incident_categories.name}
                </Badge>
              )}
              {incident.incident_items && (
                <Badge variant="secondary" className="text-xs">
                  {incident.incident_items.name}
                </Badge>
              )}
              {incident.incident_types && (
                <Badge 
                  className="text-xs"
                  style={{ backgroundColor: incident.incident_types.color, color: '#fff' }}
                >
                  {incident.incident_types.name}
                </Badge>
              )}
              <Badge className={cn("text-xs", priorityConfig.badge)}>
                <PriorityIcon className="h-3 w-3 mr-1" />
                {priorityConfig.label}
              </Badge>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2">
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">📌 Nouveau</SelectItem>
                <SelectItem value="in_progress">⏳ En cours</SelectItem>
                <SelectItem value="pending_validation">🕓 À valider</SelectItem>
                <SelectItem value="resolved">✅ Validé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={onPriorityChange}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🔵 Faible</SelectItem>
                <SelectItem value="medium">🟡 Moyen</SelectItem>
                <SelectItem value="high">🟠 Élevé</SelectItem>
                <SelectItem value="urgent">🔴 Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reporter Info */}
        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getInitials(incident.reported_by_name || 'U')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{incident.reported_by_name}</span>
                <Badge className={cn("text-[10px] px-1.5 py-0", reporterBadge.className)}>
                  {reporterBadge.label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Signalé le {format(new Date(incident.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
              </div>
            </div>
          </div>

          {/* Assignment */}
          <Select
            value={incident.assigned_to_user_id || "unassigned"}
            onValueChange={(val) => val !== "unassigned" && onAssign(val)}
          >
            <SelectTrigger className="w-[180px]">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Assigner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">❌ Non assigné</SelectItem>
              {staffMembers?.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  👤 {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description Preview */}
        {incident.description && (
          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg line-clamp-2">
            {incident.description}
          </p>
        )}

        {/* Images Preview */}
        {incident.incident_images && incident.incident_images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {incident.incident_images.map((img: any) => (
              <a
                key={img.id}
                href={img.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative w-20 h-20 rounded-lg border-2 border-border overflow-hidden 
                           hover:border-primary hover:scale-105 transition-all flex-shrink-0"
              >
                <img 
                  src={img.image_url} 
                  alt="Incident" 
                  className="w-full h-full object-cover" 
                />
              </a>
            ))}
          </div>
        )}

        {/* Validation banner */}
        {status === 'pending_validation' && (
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="text-sm">
              <p className="font-semibold text-purple-700 dark:text-purple-300">
                🕓 En attente de validation
              </p>
              <p className="text-xs text-muted-foreground">
                Le personnel a marqué cet incident comme traité. Validez pour clôturer.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={() => onStatusChange('resolved')}
            >
              <CheckCircle2 className="h-4 w-4" />
              Valider
            </Button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Réduire
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Voir plus
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {incident.incident_comments && incident.incident_comments.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <MessageSquare className="h-3 w-3" />
                {incident.incident_comments.length}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onAddComment} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Commenter
            </Button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="pt-4 space-y-4 animate-fade-in">
            {/* Timeline */}
            <IncidentTimeline incident={incident} />

            {/* Comments */}
            {incident.incident_comments && incident.incident_comments.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Commentaires
                </h4>
                
                {/* Liste des commentaires */}
                {incident.incident_comments && incident.incident_comments.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {incident.incident_comments.map((comment: any) => (
                      <div key={comment.id} className="bg-muted/50 p-3 rounded-lg text-sm group">
                        {editingCommentId === comment.id ? (
                          <div className="flex gap-2">
                            <Textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              rows={2}
                              className="flex-1 text-sm"
                            />
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  if (editingCommentText.trim() && onEditComment) {
                                    onEditComment(comment.id, editingCommentText);
                                    setEditingCommentId(null);
                                    setEditingCommentText("");
                                  }
                                }}
                                disabled={!editingCommentText.trim()}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentText("");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px]">
                                    {getInitials(comment.user_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-semibold">{comment.user_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(comment.created_at), { 
                                    addSuffix: true, 
                                    locale: fr 
                                  })}
                                </span>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setEditingCommentId(comment.id);
                                    setEditingCommentText(comment.comment);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => onDeleteComment && onDeleteComment(comment.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-muted-foreground pl-8">{comment.comment}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulaire d'ajout de commentaire inline */}
                <div className="flex gap-2 mt-2">
                  <Textarea
                    value={inlineComment}
                    onChange={(e) => setInlineComment(e.target.value)}
                    placeholder="Ajouter un commentaire..."
                    rows={2}
                    className="flex-1 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (inlineComment.trim()) {
                        onAddComment();
                        setInlineComment("");
                      }
                    }}
                    disabled={!inlineComment.trim()}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
