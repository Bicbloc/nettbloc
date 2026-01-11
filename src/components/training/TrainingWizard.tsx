import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Upload, Tag, CheckCircle, Settings } from "lucide-react";
import { TrainingStep1Import } from "./TrainingStep1Import";
import { TrainingStep2Annotate } from "./TrainingStep2Annotate";
import { TrainingStep3Result } from "./TrainingStep3Result";
import { AdvancedSettingsDrawer } from "./AdvancedSettingsDrawer";
import { TrainingHistory } from "./TrainingHistory";
import { unifiedParserService, ExtractedRoom } from "@/services/pms";

interface TrainingWizardProps {
  hotelId: string;
}

export interface TrainingData {
  reportName: string;
  rawText: string;
  extractedRooms: ExtractedRoom[];
  detectedPmsType: string;
  validatedCount: number;
  existingPatternId?: string;
}

// Workflow simplifié en 3 étapes
const DISPLAY_STEPS = [
  { id: 1, label: "Importer", icon: Upload },
  { id: 2, label: "Vérifier", icon: Tag },
  { id: 3, label: "Sauvegarder", icon: CheckCircle },
];

export const TrainingWizard = ({ hotelId }: TrainingWizardProps) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [trainingData, setTrainingData] = useState<TrainingData | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    unifiedParserService.loadHotelPatterns(hotelId);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, [hotelId]);

  const handleImportComplete = (data: TrainingData) => {
    setTrainingData(data);
    setCurrentStep(2);
  };

  const handleAnnotationComplete = (rooms: ExtractedRoom[]) => {
    if (trainingData) {
      setTrainingData({
        ...trainingData,
        extractedRooms: rooms,
        validatedCount: rooms.filter(r => r.validated).length,
      });
      // Aller directement à la sauvegarde
      setCurrentStep(3);
    }
  };

  const handleReset = () => {
    setTrainingData(null);
    setCurrentStep(1);
    setRefreshKey(prev => prev + 1);
  };

  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  const handleEditPattern = async (pattern: any) => {
    const rooms: ExtractedRoom[] = Array.isArray(pattern.extracted_data)
      ? pattern.extracted_data.map((r: any) => ({
          ...r,
          validated: true,
        }))
      : (pattern.extracted_data?.rooms || []).map((r: any) => ({
          ...r,
          validated: true,
        }));

    setTrainingData({
      reportName: pattern.report_name,
      rawText: pattern.raw_text || "",
      extractedRooms: rooms,
      detectedPmsType: pattern.pms_type,
      validatedCount: rooms.length,
      existingPatternId: pattern.id,
    });
    setCurrentStep(2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Entraîner l'IA</h2>
              <p className="text-sm text-muted-foreground">
                Apprenez au système à reconnaître vos rapports
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(true)}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Options avancées
          </Button>
        </div>
      </Card>

      {/* Training History */}
      <TrainingHistory 
        key={refreshKey}
        hotelId={hotelId} 
        onEdit={handleEditPattern}
        onDeleted={() => {
          unifiedParserService.loadHotelPatterns(hotelId);
          setRefreshKey(prev => prev + 1);
        }}
      />

      {/* Progress Steps */}
      <Card className="p-6">
        <div className="flex items-center justify-center gap-4 md:gap-8 mb-8">
          {DISPLAY_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const isClickable = step.id < currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => isClickable && goToStep(step.id)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : isCompleted
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{step.label}</span>
                </button>
                {index < DISPLAY_STEPS.length - 1 && (
                  <div
                    className={`w-12 md:w-20 h-1 mx-2 md:mx-4 rounded-full ${
                      isCompleted ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <TrainingStep1Import
              hotelId={hotelId}
              onComplete={handleImportComplete}
            />
          )}

          {currentStep === 2 && trainingData && (
            <TrainingStep2Annotate
              trainingData={trainingData}
              hotelId={hotelId}
              userId={currentUserId}
              onComplete={handleAnnotationComplete}
              onBack={() => setCurrentStep(1)}
              onOpenAdvanced={() => setShowAdvanced(true)}
            />
          )}

          {currentStep === 3 && trainingData && (
            <TrainingStep3Result
              trainingData={trainingData}
              hotelId={hotelId}
              onReset={handleReset}
            />
          )}
        </div>
      </Card>

      {/* Advanced Settings Drawer */}
      <AdvancedSettingsDrawer
        open={showAdvanced}
        onOpenChange={setShowAdvanced}
        hotelId={hotelId}
      />
    </div>
  );
};
