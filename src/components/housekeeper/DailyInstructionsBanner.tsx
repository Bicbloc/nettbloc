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

  // Fetch today's manual instructions
  const { data: instructions, isLoading: loadingInstructions } = useQuery({
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
    refetchInterval: 60000,
  });

  // Fetch day-of-week and default templates as fallback
  const { data: templateInstructions, isLoading: loadingTemplates } = useQuery({
    queryKey: ["instruction-templates-fallback", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruction_templates")
        .select("*")
        .eq("hotel_id", hotelId);

      if (error) throw error;
      return data;
    },
    enabled: !instructions, // Only fetch if no manual instructions
  });

  const handleDismiss = () => {
    const today = new Date().toISOString().split('T')[0];
    const dismissedKey = `instructions_dismissed_${hotelId}_${today}`;
    localStorage.setItem(dismissedKey, 'true');
    setIsDismissed(true);
  };

  const isLoading = loadingInstructions || loadingTemplates;

  if (isDismissed || isLoading) return null;

  // Build display data: manual instructions first, then templates fallback
  let displayInstructions: string | null = null;
  let displayToKnow: string | null = null;
  let displayTodoList: string | null = null;
  let isFromTemplate = false;

  if (instructions && (instructions.instructions || instructions.to_know || instructions.todo_list)) {
    displayInstructions = instructions.instructions;
    displayToKnow = instructions.to_know;
    displayTodoList = instructions.todo_list;
  } else if (templateInstructions && templateInstructions.length > 0) {
    const currentDay = new Date().getDay();

    const findBestTemplate = (type: string) => {
      const dayTemplate = templateInstructions.find(
        (t: any) => t.template_type === type && t.day_of_week === currentDay
      );
      if (dayTemplate) return dayTemplate;
      return templateInstructions.find(
        (t: any) => t.template_type === type && t.is_default
      );
    };

    const bestInstruction = findBestTemplate('instructions');
    const bestToKnow = findBestTemplate('to_know');
    const bestTodo = findBestTemplate('todo');

    if (bestInstruction) displayInstructions = bestInstruction.content;
    if (bestToKnow) displayToKnow = bestToKnow.content;
    if (bestTodo) displayTodoList = bestTodo.content;
    isFromTemplate = !!(displayInstructions || displayToKnow || displayTodoList);
  }

  if (!displayInstructions && !displayToKnow && !displayTodoList) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-amber-100/50 transition-colors">
            <div className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-900">Consignes du jour</span>
              {isFromTemplate ? (
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                  Template
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  Nouveau
                </Badge>
              )}
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
            {displayInstructions && (
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-700 uppercase">Consignes</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{displayInstructions}</p>
                </div>
              </div>
            )}

            {displayToKnow && (
              <div className="flex gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-700 uppercase">À savoir</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{displayToKnow}</p>
                </div>
              </div>
            )}

            {displayTodoList && (
              <div className="flex gap-2">
                <CheckSquare className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-green-700 uppercase">To-do</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{displayTodoList}</p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
