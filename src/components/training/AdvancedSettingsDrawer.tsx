import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link2, Settings, Database, AlertCircle } from "lucide-react";
import { ConnectedRoomRulesManager } from "@/components/ConnectedRoomRulesManager";
import { PmsRulesManager } from "@/components/PmsRulesManager";
import { PmsPatternManager } from "@/components/PmsPatternManager";
import { ErrorAnalysisDashboard } from "@/components/ErrorAnalysisDashboard";

interface AdvancedSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
}

export const AdvancedSettingsDrawer = ({
  open,
  onOpenChange,
  hotelId,
}: AdvancedSettingsDrawerProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Options avancées
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-6 pr-4">
          <Tabs defaultValue="connected" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="connected" className="text-xs">
                <Link2 className="w-3 h-3 mr-1" />
                Connexions
              </TabsTrigger>
              <TabsTrigger value="rules" className="text-xs">
                <Settings className="w-3 h-3 mr-1" />
                Règles PMS
              </TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs">
                <Database className="w-3 h-3 mr-1" />
                Modèles
              </TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs">
                <AlertCircle className="w-3 h-3 mr-1" />
                Analyse
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connected">
              <ConnectedRoomRulesManager hotelId={hotelId} />
            </TabsContent>

            <TabsContent value="rules">
              <PmsRulesManager hotelId={hotelId} />
            </TabsContent>

            <TabsContent value="patterns">
              <PmsPatternManager hotelId={hotelId} />
            </TabsContent>

            <TabsContent value="analysis">
              <ErrorAnalysisDashboard hotelId={hotelId} />
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
