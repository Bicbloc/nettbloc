import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  MessageSquare,
  Camera,
  Edit
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface IncidentTimelineProps {
  incident: any;
}

interface TimelineEvent {
  id: string;
  type: 'created' | 'status_change' | 'assigned' | 'comment' | 'image' | 'updated';
  timestamp: string;
  actor?: string;
  details?: string;
  icon: any;
  color: string;
}

export function IncidentTimeline({ incident }: IncidentTimelineProps) {
  // Build timeline events
  const events: TimelineEvent[] = [];

  // Creation event
  events.push({
    id: 'created',
    type: 'created',
    timestamp: incident.created_at,
    actor: incident.reported_by_name,
    details: `Incident créé: ${incident.title}`,
    icon: AlertCircle,
    color: 'text-red-500',
  });

  // Add comments as events
  if (incident.incident_comments) {
    incident.incident_comments.forEach((comment: any) => {
      events.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        timestamp: comment.created_at,
        actor: comment.user_name,
        details: comment.comment,
        icon: MessageSquare,
        color: 'text-blue-500',
      });
    });
  }

  // Add images as events
  if (incident.incident_images) {
    incident.incident_images.forEach((img: any) => {
      events.push({
        id: `image-${img.id}`,
        type: 'image',
        timestamp: img.uploaded_at,
        details: 'Photo ajoutée',
        icon: Camera,
        color: 'text-purple-500',
      });
    });
  }

  // Resolution event
  if (incident.resolved_at) {
    events.push({
      id: 'resolved',
      type: 'status_change',
      timestamp: incident.resolved_at,
      details: 'Incident résolu',
      icon: CheckCircle2,
      color: 'text-green-500',
    });
  }

  // Sort by timestamp
  events.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Historique
      </h4>
      
      <div className="relative pl-6 space-y-4">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

        {events.map((event, index) => {
          const Icon = event.icon;
          const isLast = index === events.length - 1;
          
          return (
            <div key={event.id} className="relative flex gap-3">
              {/* Icon */}
              <div className={cn(
                "absolute -left-6 p-1 rounded-full bg-background border-2 border-border",
                isLast && "border-primary"
              )}>
                <Icon className={cn("h-3 w-3", event.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {event.actor || 'Système'}
                  </span>
                  <span>•</span>
                  <span title={format(new Date(event.timestamp), "dd/MM/yyyy HH:mm", { locale: fr })}>
                    {formatDistanceToNow(new Date(event.timestamp), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                  {event.details}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
