import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectedRoomRulesManager } from "@/components/ConnectedRoomRulesManager";
import { PmsRulesManager } from "@/components/PmsRulesManager";
import { PmsPatternManager } from "@/components/PmsPatternManager";
import { ErrorAnalysisDashboard } from "@/components/ErrorAnalysisDashboard";
import { CleaningCombinationMapper } from "@/components/pms/CleaningCombinationMapper";
import { Link2, Settings, Brain, Activity, Layers } from "lucide-react";

interface AdvancedSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
}

export const AdvancedSettingsDrawer = ({ open, onOpenChange, hotelId }: AdvancedSettingsDrawerProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Paramètres avancés</SheetTitle>
          <SheetDescription>
            Configurez les règles de détection et les modèles d'apprentissage
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="mapping" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="mapping" className="flex items-center gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mapping</span>
            </TabsTrigger>
            <TabsTrigger value="connected" className="flex items-center gap-1.5 text-xs">
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chambres</span>
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Règles</span>
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex items-center gap-1.5 text-xs">
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Modèles</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Diagnostic</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mapping" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Configurez le type de nettoyage selon la combinaison statut + dates + horaires
            </div>
            <CleaningCombinationMapper hotelId={hotelId} />
          </TabsContent>

          <TabsContent value="connected" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Définissez quelles chambres sont connectées entre elles (suites, communicantes)
            </div>
            <ConnectedRoomRulesManager hotelId={hotelId} />
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Personnalisez les règles de détection du type de nettoyage
            </div>
            <PmsRulesManager hotelId={hotelId} />
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Gérez les modèles d'apprentissage pour la reconnaissance de vos rapports
            </div>
            <PmsPatternManager hotelId={hotelId} />
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Analysez les erreurs de détection pour améliorer la précision
            </div>
            <ErrorAnalysisDashboard hotelId={hotelId} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
