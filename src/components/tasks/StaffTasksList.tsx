import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle, Clock, MapPin, AlertTriangle, 
  ChevronDown, ChevronUp, Loader2, ClipboardList,
  Repeat, Calendar as CalendarIcon
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StaffTasksListProps {
  hotelId: string;
  staffType: 'housekeeper' | 'governess' | 'technician';
  staffId?: string;
  staffName?: string;
  showCompletedDefault?: boolean;
}

interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  location_type: string;
  location_reference: string | null;
  priority: string;
  is_one_time: boolean;
  one_time_date: string | null;
  days_of_week: number[];
  assigned_to_all: boolean;
  assigned_to_user_id: string | null;
  assigned_user_name: string | null;
}

interface TaskCompletion {
  id: string;
  task_template_id: string;
  completed_by_id: string;
  completed_by_name: string;
  completed_at: string;
  completion_date: string;
}

const LOCATION_TYPES: Record<string, { label: string; icon: string }> = {
  room: { label: 'Chambre', icon: '🛏️' },
  corridor: { label: 'Couloir', icon: '🚪' },
  lobby: { label: 'Lobby', icon: '🏨' },
  restaurant: { label: 'Restaurant', icon: '🍽️' },
  spa: { label: 'Spa/Piscine', icon: '🏊' },
  technical: { label: 'Local technique', icon: '🔧' },
  other: { label: 'Autre', icon: '📍' },
};

const PRIORITIES: Record<string, { label: string; color: string }> = {
  low: { label: 'Faible', color: 'bg-gray-100 text-gray-700' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'Élevée', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

export function StaffTasksList({ 
  hotelId, 
  staffType, 
  staffId, 
  staffName,
  showCompletedDefault = false
}: StaffTasksListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCompleted, setShowCompleted] = useState(showCompletedDefault);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const currentDayOfWeek = new Date().getDay();

  // Fetch tasks assigned to this staff member or all staff of this type
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["staff-tasks", hotelId, staffType, staffId, today],
    queryFn: async () => {
      let query = supabase
        .from("task_templates")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .eq("assigned_to_type", staffType);

      const { data, error } = await query;
      if (error) throw error;

      // Filter tasks based on:
      // 1. Assigned to all of this type OR assigned specifically to this user
      // 2. For recurring: check if today's day is in days_of_week
      // 3. For one-time: check if one_time_date is today
      const filteredTasks = (data || []).filter((task: TaskTemplate) => {
        // Check assignment
        const isForMe = task.assigned_to_all || task.assigned_to_user_id === staffId;
        if (!isForMe) return false;

        // Check date/day
        if (task.is_one_time) {
          return task.one_time_date === today;
        } else {
          return task.days_of_week?.includes(currentDayOfWeek);
        }
      });

      return filteredTasks as TaskTemplate[];
    },
    enabled: !!hotelId,
  });

  // Fetch today's completions
  const { data: completions } = useQuery({
    queryKey: ["task-completions", hotelId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("completion_date", today);

      if (error) {
        // Table might not exist yet, return empty array
        console.log("Task completions query error:", error);
        return [];
      }
      return data as TaskCompletion[];
    },
    enabled: !!hotelId,
  });

  // Complete task mutation
  const completeMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      if (completed) {
        const { error } = await supabase
          .from("task_completions")
          .insert({
            hotel_id: hotelId,
            task_template_id: taskId,
            completed_by_id: staffId || 'unknown',
            completed_by_name: staffName || 'Staff',
            completion_date: today,
          });
        if (error) throw error;
      } else {
        // Remove completion
        const { error } = await supabase
          .from("task_completions")
          .delete()
          .eq("task_template_id", taskId)
          .eq("completion_date", today)
          .eq("completed_by_id", staffId || 'unknown');
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-completions", hotelId, today] });
      toast({ title: "Tâche mise à jour" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur lors de la mise à jour" });
    },
  });

  const isTaskCompleted = (taskId: string) => {
    return completions?.some(c => c.task_template_id === taskId);
  };

  const handleToggleComplete = (taskId: string) => {
    const isCompleted = isTaskCompleted(taskId);
    completeMutation.mutate({ taskId, completed: !isCompleted });
  };

  // Filter tasks based on showCompleted
  const visibleTasks = tasks?.filter(task => {
    const completed = isTaskCompleted(task.id);
    return showCompleted ? true : !completed;
  }) || [];

  const completedCount = tasks?.filter(task => isTaskCompleted(task.id)).length || 0;
  const totalCount = tasks?.length || 0;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (!tasks || tasks.length === 0) {
    return null; // Don't show anything if no tasks
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Tâches du jour</h3>
                <p className="text-sm text-muted-foreground">
                  {completedCount}/{totalCount} terminées
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {completedCount > 0 && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCompleted(!showCompleted);
                  }}
                >
                  {showCompleted ? 'Masquer terminées' : 'Voir terminées'}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            <ScrollArea className="max-h-[300px]">
              <div className="divide-y">
                {visibleTasks.map(task => {
                  const isCompleted = isTaskCompleted(task.id);
                  const location = LOCATION_TYPES[task.location_type] || LOCATION_TYPES.other;
                  const priority = PRIORITIES[task.priority] || PRIORITIES.normal;

                  return (
                    <div 
                      key={task.id} 
                      className={`p-4 flex items-start gap-3 ${isCompleted ? 'bg-green-50/50' : ''}`}
                    >
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => handleToggleComplete(task.id)}
                        disabled={completeMutation.isPending}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                          <Badge className={priority.color} variant="secondary">
                            {priority.label}
                          </Badge>
                          {task.is_one_time && (
                            <Badge variant="outline" className="text-xs">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              Ponctuelle
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span>{location.icon}</span>
                            {location.label}
                            {task.location_reference && ` - ${task.location_reference}`}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                      {isCompleted && (
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
