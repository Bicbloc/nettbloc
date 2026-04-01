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
...
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
...
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
            <Button 
              onClick={handleComplete}
              disabled={!isValid}
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80"
            >
              <Check className="h-4 w-4 mr-1" />
              Terminer la configuration
            </Button>
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
