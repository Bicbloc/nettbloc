import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Upload, Map, Tag, CheckCircle, Settings } from "lucide-react";
import { TrainingStep1Import } from "./TrainingStep1Import";
import { TrainingStep2Mapping } from "./TrainingStep2Mapping";
import { TrainingStep3Annotate } from "./TrainingStep3Annotate";
import { TrainingStep4Save } from "./TrainingStep4Save";
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
  // Nouveau: données de mapping
  statusMapping?: Record<string, string>;
  exclusionPatterns?: string[];
}

// Workflow en 4 étapes claires
const DISPLAY_STEPS = [
  { id: 1, label: "Importer", icon: Upload },
  { id: 2, label: "Mapper", icon: Map },
  { id: 3, label: "Vérifier", icon: Tag },
  { id: 4, label: "Sauvegarder", icon: CheckCircle },
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

  // Étape 1: Import terminé → aller au mapping
  const handleImportComplete = (data: TrainingData) => {
    setTrainingData(data);
    setCurrentStep(2); // Aller au mapping
  };

  // Étape 2: Mapping terminé → appliquer le mapping et aller à l'annotation
  const handleMappingComplete = (
    mappedRooms: ExtractedRoom[], 
    statusMapping: Record<string, string>,
    exclusionPatterns: string[]
  ) => {
    if (trainingData) {
      setTrainingData({
        ...trainingData,
        extractedRooms: mappedRooms,
        statusMapping,
        exclusionPatterns,
      });
      setCurrentStep(3); // Aller à l'annotation
    }
  };

  // Étape 3: Annotation terminée → aller à la sauvegarde
  const handleAnnotationComplete = (rooms: ExtractedRoom[]) => {
    if (trainingData) {
      setTrainingData({
        ...trainingData,
        extractedRooms: rooms,
        validatedCount: rooms.filter(r => r.validated).length,
      });
      setCurrentStep(4); // Aller à la sauvegarde
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
    // Aller directement à l'annotation pour les éditions
    setCurrentStep(3);
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
                Import → Mapping → Vérification → Sauvegarde
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
        <div className="flex items-center justify-center gap-2 md:gap-6 mb-8 flex-wrap">
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
                  className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-full transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : isCompleted
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-medium text-sm md:text-base">{step.label}</span>
                </button>
                {index < DISPLAY_STEPS.length - 1 && (
                  <div
                    className={`w-6 md:w-12 h-1 mx-1 md:mx-2 rounded-full ${
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
          {/* Étape 1: Import */}
          {currentStep === 1 && (
            <TrainingStep1Import
              hotelId={hotelId}
              onComplete={handleImportComplete}
            />
          )}

          {/* Étape 2: Mapping (NOUVEAU) */}
          {currentStep === 2 && trainingData && (
            <TrainingStep2Mapping
              trainingData={trainingData}
              hotelId={hotelId}
              onComplete={handleMappingComplete}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {/* Étape 3: Annotation */}
          {currentStep === 3 && trainingData && (
            <TrainingStep3Annotate
              trainingData={trainingData}
              hotelId={hotelId}
              userId={currentUserId}
              onComplete={handleAnnotationComplete}
              onBack={() => setCurrentStep(2)}
              onOpenAdvanced={() => setShowAdvanced(true)}
            />
          )}

          {/* Étape 4: Sauvegarde */}
          {currentStep === 4 && trainingData && (
            <TrainingStep4Save
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
