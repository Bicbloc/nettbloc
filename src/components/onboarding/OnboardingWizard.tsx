import { useState } from 'react';
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
  Phone,
  Sparkles,
  Gift,
  Calendar
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OnboardingWizardProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface BillingInfo {
  companyName: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  siret: string;
  tvaNumber: string;
  phone: string;
  contactName: string;
  contactEmail: string;
}

// SIRET et infos de facturation sont optionnels pendant l'essai
// Ils seront demandés à la fin de la période d'essai avant le paiement
const STEPS = [
  { id: 'welcome', title: 'Bienvenue', icon: Sparkles },
  { id: 'company', title: 'Entreprise', icon: Building2 },
  { id: 'contact', title: 'Contact', icon: Phone },
  { id: 'trial', title: 'Essai gratuit', icon: Gift },
];

export function OnboardingWizard({ isOpen, onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    companyName: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'France',
    siret: '',
    tvaNumber: '',
    phone: '',
    contactName: '',
    contactEmail: user?.email || '',
  });

  const updateField = (field: keyof BillingInfo, value: string) => {
    setBillingInfo(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1: // Company - only company name is required, SIRET is optional during trial
        return billingInfo.companyName.length > 2;
      case 2: // Contact - name and phone required
        return billingInfo.contactName.length > 2 && billingInfo.phone.length >= 10;
      case 3:
        return true;
      default:
        return true;
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      // Sauvegarder les infos de facturation
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          billing_company_name: billingInfo.companyName,
          billing_address: billingInfo.address,
          billing_postal_code: billingInfo.postalCode,
          billing_city: billingInfo.city,
          billing_country: billingInfo.country,
          siret: billingInfo.siret,
          billing_tva_number: billingInfo.tvaNumber,
          billing_phone: billingInfo.phone,
          billing_contact_name: billingInfo.contactName,
          billing_contact_email: billingInfo.contactEmail,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Démarrer la période d'essai
      const { error: trialError } = await supabase.rpc('start_trial_period', {
        p_user_id: user.id
      });

      if (trialError) throw trialError;

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
        description: "Impossible de terminer la configuration."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Bienvenue sur NettoBloc !</h3>
                <p className="text-muted-foreground mt-2">
                  Configurez votre compte en quelques étapes pour profiter de votre période d'essai de 3 mois.
                </p>
              </div>
            </div>

            <Card className="border-primary/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Gift className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-200">3 mois d'essai gratuit</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Accès complet à toutes les fonctionnalités premium
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              <Calendar className="inline-block h-4 w-4 mr-1" />
              Environ 1 minute
            </div>
          </div>
        );

      case 1: // Entreprise - SIRET optionnel
        return (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nom de l'entreprise *</Label>
              <Input
                id="companyName"
                value={billingInfo.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder="Hôtel Le Magnifique SAS"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siret">SIRET (optionnel pendant l'essai)</Label>
              <Input
                id="siret"
                value={billingInfo.siret}
                onChange={(e) => updateField('siret', e.target.value.replace(/\D/g, '').slice(0, 14))}
                placeholder="12345678901234"
                maxLength={14}
              />
              <p className="text-xs text-muted-foreground">Sera demandé à la fin de l'essai pour la facturation</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tvaNumber">Numéro TVA intracommunautaire (optionnel)</Label>
              <Input
                id="tvaNumber"
                value={billingInfo.tvaNumber}
                onChange={(e) => updateField('tvaNumber', e.target.value.toUpperCase())}
                placeholder="FR12345678901"
              />
            </div>
          </div>
        );

      case 2: // Contact
        return (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Nom du contact *</Label>
              <Input
                id="contactName"
                value={billingInfo.contactName}
                onChange={(e) => updateField('contactName', e.target.value)}
                placeholder="Marie Dupont"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email de facturation</Label>
              <Input
                id="contactEmail"
                type="email"
                value={billingInfo.contactEmail}
                onChange={(e) => updateField('contactEmail', e.target.value)}
                placeholder="comptabilite@hotel.fr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                value={billingInfo.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+33 1 23 45 67 89"
              />
            </div>
          </div>
        );

      case 3: // Récapitulatif et essai
        return (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                <Check className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Tout est prêt !</h3>
                <p className="text-muted-foreground mt-2">
                  Votre période d'essai de 3 mois va commencer dès maintenant.
                </p>
              </div>
            </div>

            <Card className="border-primary/20 bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <h4 className="font-semibold">Récapitulatif</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entreprise</span>
                    <span className="font-medium">{billingInfo.companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contact</span>
                    <span className="font-medium">{billingInfo.contactName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Essai gratuit</span>
                    <span className="font-medium text-green-600">3 mois</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-center text-muted-foreground">
              À la fin de l'essai, vous serez invité à compléter les informations de facturation (SIRET, IBAN) et choisir un plan.
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
      <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()}>
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
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>

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
