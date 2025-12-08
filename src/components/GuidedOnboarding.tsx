import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, Building, Users, BarChart3, CheckCircle, 
  ArrowRight, ArrowLeft, Sparkles, Copy, X, HelpCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GuidedOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  hotelCode?: string;
  onStepAction?: (step: number) => void;
}

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
  actionLabel?: string;
  highlight?: string;
}

const steps: OnboardingStep[] = [
  {
    id: 1,
    title: "Importer votre rapport",
    description: "Commencez par importer le rapport PDF de votre PMS",
    icon: <FileText className="h-8 w-8" />,
    details: [
      "Cliquez sur le bouton 'Importer PDF' dans l'onglet Tableau de bord",
      "Sélectionnez votre fichier PDF contenant les chambres du jour",
      "Le système analyse automatiquement les chambres à nettoyer",
      "Les types de nettoyage (À blanc/Recouche) sont détectés automatiquement"
    ],
    actionLabel: "Importer un PDF",
    highlight: "L'import PDF est gratuit et illimité"
  },
  {
    id: 2,
    title: "Vos chambres s'enregistrent ici",
    description: "Découvrez où sont stockées toutes vos chambres",
    icon: <Building className="h-8 w-8" />,
    details: [
      "Chaque chambre importée est automatiquement sauvegardée",
      "Accédez au registre complet via l'onglet 'Chambres'",
      "Les chambres sont organisées par étage et type",
      "L'historique de chaque chambre est conservé"
    ],
    highlight: "Jusqu'à 15 chambres gratuites, illimitées en Premium"
  },
  {
    id: 3,
    title: "Ajouter votre équipe",
    description: "Configurez les femmes de chambre de votre établissement",
    icon: <Users className="h-8 w-8" />,
    details: [
      "Allez dans l'onglet 'Équipe' pour gérer votre personnel",
      "Ajoutez chaque femme de chambre avec son nom",
      "Des codes d'accès uniques sont générés automatiquement (Premium)",
      "Partagez les codes pour l'accès mobile"
    ],
    actionLabel: "Gérer l'équipe",
    highlight: "Codes d'accès réservés aux abonnés Premium"
  },
  {
    id: 4,
    title: "Distribuer les tâches",
    description: "Répartissez les chambres équitablement",
    icon: <BarChart3 className="h-8 w-8" />,
    details: [
      "Utilisez la distribution automatique ou manuelle",
      "Le système équilibre la charge de travail",
      "Tenez compte du temps estimé par type de nettoyage",
      "Réassignez facilement en cas de besoin"
    ],
    actionLabel: "Distribuer",
    highlight: "Distribution automatique intelligente"
  },
  {
    id: 5,
    title: "Clôturer la journée",
    description: "Finalisez et archivez le travail du jour",
    icon: <CheckCircle className="h-8 w-8" />,
    details: [
      "Une fois toutes les chambres nettoyées, cliquez sur 'Clôturer'",
      "Un rapport récapitulatif est généré automatiquement",
      "Téléchargez ou envoyez le rapport par email",
      "Les données sont archivées pour vos statistiques"
    ],
    actionLabel: "Voir les rapports",
    highlight: "Rapports PDF gratuits à télécharger"
  }
];

export function GuidedOnboarding({ isOpen, onClose, hotelCode, onStepAction }: GuidedOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('onboarding_completed');
    setHasSeenOnboarding(!!seen);
  }, []);

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setHasSeenOnboarding(true);
    onClose();
    toast({
      title: "Guide terminé !",
      description: "Vous pouvez relancer ce guide à tout moment via le bouton '?' dans le header."
    });
  };

  const handleCopyCode = async () => {
    if (hotelCode) {
      await navigator.clipboard.writeText(hotelCode);
      toast({
        title: "Code copié !",
        description: `Le code ${hotelCode} a été copié dans le presse-papiers.`
      });
    }
  };

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Guide de démarrage</DialogTitle>
                <DialogDescription>
                  Étape {currentStep + 1} sur {steps.length}
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 mt-4">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </DialogHeader>

        <div className="py-6">
          <Card className="border-2 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  {step.icon}
                </div>
                <h3 className="text-2xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground mt-2">{step.description}</p>
              </div>

              <div className="space-y-3 mb-6">
                {step.details.map((detail, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="p-1 rounded-full bg-primary/20 mt-0.5">
                      <CheckCircle className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{detail}</span>
                  </div>
                ))}
              </div>

              {step.highlight && (
                <Badge variant="secondary" className="w-full justify-center py-2 text-sm">
                  💡 {step.highlight}
                </Badge>
              )}

              {/* Section spéciale pour le code hôtel (étape 3) */}
              {currentStep === 2 && hotelCode && (
                <div className="mt-4 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                  <p className="text-sm text-muted-foreground mb-2 text-center">
                    Votre code d'établissement à partager :
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="outline" className="text-lg px-4 py-2 font-mono">
                      {hotelCode}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={handleCopyCode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Précédent
            </Button>
          </div>
          
          <div className="flex gap-2">
            {step.actionLabel && onStepAction && (
              <Button 
                variant="secondary"
                onClick={() => onStepAction(currentStep + 1)}
              >
                {step.actionLabel}
              </Button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)}>
                Suivant
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleComplete}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Terminer le guide
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Bouton pour ouvrir le guide
export function OnboardingHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="relative"
      title="Ouvrir le guide"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
