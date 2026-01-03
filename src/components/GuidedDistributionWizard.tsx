import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileUp, 
  Users, 
  LayoutGrid, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  HelpCircle,
  Lightbulb,
  GraduationCap,
  Play,
  BookOpen
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GuidedDistributionWizardProps {
  onStartWorkflow: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const STEPS = [
  {
    id: 1,
    title: "Téléverser le rapport PMS",
    description: "Importez votre rapport journalier depuis votre logiciel de gestion (Mews, Apaleo, Opera, Protel, etc.)",
    icon: FileUp,
    tips: [
      "Utilisez le format PDF exporté de votre PMS",
      "Assurez-vous que le rapport contient les statuts des chambres",
      "Les rapports du jour sont recommandés pour la précision"
    ],
    action: "Téléverser un rapport"
  },
  {
    id: 2,
    title: "Vérifier l'extraction",
    description: "L'IA analyse votre rapport et extrait automatiquement les informations des chambres",
    icon: Sparkles,
    tips: [
      "Vérifiez le nombre de chambres détectées",
      "Les types de nettoyage sont identifiés automatiquement",
      "En cas d'erreur, utilisez l'entraînement IA"
    ],
    action: "Analyser le rapport"
  },
  {
    id: 3,
    title: "Configurer l'équipe",
    description: "Sélectionnez ou ajoutez les femmes de chambre disponibles pour la journée",
    icon: Users,
    tips: [
      "Vous pouvez sélectionner parmi les profils existants",
      "Ajoutez de nouvelles personnes si nécessaire",
      "Le nombre de chambres sera réparti équitablement"
    ],
    action: "Configurer l'équipe"
  },
  {
    id: 4,
    title: "Choisir la méthode de distribution",
    description: "Définissez comment répartir les chambres entre les femmes de chambre",
    icon: LayoutGrid,
    tips: [
      "Aléatoire : répartition équitable et simple",
      "Par étage : chaque personne garde son étage",
      "Par type : sépare recouches et à blanc"
    ],
    action: "Distribuer les chambres"
  },
  {
    id: 5,
    title: "Terminé !",
    description: "Les chambres sont assignées et visibles par chaque membre de l'équipe",
    icon: CheckCircle2,
    tips: [
      "Les femmes de chambre voient leurs chambres sur mobile",
      "Vous pouvez suivre l'avancement en temps réel",
      "Redistribuez si nécessaire depuis le tableau de bord"
    ],
    action: "Voir le tableau de bord"
  }
];

export function GuidedDistributionWizard({ 
  onStartWorkflow,
  isOpen,
  onOpenChange 
}: GuidedDistributionWizardProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  
  const isControlled = isOpen !== undefined;
  const dialogOpen = isControlled ? isOpen : open;
  const setDialogOpen = isControlled ? onOpenChange! : setOpen;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStart = () => {
    setDialogOpen(false);
    setCurrentStep(0);
    onStartWorkflow();
  };

  const handleGoToTraining = () => {
    setDialogOpen(false);
    navigate('/?tab=training');
  };

  const step = STEPS[currentStep];
  const StepIcon = step.icon;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Aide guidée
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Assistant de distribution des chambres
          </DialogTitle>
          <DialogDescription>
            Suivez ce guide étape par étape pour distribuer efficacement les chambres à votre équipe
          </DialogDescription>
        </DialogHeader>

        {/* Barre de progression */}
        <div className="relative pt-2">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(idx)}
                  className={`
                    flex flex-col items-center gap-1 transition-all
                    ${isActive ? 'scale-110' : 'opacity-60 hover:opacity-80'}
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-colors
                    ${isActive ? 'bg-primary text-primary-foreground' : ''}
                    ${isCompleted ? 'bg-primary/20 text-primary' : ''}
                    ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`text-xs hidden sm:block ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    Étape {s.id}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Contenu de l'étape */}
        <Card className="mt-4 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                <StepIcon className="h-8 w-8" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <Badge variant="outline" className="mb-2">
                    Étape {step.id} sur {STEPS.length}
                  </Badge>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1">{step.description}</p>
                </div>
                
                {/* Conseils */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Lightbulb className="h-4 w-4" />
                    Conseils
                  </div>
                  <ul className="space-y-2">
                    {step.tips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerte pour l'entraînement IA */}
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <GraduationCap className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            <strong className="text-amber-700">Important :</strong> Si votre rapport ne s'analyse pas correctement, 
            rendez-vous dans <button 
              onClick={handleGoToTraining}
              className="font-medium text-primary hover:underline"
            >
              Entraînement IA
            </button> pour personnaliser la reconnaissance de votre format de rapport.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </Button>
          
          <div className="flex gap-2">
            {currentStep < STEPS.length - 1 ? (
              <>
                <Button variant="outline" onClick={handleNext} className="gap-2">
                  Suivant
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button onClick={handleStart} className="gap-2">
                  <Play className="h-4 w-4" />
                  Commencer maintenant
                </Button>
              </>
            ) : (
              <Button onClick={handleStart} className="gap-2">
                <Play className="h-4 w-4" />
                Lancer la distribution
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
