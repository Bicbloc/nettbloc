import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { storageService, type AppPortal } from '@/services/storageService';

export type UserType = AppPortal | null;

interface UserTypeGuardResult {
  userType: UserType;
  isLoading: boolean;
  isVerified: boolean;
  matchingTypes: AppPortal[];
  requiresPortalChoice: boolean;
}

const INTERFACE_NAMES: Record<AppPortal, string> = {
  establishment: 'Établissement',
  housekeeper: 'Femme de chambre',
  governess: 'Gouvernante',
  technician: 'Technicien',
};

/**
 * Hook qui détermine le type d'utilisateur basé sur son profil
 * et n'autorise l'accès qu'au portail explicitement choisi.
 */
export function useUserTypeGuard(expectedType: AppPortal): UserTypeGuardResult {
  const { user, session, loading: authLoading, isInitialized } = useAuth();
  const [userType, setUserType] = useState<UserType>(null);
  const [matchingTypes, setMatchingTypes] = useState<AppPortal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [requiresPortalChoice, setRequiresPortalChoice] = useState(false);
  const hasCheckedRef = useRef(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (!user) {
      hasCheckedRef.current = false;
      setUserType(null);
      setMatchingTypes([]);
      setRequiresPortalChoice(false);
      setIsVerified(false);
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isInitialized || authLoading) {
      return;
    }

    if (!user || !session) {
      setUserType(null);
      setMatchingTypes([]);
      setRequiresPortalChoice(false);
      setIsVerified(false);
      setIsLoading(false);
      return;
    }

    if (hasCheckedRef.current || isCheckingRef.current) {
      return;
    }

    const checkUserType = async () => {
      isCheckingRef.current = true;
      setIsLoading(true);

      try {
        const email = user.email?.trim().toLowerCase();
        if (!email) {
          setUserType(null);
          setMatchingTypes([]);
          setRequiresPortalChoice(false);
          setIsVerified(false);
          return;
        }

        const { data: roleRows, error: roleError } = await supabase.rpc('check_email_exists_for_role', {
          p_email: email,
        });

        if (roleError) {
          throw roleError;
        }

        const matchedTypes: AppPortal[] = Array.from(
          new Set(
            (roleRows ?? [])
              .map((row: any) => row.found_in as AppPortal | null)
              .filter((value): value is AppPortal => value !== null)
          )
        );

        const canRepairHousekeeperProfile =
          !matchedTypes.includes('housekeeper') &&
          expectedType === 'housekeeper' &&
          user.user_metadata?.user_type === 'housekeeper';

        if (canRepairHousekeeperProfile) {
          const fallbackName =
            user.user_metadata?.name?.trim() ||
            email.split('@')[0] ||
            'Femme de chambre';

          const { error: repairError } = await supabase
            .from('housekeeper_profiles')
            .upsert(
              {
                id: user.id,
                email,
                name: fallbackName,
                phone: user.user_metadata?.phone ?? null,
                is_active: true,
                total_rooms_cleaned: 0,
                total_hotels_worked: 0,
              },
              { onConflict: 'id' }
            );

          if (repairError) {
            console.error('❌ Error repairing housekeeper profile:', repairError);
          } else {
            matchedTypes.push('housekeeper');
          }
        }

        const rememberedPortal = storageService.getActivePortal();
        const needsExplicitChoice =
          expectedType === 'establishment' &&
          matchedTypes.length > 1 &&
          !rememberedPortal;

        setMatchingTypes(matchedTypes);
        setRequiresPortalChoice(needsExplicitChoice);
        hasCheckedRef.current = true;

        if (!needsExplicitChoice && matchedTypes.includes(expectedType)) {
          setUserType(expectedType);
          storageService.saveActivePortal(expectedType);
          setIsVerified(true);
          return;
        }

        if (matchedTypes.length === 1) {
          setUserType(matchedTypes[0]);
        } else {
          setUserType(null);
        }

        setIsVerified(false);
      } catch (error) {
        console.error('❌ Error checking user type:', error);
        setRequiresPortalChoice(false);
        setIsVerified(true);
      } finally {
        setIsLoading(false);
        isCheckingRef.current = false;
      }
    };

    void checkUserType();
  }, [authLoading, expectedType, isInitialized, session, user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && isInitialized) {
        hasCheckedRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitialized, user]);

  return {
    userType,
    matchingTypes,
    isLoading: isLoading || authLoading,
    isVerified,
    requiresPortalChoice,
  };
}

interface UserTypeGuardProps {
  expectedType: AppPortal;
  children: ReactNode;
  loadingComponent?: ReactNode;
}

/**
 * Composant wrapper qui bloque l'accès si le type d'utilisateur ne correspond pas.
 * Il ne redirige jamais automatiquement vers un autre portail.
 */
export function UserTypeGuard({ expectedType, children, loadingComponent }: UserTypeGuardProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isLoading, isVerified, userType, matchingTypes, requiresPortalChoice } = useUserTypeGuard(expectedType);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const detectedProfiles = matchingTypes.map((type) => INTERFACE_NAMES[type]).join(' • ');

  if (isLoading) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Vérification des accès...</p>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-destructive/10 p-4">
        <div className="w-full max-w-md rounded-2xl border bg-background/95 p-6 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              {requiresPortalChoice ? 'Choisissez votre espace' : 'Accès non confirmé'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {requiresPortalChoice
                ? "Plusieurs profils sont liés à cette session. Choisissez manuellement votre portail pour éviter toute redirection automatique."
                : userType
                  ? `Cette session n'est pas validée pour l'espace ${INTERFACE_NAMES[expectedType]}.`
                  : `Aucun accès ${INTERFACE_NAMES[expectedType].toLowerCase()} n'a été trouvé pour cette session.`}
            </p>
            {detectedProfiles && (
              <p className="text-xs text-muted-foreground">Profils détectés : {detectedProfiles}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate('/auth', { replace: true })}>
              Choisir un autre espace
            </Button>
            <Button variant="ghost" className="w-full sm:w-auto text-destructive hover:text-destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
