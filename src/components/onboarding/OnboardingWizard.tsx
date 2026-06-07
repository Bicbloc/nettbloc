import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Building2,
  Sparkles,
  Gift,
  LogOut
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OnboardingWizardProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface OnboardingInfo {
  companyName: string;
  contactName: string;
  phone: string;
}

const STEPS = [
  { id: 'welcome', title: 'Bienvenue', icon: Sparkles },
  { id: 'info', title: 'Vos informations', icon: Building2 },
  { id: 'confirm', title: 'Confirmation', icon: Gift },
];

export function OnboardingWizard({ isOpen, onComplete }: OnboardingWizardProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingName, setHasExistingName] = useState(false);
  const [info, setInfo] = useState<OnboardingInfo>({
    companyName: '',
    contactName: '',
    phone: '',
  });

  // Préremplir avec les infos déjà connues (profil + métadonnées du compte)
  useEffect(() => {
    if (!isOpen || !user) return;
    const loadExisting = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, billing_contact_name, billing_phone')
        .eq('id', user.id)
        .maybeSingle();

      const metaName =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        '';
      const existingName = profile?.billing_contact_name || metaName || '';

      setHasExistingName(existingName.trim().length > 2);
      setInfo(prev => ({
        companyName: profile?.company_name || prev.companyName,
        contactName: existingName || prev.contactName,
        phone: profile?.billing_phone || prev.phone,
      }));
    };
    loadExisting();
  }, [isOpen, user]);

  const updateField = (field: keyof OnboardingInfo, value: string) => {
    setInfo(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return info.companyName.length > 2 && info.contactName.length > 2 && info.phone.length >= 10;
      case 2:
        return true;
      default:
        return true;
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('complete_onboarding_simple', {
        p_user_id: user.id,
        p_company_name: info.companyName,
        p_contact_name: info.contactName,
        p_phone: info.phone
      });

      if (error) {
        console.error('RPC error:', error);
        throw error;
      }

      toast({
        title: "🎉 Bienvenue chez NettoBloc !",
        description: "Votre période d'essai de 3 mois a commencé.",
      });

      onComplete();
    } catch (error) {
      console.error('Erreur onboarding:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de terminer la configuration. Veuillez réessayer."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 py-2 sm:py-4">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center">
                <Sparkles className="h-12 w-12 sm:h-14 sm:w-14 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold">Bienvenue sur NettoBloc !</h3>
                <p className="text-muted-foreground mt-3 text-sm sm:text-base leading-relaxed">
                  Quelques informations de base suffisent pour démarrer. La configuration complète
                  (chambres, équipe, consignes…) se fait ensuite tranquillement depuis votre tableau de bord.
                </p>
              </div>
            </div>

            <Card className="border-primary/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Gift className="h-9 w-9 sm:h-10 sm:w-10 text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-base text-green-800 dark:text-green-200">3 mois d'essai gratuit</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Accès complet à toutes les fonctionnalités, sans carte bancaire.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-5 space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground text-base">Vous pourrez faire plus tard :</p>
                <ul className="space-y-1.5 list-disc pl-5">
                  <li>Importer ou créer vos chambres</li>
                  <li>Inviter vos gouvernantes et femmes de chambre</li>
                  <li>Définir vos consignes et temps de nettoyage</li>
                </ul>
                <p className="pt-2">Rien d'urgent : tout reste modifiable à tout moment.</p>
              </CardContent>
            </Card>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Ces informations identifient votre établissement et nous permettent de vous contacter
              si besoin. Vous pourrez les modifier plus tard dans votre profil.
            </p>

            <div className="space-y-2">
              <Label htmlFor="companyName">Nom de l'établissement *</Label>
              <Input
                id="companyName"
                value={info.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder="Hôtel Le Magnifique"
              />
            </div>

            {!hasExistingName && (
              <div className="space-y-2">
                <Label htmlFor="contactName">Votre nom *</Label>
                <Input
                  id="contactName"
                  value={info.contactName}
                  onChange={(e) => updateField('contactName', e.target.value)}
                  placeholder="Marie Dupont"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                value={info.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+33 1 23 45 67 89"
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                💳 Les informations de facturation (SIRET, IBAN) seront demandées uniquement à la fin
                de votre période d'essai. Inutile de les préparer maintenant.
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                <Check className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Tout est prêt !</h3>
                <p className="text-muted-foreground mt-2">
                  Votre période d'essai de 3 mois va commencer.
                </p>
              </div>
            </div>

            <Card className="border-primary/20 bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <h4 className="font-semibold">Récapitulatif</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
                    <span className="text-muted-foreground shrink-0">Établissement</span>
                    <span className="font-medium break-words sm:text-right">{info.companyName}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
                    <span className="text-muted-foreground shrink-0">Contact</span>
                    <span className="font-medium break-words sm:text-right">{info.contactName}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Essai gratuit</span>
                    <span className="font-medium text-green-600">3 mois</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-1 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Prochaines étapes (quand vous voulez)</p>
                <p>
                  Depuis votre tableau de bord : ajoutez vos chambres, invitez votre équipe et
                  définissez vos consignes. Vous pouvez aussi le faire plus tard.
                </p>
              </CardContent>
            </Card>

            <p className="text-xs text-center text-muted-foreground">
              À la fin de l'essai, vous pourrez choisir un plan et fournir vos informations de facturation.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[450px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {STEPS.map((step, idx) => (
              <div
                key={step.id}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx <= currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <DialogTitle className="flex items-center gap-2">
            {(() => {
              const StepIcon = STEPS[currentStep].icon;
              return <StepIcon className="h-5 w-5 text-primary" />;
            })()}
            {STEPS[currentStep].title}
          </DialogTitle>
          <DialogDescription>
            Étape {currentStep + 1} sur {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-1" />

        {renderStep()}

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate('/auth', { replace: true });
              }}
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Déconnexion
            </Button>
            {currentStep > 0 && (
              <Button
                variant="ghost"
                onClick={() => setCurrentStep(prev => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
            )}
          </div>

          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Activation...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Commencer l'essai
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}