import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { CleaningConfig } from "@/services/pdfService";

interface PlanningSummaryCardProps {
  twinRooms: number;
  fullCleaningRooms: number;
  quickCleaningRooms: number;
  housekeeperCount: number;
  cleaningConfig: CleaningConfig;
}

export const PlanningSummaryCard = ({
  twinRooms,
  fullCleaningRooms,
  quickCleaningRooms,
  housekeeperCount,
  cleaningConfig
}: PlanningSummaryCardProps) => {
  const totalTime = fullCleaningRooms * cleaningConfig.fullCleaningTime + 
                    quickCleaningRooms * cleaningConfig.quickCleaningTime;
  
  const averageTimePerHousekeeper = housekeeperCount > 0 
    ? Math.round(totalTime / (60 * housekeeperCount)) 
    : 0;

  return (
    <Card className="group border-border/50 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:shadow-info/5 transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-info/10 text-info group-hover:bg-info group-hover:text-white transition-colors duration-300">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Résumé planning</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Aperçu des nettoyages
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <span className="text-sm text-muted-foreground">Chambres doubles</span>
            <span className="text-sm font-bold text-foreground">{twinRooms}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <span className="text-sm text-muted-foreground">Temps total estimé</span>
            <span className="text-sm font-bold text-foreground">
              {Math.round(totalTime / 60)}h
            </span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <span className="text-sm text-muted-foreground">Temps moyen/pers.</span>
            <span className="text-sm font-bold text-foreground">
              {averageTimePerHousekeeper}h
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
