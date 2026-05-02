import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Layers } from "lucide-react";
import { PdfWorkflowDialog } from "@/components/PdfWorkflowDialog";
import { ConfigDialog } from "@/components/ConfigDialog";
import { BulkEquipmentDialog } from "@/components/equipment/BulkEquipmentDialog";
import { CleaningConfig, Room } from "@/services/pdfService";

interface QuickActionsCardProps {
  currentHotelId: string | null;
  cleaningConfig: CleaningConfig;
  housekeeperNames: string[];
  rooms: Room[];
  isPremium: boolean;
  onPdfProcessed: (data: Room[], housekeepers?: string[], distributionMethod?: 'random' | 'floor' | 'cleaning-type') => void;
  onConfigChange: (config: CleaningConfig) => void;
  onHousekeeperNamesChange: (names: string[]) => void;
  onDistribute: () => void;
}

export const QuickActionsCard = ({
  currentHotelId,
  cleaningConfig,
  housekeeperNames,
  rooms,
  isPremium,
  onPdfProcessed,
  onConfigChange,
  onHousekeeperNamesChange,
  onDistribute
}: QuickActionsCardProps) => {
  const [bulkOpen, setBulkOpen] = useState(false);
  return (
    <Card className="group border-border/50 bg-gradient-to-br from-card to-card/80 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Actions rapides</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Gérez votre planning
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <PdfWorkflowDialog 
          hotelId={currentHotelId}
          onWorkflowComplete={onPdfProcessed}
        />
        <ConfigDialog 
          config={cleaningConfig} 
          onConfigChange={onConfigChange}
          housekeeperNames={housekeeperNames}
          onHousekeeperNamesChange={onHousekeeperNamesChange}
          isPremium={isPremium}
        />
        <Button 
          onClick={onDistribute}
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
          disabled={housekeeperNames.length === 0 || rooms.length === 0}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Distribuer automatiquement
        </Button>
      </CardContent>
    </Card>
  );
};
