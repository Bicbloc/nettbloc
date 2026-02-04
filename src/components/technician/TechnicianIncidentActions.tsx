import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  Package, 
  MessageSquare,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TechnicianIncidentActionsProps {
  incidentId: string;
  currentStatus: string;
  onStatusChange: (status: string) => void;
  onAddComment: () => void;
  onUpdateDueDate: () => void;
}

const STATUS_CONFIG = {
  new: { label: 'Nouveau', icon: AlertTriangle, color: 'bg-red-500' },
  in_progress: { label: 'En cours', icon: Clock, color: 'bg-amber-500' },
  resolved: { label: 'Résolu', icon: CheckCircle, color: 'bg-green-500' },
  postponed: { label: 'Reporté', icon: Calendar, color: 'bg-purple-500' },
  parts_ordered: { label: 'Pièce commandée', icon: Package, color: 'bg-blue-500' },
};

export function TechnicianIncidentActions({
  incidentId,
  currentStatus,
  onStatusChange,
  onAddComment,
  onUpdateDueDate
}: TechnicianIncidentActionsProps) {
  const config = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
  const StatusIcon = config.icon;

  return (
    <div className="space-y-3">
      {/* Current Status Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Statut actuel:</span>
        <Badge className={cn("gap-1", config.color, "text-white")}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </Badge>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Resolved Button */}
        <Button
          variant={currentStatus === 'resolved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('resolved')}
          className={cn(
            "gap-2",
            currentStatus === 'resolved' && "bg-green-600 hover:bg-green-700"
          )}
        >
          <CheckCircle className="h-4 w-4" />
          Résolu
        </Button>

        {/* Postponed Button */}
        <Button
          variant={currentStatus === 'postponed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('postponed')}
          className={cn(
            "gap-2",
            currentStatus === 'postponed' && "bg-purple-600 hover:bg-purple-700"
          )}
        >
          <Calendar className="h-4 w-4" />
          Reporter
        </Button>

        {/* Parts Ordered Button */}
        <Button
          variant={currentStatus === 'parts_ordered' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('parts_ordered')}
          className={cn(
            "gap-2",
            currentStatus === 'parts_ordered' && "bg-blue-600 hover:bg-blue-700"
          )}
        >
          <Package className="h-4 w-4" />
          Pièce commandée
        </Button>

        {/* In Progress Button */}
        <Button
          variant={currentStatus === 'in_progress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('in_progress')}
          className={cn(
            "gap-2",
            currentStatus === 'in_progress' && "bg-amber-600 hover:bg-amber-700"
          )}
        >
          <Clock className="h-4 w-4" />
          En cours
        </Button>

        {/* Comment Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onAddComment}
          className="gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          Commenter
        </Button>

        {/* Schedule Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onUpdateDueDate}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Planifier
        </Button>
      </div>
    </div>
  );
}
