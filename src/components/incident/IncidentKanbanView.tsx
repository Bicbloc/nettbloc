import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2,
  MapPin,
  MessageSquare,
  Image as ImageIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface IncidentKanbanViewProps {
  incidents: any[];
  onIncidentClick: (incident: any) => void;
  onStatusChange: (incidentId: string, newStatus: string) => void;
}

const COLUMNS = [
  { 
    id: 'new', 
    title: 'Nouveau', 
    icon: AlertCircle, 
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  },
  { 
    id: 'in_progress', 
    title: 'En cours', 
    icon: Clock, 
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30'
  },
  { 
    id: 'resolved', 
    title: 'Résolu', 
    icon: CheckCircle2, 
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30'
  },
];

const PRIORITY_COLORS = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-500',
};

export function IncidentKanbanView({ 
  incidents, 
  onIncidentClick,
  onStatusChange 
}: IncidentKanbanViewProps) {
  const groupedIncidents = useMemo(() => {
    const groups: Record<string, any[]> = {
      new: [],
      in_progress: [],
      resolved: [],
    };

    incidents?.forEach((incident) => {
      const status = incident.status || 'new';
      if (groups[status]) {
        groups[status].push(incident);
      }
    });

    return groups;
  }, [incidents]);

  const handleDragStart = (e: React.DragEvent, incidentId: string) => {
    e.dataTransfer.setData('incidentId', incidentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const incidentId = e.dataTransfer.getData('incidentId');
    if (incidentId) {
      onStatusChange(incidentId, newStatus);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-300px)] min-h-[500px]">
      {COLUMNS.map((column) => {
        const Icon = column.icon;
        const columnIncidents = groupedIncidents[column.id] || [];

        return (
          <Card 
            key={column.id}
            className={cn("flex flex-col", column.bgColor, column.borderColor, "border-2")}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", column.color)} />
                  <span>{column.title}</span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {columnIncidents.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 p-2">
              <ScrollArea className="h-full pr-2">
                <div className="space-y-2">
                  {columnIncidents.map((incident) => (
                    <div
                      key={incident.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, incident.id)}
                      onClick={() => onIncidentClick(incident)}
                      className={cn(
                        "p-3 rounded-lg bg-card border-l-4 cursor-pointer",
                        "hover:shadow-md hover:scale-[1.02] transition-all",
                        "active:scale-[0.98]",
                        PRIORITY_COLORS[incident.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.medium
                      )}
                    >
                      <h4 className="font-medium text-sm line-clamp-2 mb-2">
                        {incident.title}
                      </h4>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3" />
                        <span>CH {incident.location_reference}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {incident.incident_categories && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {incident.incident_categories.icon}
                          </Badge>
                        )}
                        {incident.incident_types && (
                          <Badge 
                            className="text-[10px] px-1.5 py-0"
                            style={{ 
                              backgroundColor: incident.incident_types.color, 
                              color: '#fff' 
                            }}
                          >
                            {incident.incident_types.name}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(incident.created_at), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </span>
                        <div className="flex items-center gap-2">
                          {incident.incident_images?.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <ImageIcon className="h-3 w-3" />
                              {incident.incident_images.length}
                            </span>
                          )}
                          {incident.incident_comments?.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3" />
                              {incident.incident_comments.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {columnIncidents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Aucun incident
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
