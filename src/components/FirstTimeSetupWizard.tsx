import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Users, 
  Settings, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Copy, 
  Link, 
  UserPlus,
  Building,
  Sparkles,
  AlertCircle,
  MinusSquare,
  PlusSquare,
  LogOut
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { CleaningConfig, getDefaultCleaningConfig } from '@/services/pdfService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FirstTimeSetupWizardProps {
  isOpen: boolean;
  onComplete: (config: CleaningConfig) => void;
  hotelCode: string;
  hotelId: string;
  isPremium?: boolean;
}

const SETUP_STORAGE_KEY = 'hotel_setup_completed';

export const FirstTimeSetupWizard = ({ 
  isOpen, 
  onComplete, 
  hotelCode, 
  hotelId,
  isPremium = false 
}: FirstTimeSetupWizardProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<CleaningConfig>(getDefaultCleaningConfig(isPremium));
  const [isValid, setIsValid] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const housekeeperLink = `${window.location.origin}/housekeeper-signup`;

  // Validation des champs
  useEffect(() => {
    const isConfigValid = 
      config.fullCleaningTime > 0 && 
      config.quickCleaningTime > 0 &&
      config.minRoomsPerHousekeeper > 0 &&
      config.maxRoomsPerHousekeeper > 0 &&
      config.maxRoomsPerHousekeeper >= config.minRoomsPerHousekeeper;
    
    setIsValid(isConfigValid);
  }, [config]);

  const steps = [
    {
      id: 'welcome',
      title: 'Bienvenue !',
      icon: Sparkles,
      description: 'Configurez votre établissement en quelques étapes'
    },
    {
      id: 'cleaning-times',
      title: 'Temps de nettoyage',
      icon: Clock,
      description: 'Définissez les durées moyennes de nettoyage'
    },
    {
      id: 'room-limits',
      title: 'Limites chambres',
      icon: Settings,
      description: 'Nombre de chambres par femme de chambre'
    },
    {
      id: 'team-setup',
      title: 'Votre équipe',
      icon: Users,
      description: 'Comment ajouter vos femmes de chambre'
    }
  ];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(hotelCode);
      toast({ description: "Code copié dans le presse-papier !" });
    } catch {
      toast({ variant: "destructive", description: "Erreur lors de la copie" });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(housekeeperLink);
      toast({ description: "Lien copié dans le presse-papier !" });
    } catch {
      toast({ variant: "destructive", description: "Erreur lors de la copie" });
    }
  };

  const incrementValue = (field: keyof CleaningConfig) => {
    setConfig(prev => ({ ...prev, [field]: (prev[field] as number) + 1 }));
  };

  const decrementValue = (field: keyof CleaningConfig) => {
    setConfig(prev => {
      const currentValue = prev[field] as number;
      if (currentValue > 1) {
        return { ...prev, [field]: currentValue - 1 };
      }
      return prev;
    });
  };

  const handleComplete = async (goToTraining = false) => {
    if (!isValid) {
      toast({ 
        variant: "destructive", 
        description: "Veuillez remplir tous les champs correctement" 
      });
      return;
    }

    // Sauvegarder la configuration dans les settings de l'hôtel
    try {
      const settingsData: Record<string, any> = {
        cleaning_config: {
          fullCleaningTime: config.fullCleaningTime,
          quickCleaningTime: config.quickCleaningTime,
          minRoomsPerHousekeeper: config.minRoomsPerHousekeeper,
          maxRoomsPerHousekeeper: config.maxRoomsPerHousekeeper
        },
        setup_completed: true,
        setup_completed_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('hotels')
        .update({ settings: settingsData })
        .eq('id', hotelId);

      if (error) throw error;

      // Marquer comme complété localement aussi
      localStorage.setItem(`${SETUP_STORAGE_KEY}_${hotelId}`, 'true');
      
      toast({ 
        title: "Configuration terminée !",
        description: "Votre établissement est prêt à être utilisé" 
      });
      
      onComplete(config);

      // Proposer immédiatement d'entraîner l'import PDF
      if (goToTraining) {
        window.dispatchEvent(new CustomEvent('navigate-to-training'));
      }
    } catch (error) {
      console.error('Erreur sauvegarde config:', error);
      toast({ 
        variant: "destructive", 
        description: "Erreur lors de la sauvegarde" 
      });
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return config.fullCleaningTime > 0 && config.quickCleaningTime > 0;
    }
    if (currentStep === 2) {
      return config.minRoomsPerHousekeeper > 0 && 
             config.maxRoomsPerHousekeeper > 0 &&
             config.maxRoomsPerHousekeeper >= config.minRoomsPerHousekeeper;
    }
    return true;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center">
                <Building className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Configuration initiale</h3>
                <p className="text-muted-foreground mt-2">
                  Avant de commencer, nous avons besoin de quelques informations pour optimiser la gestion de votre établissement.
                </p>
              </div>
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-primary">Configuration obligatoire</p>
                    <p className="text-muted-foreground mt-1">
                      Ces paramètres sont nécessaires pour calculer correctement la répartition des chambres entre vos femmes de chambre.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Environ 2 minutes</span>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Temps de nettoyage "Départ" (à blanc)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Durée moyenne pour nettoyer une chambre après le départ d'un client
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => decrementValue("fullCleaningTime")}
                  >
                    <MinusSquare className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">
                    <Input 
                      type="number" 
                      value={config.fullCleaningTime}
                      onChange={e => setConfig(prev => ({ 
                        ...prev, 
                        fullCleaningTime: parseInt(e.target.value) || 0 
                      }))}
                      className="text-center text-lg font-semibold"
                      min={1}
                    />
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => incrementValue("fullCleaningTime")}
                  >
                    <PlusSquare className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground w-20">minutes</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Temps de "Recouche"
                </Label>
                <p className="text-sm text-muted-foreground">
                  Durée moyenne pour rafraîchir une chambre occupée (client qui reste)
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => decrementValue("quickCleaningTime")}
                  >
                    <MinusSquare className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">
                    <Input 
                      type="number" 
                      value={config.quickCleaningTime}
                      onChange={e => setConfig(prev => ({ 
                        ...prev, 
                        quickCleaningTime: parseInt(e.target.value) || 0 
                      }))}
                      className="text-center text-lg font-semibold"
                      min={1}
                    />
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => incrementValue("quickCleaningTime")}
                  >
                    <PlusSquare className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground w-20">minutes</span>
                </div>
              </div>
            </div>

            {(!config.fullCleaningTime || !config.quickCleaningTime) && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span>Veuillez renseigner les deux durées pour continuer</span>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Minimum de chambres par personne
                </Label>
                <p className="text-sm text-muted-foreground">
                  Nombre minimum de chambres à attribuer à chaque femme de chambre
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => decrementValue("minRoomsPerHousekeeper")}
                  >
                    <MinusSquare className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">
                    <Input 
                      type="number" 
                      value={config.minRoomsPerHousekeeper}
                      onChange={e => setConfig(prev => ({ 
                        ...prev, 
                        minRoomsPerHousekeeper: parseInt(e.target.value) || 0 
                      }))}
                      className="text-center text-lg font-semibold"
                      min={1}
                    />
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => incrementValue("minRoomsPerHousekeeper")}
                  >
                    <PlusSquare className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground w-20">chambres</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Maximum de chambres par personne
                </Label>
                <p className="text-sm text-muted-foreground">
                  Nombre maximum de chambres à attribuer à chaque femme de chambre
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => decrementValue("maxRoomsPerHousekeeper")}
                  >
                    <MinusSquare className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">
                    <Input 
                      type="number" 
                      value={config.maxRoomsPerHousekeeper}
                      onChange={e => setConfig(prev => ({ 
                        ...prev, 
                        maxRoomsPerHousekeeper: parseInt(e.target.value) || 0 
                      }))}
                      className="text-center text-lg font-semibold"
                      min={1}
                    />
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    onClick={() => incrementValue("maxRoomsPerHousekeeper")}
                  >
                    <PlusSquare className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground w-20">chambres</span>
                </div>
              </div>
            </div>

            {config.maxRoomsPerHousekeeper < config.minRoomsPerHousekeeper && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span>Le maximum doit être supérieur ou égal au minimum</span>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center mb-4">
              <p className="text-muted-foreground">
                Choisissez comment ajouter vos femmes de chambre à l'application
              </p>
            </div>

            {/* Option 1: Invitation avec code */}
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Link className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      Inviter via le code établissement
                      <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Accès complet à l'interface mobile
                    </p>
                  </div>
                </div>

                <div className="space-y-3 bg-background/50 p-3 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Code de votre établissement</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 font-mono text-lg font-bold bg-background p-2 rounded border text-center">
                        {hotelCode}
                      </div>
                      <Button size="icon" variant="outline" onClick={handleCopyCode}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Lien d'inscription</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={housekeeperLink} 
                        readOnly 
                        className="text-xs font-mono"
                      />
                      <Button size="icon" variant="outline" onClick={handleCopyLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Envoyez ce lien et le code à vos femmes de chambre. Elles pourront créer leur compte et accéder à leur planning sur leur téléphone.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Option 2: Ajout manuel */}
            <Card className="border border-muted">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Ajout manuel</h4>
                    <p className="text-sm text-muted-foreground">
                      Pour une gestion simplifiée sans accès mobile
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <div className="flex items-start gap-2 text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Les femmes de chambre ajoutées manuellement <strong>n'auront pas accès</strong> à l'interface mobile. Vous gérerez leur planning depuis cette interface.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Vous pourrez ajouter des femmes de chambre manuellement depuis l'onglet "Vue d'ensemble" après la configuration.
                </p>
              </CardContent>
            </Card>

            {/* Proposition: entraîner l'import PDF */}
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Entraîner l'import PDF</h4>
                    <p className="text-sm text-muted-foreground">
                      Apprenez à l'IA à lire votre PDF de réservations pour importer vos chambres automatiquement.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommandé dès maintenant : cliquez sur « Terminer et entraîner le PDF » ci-dessous.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} modal>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {steps[currentStep]?.icon && (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {(() => {
                  const Icon = steps[currentStep].icon;
                  return <Icon className="h-5 w-5 text-primary" />;
                })()}
              </div>
            )}
            <div>
              <DialogTitle>{steps[currentStep]?.title}</DialogTitle>
              <DialogDescription>
                {steps[currentStep]?.description}
              </DialogDescription>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="space-y-2 pt-2">
            <Progress value={((currentStep + 1) / steps.length) * 100} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Étape {currentStep + 1} sur {steps.length}</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
            </div>
          </div>
        </DialogHeader>

        {renderStepContent()}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="ghost"
            onClick={handleLogout}
            className="w-full sm:w-auto text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Déconnexion
          </Button>

          {currentStep > 0 && (
            <Button 
              variant="outline" 
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
          )}
          
          {currentStep < steps.length - 1 ? (
            <Button 
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="w-full sm:w-auto"
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={() => handleComplete(false)}
                disabled={!isValid}
                className="w-full sm:w-auto"
              >
                <Check className="h-4 w-4 mr-1" />
                Terminer la configuration
              </Button>
              <Button 
                onClick={() => handleComplete(true)}
                disabled={!isValid}
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Terminer et entraîner le PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Hook pour vérifier si le setup est complété
export const useFirstTimeSetup = (hotelId: string | null) => {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSetupStatus = async () => {
      if (!hotelId) {
        setLoading(false);
        return;
      }

      try {
        // Vérifier d'abord dans localStorage
        const localSetup = localStorage.getItem(`${SETUP_STORAGE_KEY}_${hotelId}`);
        if (localSetup === 'true') {
          setNeedsSetup(false);
          setLoading(false);
          return;
        }

        // Vérifier dans la base de données
        const { data, error } = await supabase
          .from('hotels')
          .select('settings')
          .eq('id', hotelId)
          .single();

        if (error) {
          console.error('Erreur vérification setup:', error);
          setNeedsSetup(true);
        } else {
          const settings = data?.settings as any;
          const setupCompleted = settings?.setup_completed === true;
          setNeedsSetup(!setupCompleted);
          
          // Synchroniser localStorage
          if (setupCompleted) {
            localStorage.setItem(`${SETUP_STORAGE_KEY}_${hotelId}`, 'true');
          }
        }
      } catch (error) {
        console.error('Erreur checkSetupStatus:', error);
        setNeedsSetup(true);
      } finally {
        setLoading(false);
      }
    };

    checkSetupStatus();
  }, [hotelId]);

  return { needsSetup, loading };
};
