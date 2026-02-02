import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollText, ChevronDown, ChevronUp, AlertCircle, Lightbulb, CheckSquare, X } from "lucide-react";

interface DailyInstructionsBannerProps {
  hotelId: string;
}

export function DailyInstructionsBanner({ hotelId }: DailyInstructionsBannerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if dismissed today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const dismissedKey = `instructions_dismissed_${hotelId}_${today}`;
    const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
    setIsDismissed(wasDismissed);
  }, [hotelId]);

  const { data: instructions, isLoading } = useQuery({
    queryKey: ["daily-instructions", hotelId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("daily_instructions")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("instruction_date", today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const handleDismiss = () => {
    const today = new Date().toISOString().split('T')[0];
    const dismissedKey = `instructions_dismissed_${hotelId}_${today}`;
    localStorage.setItem(dismissedKey, 'true');
    setIsDismissed(true);
  };

  // No content or dismissed
  if (isDismissed || isLoading) return null;
  if (!instructions || (!instructions.instructions && !instructions.to_know && !instructions.todo_list)) {
    return null;
  }

  const hasContent = instructions.instructions || instructions.to_know || instructions.todo_list;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-amber-100/50 transition-colors">
            <div className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-900">Consignes du jour</span>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                Nouveau
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-200"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-amber-600" />
              ) : (
                <ChevronDown className="h-5 w-5 text-amber-600" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            {instructions.instructions && (
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-700 uppercase">Consignes</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{instructions.instructions}</p>
                </div>
              </div>
            )}

            {instructions.to_know && (
              <div className="flex gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-700 uppercase">À savoir</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{instructions.to_know}</p>
                </div>
              </div>
            )}

            {instructions.todo_list && (
              <div className="flex gap-2">
                <CheckSquare className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-green-700 uppercase">To-do</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{instructions.todo_list}</p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
