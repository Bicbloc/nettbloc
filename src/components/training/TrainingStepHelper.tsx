import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface StepInfo {
  title: string;
  description: string;
  tips: string[];
  warnings?: string[];
  nextStep?: string;
}

const STEP_GUIDE: Record<number, StepInfo> = {
  1: {
    title: "Importer un rapport",
    description: "Téléchargez un rapport PDF de votre PMS (Mews, Apaleo, Medialog, etc.). L'IA va automatiquement détecter le format et extraire les chambres.",
    tips: [
      "Utilisez un rapport représentatif avec plusieurs types de statuts (départs, recouches, arrivées)",
      "Le rapport doit contenir au moins 5-10 chambres pour un bon apprentissage",
      "Vous pouvez changer le type de PMS si la détection automatique n'est pas correcte"
    ],
    warnings: [
      "Évitez les rapports scannés (images) - le texte doit être sélectionnable"
    ],
    nextStep: "Une fois importé, vous configurerez les correspondances entre votre PMS et les types de nettoyage"
  },
  2: {
    title: "Mapper les colonnes et règles",
    description: "Configurez comment les données de votre rapport correspondent aux types de nettoyage. Définissez des règles de combinaison pour les cas complexes.",
    tips: [
      "L'onglet 'Aperçu' montre les données brutes détectées",
      "L'onglet 'Combinaisons' permet de créer des règles avancées (ex: SAL + 2 dates = À blanc)",
      "Utilisez les templates prédéfinis comme point de départ"
    ],
    warnings: [
      "Les règles de combinaison s'appliquent dans l'ordre de priorité - la plus haute gagne"
    ],
    nextStep: "Ensuite, vous vérifierez que chaque chambre a été correctement détectée"
  },
  3: {
    title: "Vérifier et corriger",
    description: "Passez en revue les chambres extraites. Corrigez manuellement les erreurs pour améliorer l'apprentissage de l'IA.",
    tips: [
      "Cliquez sur une ligne du rapport pour l'ajouter comme chambre manquante",
      "Utilisez le bouton 'Valider tout' si la détection est correcte",
      "Les corrections créent des règles permanentes pour les futurs imports"
    ],
    warnings: [
      "Vérifiez particulièrement les 'dernières nuits' (Nuit 3/3) qui doivent être À blanc"
    ],
    nextStep: "Enfin, vous sauvegarderez l'apprentissage pour les futurs imports"
  },
  4: {
    title: "Sauvegarder l'apprentissage",
    description: "Enregistrez votre configuration. Elle sera automatiquement appliquée aux prochains imports de rapports similaires.",
    tips: [
      "L'apprentissage est spécifique à votre hôtel",
      "Vous pouvez éditer ou supprimer les apprentissages depuis l'historique",
      "Importez plusieurs rapports différents pour enrichir l'apprentissage"
    ],
    nextStep: "Retournez dans 'Affectation' pour importer vos rapports quotidiens !"
  }
};

interface TrainingStepHelperProps {
  currentStep: number;
  variant?: 'compact' | 'expanded';
}

export const TrainingStepHelper = ({ currentStep, variant = 'compact' }: TrainingStepHelperProps) => {
  const [isOpen, setIsOpen] = useState(variant === 'expanded');
  const stepInfo = STEP_GUIDE[currentStep];

  if (!stepInfo) return null;

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm p-4">
            <div className="space-y-2">
              <p className="font-medium">{stepInfo.title}</p>
              <p className="text-sm text-muted-foreground">{stepInfo.description}</p>
              {stepInfo.tips.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium flex items-center gap-1 mb-1">
                    <Lightbulb className="h-3 w-3 text-yellow-500" />
                    Conseil
                  </p>
                  <p className="text-xs text-muted-foreground">{stepInfo.tips[0]}</p>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20 bg-primary/5">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-primary/10 transition-colors rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Guide : {stepInfo.title}</p>
                <p className="text-xs text-muted-foreground">
                  {isOpen ? 'Cliquez pour réduire' : 'Cliquez pour voir les conseils'}
                </p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            <p className="text-sm text-muted-foreground">{stepInfo.description}</p>
            
            {/* Tips */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-primary flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Conseils
              </p>
              <ul className="space-y-1">
                {stepInfo.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Warnings */}
            {stepInfo.warnings && stepInfo.warnings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Attention
                </p>
                <ul className="space-y-1">
                  {stepInfo.warnings.map((warning, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                      <span className="mt-0.5">⚠️</span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next step */}
            {stepInfo.nextStep && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-primary" />
                  <span className="font-medium">Prochaine étape :</span> {stepInfo.nextStep}
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// Tooltip pour expliquer les termes techniques
interface TermTooltipProps {
  term: string;
  children: React.ReactNode;
}

const TERM_DEFINITIONS: Record<string, string> = {
  'recouche': "Nettoyage rapide pour une chambre où le client reste (client en place). On change les draps du dessus, on nettoie la salle de bain.",
  'a_blanc': "Nettoyage complet après un départ. On change tous les draps, nettoyage approfondi de la chambre et salle de bain.",
  'propre': "Chambre déjà nettoyée et inspectée, prête pour l'arrivée. Pas de nettoyage nécessaire.",
  'SAL': "Code Mews signifiant 'Sale' (Dirty). La chambre nécessite un nettoyage.",
  'DIR': "Code Mews signifiant 'Dirty'. Équivalent de SAL.",
  'INS': "Code Mews signifiant 'Inspecté'. Chambre propre et vérifiée.",
  'PRO': "Code signifiant 'Propre'. Pas de nettoyage nécessaire.",
  'DEP': "Départ - le client quitte l'hôtel aujourd'hui.",
  'ARR': "Arrivée - un nouveau client arrive aujourd'hui.",
  'OCC': "Occupé - chambre occupée par un client en séjour.",
  'priorité': "Plus la priorité est haute, plus la règle est évaluée en premier. Une règle avec priorité 100 sera vérifiée avant une règle avec priorité 50.",
  'combinaison': "Règle qui combine plusieurs critères (statut + dates + horaires) pour déterminer le type de nettoyage.",
};

export const TermTooltip = ({ term, children }: TermTooltipProps) => {
  const definition = TERM_DEFINITIONS[term.toLowerCase()];
  
  if (!definition) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="underline decoration-dotted decoration-primary/50 cursor-help">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Badge explicatif pour les types de nettoyage
interface CleaningTypeBadgeProps {
  type: 'full' | 'quick' | 'none' | 'a_blanc' | 'recouche';
  showTooltip?: boolean;
}

export const CleaningTypeBadge = ({ type, showTooltip = true }: CleaningTypeBadgeProps) => {
  const config: Record<string, { label: string; color: string; description: string }> = {
    'full': { label: 'À blanc', color: 'bg-orange-500', description: 'Nettoyage complet après départ' },
    'a_blanc': { label: 'À blanc', color: 'bg-orange-500', description: 'Nettoyage complet après départ' },
    'quick': { label: 'Recouche', color: 'bg-blue-500', description: 'Nettoyage rapide, client en place' },
    'recouche': { label: 'Recouche', color: 'bg-blue-500', description: 'Nettoyage rapide, client en place' },
    'none': { label: 'Propre', color: 'bg-green-500', description: 'Pas de nettoyage nécessaire' },
  };

  const { label, color, description } = config[type] || config['full'];

  const badge = (
    <Badge className={`${color} text-white`}>
      {label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-sm">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
