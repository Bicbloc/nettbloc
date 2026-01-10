import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Upload, Tag, CheckCircle, Settings, Wand2, Map } from "lucide-react";
import { TrainingStep1Import } from "./TrainingStep1Import";
import { TrainingStep2Annotate } from "./TrainingStep2Annotate";
import { TrainingStep3Result } from "./TrainingStep3Result";
import { AdvancedSettingsDrawer } from "./AdvancedSettingsDrawer";
import { TrainingHistory } from "./TrainingHistory";
import { UndetectedLinesAnnotator } from "./UndetectedLinesAnnotator";
import { CleaningTypeMapperPage } from "@/components/pms/CleaningTypeMapperPage";
import { pmsAdapterFactory, unifiedParserService, ExtractedRoom } from "@/services/pms";

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

// Étapes simplifiées pour l'affichage (sans 1.5)
const DISPLAY_STEPS = [
  { id: 1, label: "Importer", icon: Upload },
  { id: 2, label: "Annoter", icon: Tag },
  { id: 3, label: "Valider", icon: CheckCircle },
  { id: 4, label: "Mapping", icon: Map },
];

export const TrainingWizard = ({ hotelId }: TrainingWizardProps) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [trainingData, setTrainingData] = useState<TrainingData | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUndetectedStep, setShowUndetectedStep] = useState(false);

  useEffect(() => {
    unifiedParserService.loadHotelPatterns(hotelId);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, [hotelId]);

  const handleImportComplete = (data: TrainingData) => {
    setTrainingData(data);
    // Aller à l'étape des lignes non détectées si rawText disponible
    if (data.rawText) {
      setShowUndetectedStep(true);
    } else {
      setCurrentStep(2);
    }
  };

  const handleUndetectedComplete = (newRooms: ExtractedRoom[]) => {
    if (trainingData) {
      setTrainingData({
        ...trainingData,
        extractedRooms: [...trainingData.extractedRooms, ...newRooms],
      });
    }
    setShowUndetectedStep(false);
    setCurrentStep(2);
  };

  const handleSkipUndetected = () => {
    setShowUndetectedStep(false);
    setCurrentStep(2);
  };

  const handleAnnotationComplete = (rooms: ExtractedRoom[]) => {
    if (trainingData) {
      setTrainingData({
        ...trainingData,
        extractedRooms: rooms,
        validatedCount: rooms.filter(r => r.validated).length,
      });
      setCurrentStep(3);
    }
  };

  const handleReset = () => {
    setTrainingData(null);
    setCurrentStep(1);
    setShowUndetectedStep(false);
    setRefreshKey(prev => prev + 1);
  };

  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
      setShowUndetectedStep(false);
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

  // Si on est en mode mapping (étape 4)
  if (currentStep === 4) {
    return (
      <CleaningTypeMapperPage 
        hotelId={hotelId} 
        onBack={() => setCurrentStep(3)} 
      />
    );
  }

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
                Apprenez au système à reconnaître vos rapports en 4 étapes
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
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 flex-wrap">
          {DISPLAY_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id || (showUndetectedStep && step.id === 1);
            const isCompleted = currentStep > step.id && !showUndetectedStep;
            const isClickable = step.id < currentStep && !showUndetectedStep;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => isClickable && goToStep(step.id)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all text-sm ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium hidden sm:inline">{step.label}</span>
                </button>
                {index < DISPLAY_STEPS.length - 1 && (
                  <div
                    className={`w-6 md:w-12 h-0.5 mx-1 md:mx-2 ${
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
          {currentStep === 1 && !showUndetectedStep && (
            <TrainingStep1Import
              hotelId={hotelId}
              onComplete={handleImportComplete}
            />
          )}

          {showUndetectedStep && trainingData && (
            <UndetectedLinesAnnotator
              rawText={trainingData.rawText}
              detectedRooms={trainingData.extractedRooms}
              onAddRooms={handleUndetectedComplete}
              onSkip={handleSkipUndetected}
            />
          )}

          {currentStep === 2 && !showUndetectedStep && trainingData && (
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
              onContinueToMapping={() => setCurrentStep(4)}
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
