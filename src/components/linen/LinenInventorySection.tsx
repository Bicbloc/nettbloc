import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { LinenInventoryForm } from "./LinenInventoryForm";
import { Calendar, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface LinenInventorySectionProps {
  hotelId: string;
  housekeeperId: string;
}

export const LinenInventorySection = ({ hotelId, housekeeperId }: LinenInventorySectionProps) => {
  const { data: activeTask, isLoading, refetch } = useQuery({
    queryKey: ["active-linen-task", housekeeperId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_inventory_tasks")
        .select("*")
        .eq("assigned_to", housekeeperId)
        .in("status", ["pending", "in_progress"])
        .order("task_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return null;
  }

  if (!activeTask) {
    return null;
  }

  const handleComplete = () => {
    refetch();
  };

  return (
    <div className="space-y-4 mb-6">
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200">
        <div className="flex items-start gap-3">
          <ClipboardList className="h-5 w-5 text-blue-600 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              Inventaire du linge
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <Calendar className="h-3 w-3 inline mr-1" />
              {format(new Date(activeTask.task_date), "d MMMM yyyy", { locale: fr })}
            </p>
            {activeTask.notes && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                {activeTask.notes}
              </p>
            )}
          </div>
        </div>
      </Card>

      <LinenInventoryForm
        taskId={activeTask.id}
        hotelId={hotelId}
        onComplete={handleComplete}
      />
    </div>
  );
};