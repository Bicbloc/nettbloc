import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type UserType = 'establishment' | 'housekeeper' | 'governess' | 'technician' | null;

interface UserTypeGuardResult {
  userType: UserType;
  isLoading: boolean;
  isVerified: boolean;
}

const INTERFACE_ROUTES: Record<Exclude<UserType, null>, string> = {
  establishment: '/',
  housekeeper: '/housekeeper/hotels',
  governess: '/governess/hotels',
  technician: '/technician/dashboard'
};

const INTERFACE_NAMES: Record<Exclude<UserType, null>, { fr: string; en: string }> = {
  establishment: { fr: 'Établissement', en: 'Establishment' },
  housekeeper: { fr: 'Femme de chambre', en: 'Housekeeper' },
  governess: { fr: 'Gouvernante', en: 'Governess' },
  technician: { fr: 'Technicien', en: 'Technician' }
};

/**
 * Hook qui détermine le type d'utilisateur basé sur son profil
 * et force la redirection vers l'interface appropriée
 */
export function useUserTypeGuard(expectedType: Exclude<UserType, null>): UserTypeGuardResult {
  const { user, session, loading: authLoading, isInitialized } = useAuth();
  const navigate = useNavigate();
  const [userType, setUserType] = useState<UserType>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const hasCheckedRef = useRef(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Reset check when user changes
    if (!user) {
      hasCheckedRef.current = false;
      setUserType(null);
      setIsVerified(false);
      setIsLoading(false);
      return;
    }
  }, [user?.id]);

  useEffect(() => {
    // Wait for auth to be initialized
    if (!isInitialized || authLoading) {
      return;
    }

    // No user = no check needed
    if (!user || !session) {
      setIsLoading(false);
      return;
    }

    // Already checked for this user
    if (hasCheckedRef.current || isCheckingRef.current) {
      return;
    }

    const checkUserType = async () => {
      isCheckingRef.current = true;
      setIsLoading(true);

      try {
        const email = user.email?.trim().toLowerCase();
        if (!email) {
          setIsLoading(false);
          isCheckingRef.current = false;
          return;
        }


        // Check all profile types in parallel (including technicians and sub-accounts)
        const [hotelResult, subAccountResult, housekeeperResult, governessResult, technicianResult] = await Promise.all([
          supabase.from('hotels').select('id').eq('email', email).maybeSingle(),
          supabase.from('sub_accounts').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
          supabase.from('housekeeper_profiles').select('id').eq('email', email).maybeSingle(),
          supabase.from('governess_profiles').select('id').eq('email', email).maybeSingle(),
          supabase.from('technician_profiles').select('id').eq('email', email).maybeSingle()
        ]);

        // Build a set of all matching role types
        const matchingTypes: UserType[] = [];
        if (hotelResult.data || subAccountResult.data) matchingTypes.push('establishment');
        if (technicianResult.data) matchingTypes.push('technician');
        if (housekeeperResult.data) matchingTypes.push('housekeeper');
        if (governessResult.data) matchingTypes.push('governess');

        let detectedType: UserType = null;

        // If the expected type is among the matching types, respect it (no redirect)
        if (matchingTypes.includes(expectedType)) {
          detectedType = expectedType;
        } else if (matchingTypes.length > 0) {
          // User has profiles but NOT the expected one - use priority order
          detectedType = matchingTypes[0]; // establishment > technician > housekeeper > governess
        }


        setUserType(detectedType);
        hasCheckedRef.current = true;

        // If detected type doesn't match expected, redirect
        if (detectedType && detectedType !== expectedType) {
          
          toast({
            variant: "destructive",
            title: "Accès non autorisé",
            description: `Votre compte est de type "${INTERFACE_NAMES[detectedType].fr}". Redirection vers la bonne interface...`
          });

          // Redirect after a short delay to show the toast
          setTimeout(() => {
            navigate(INTERFACE_ROUTES[detectedType], { replace: true });
          }, 1500);
          
          setIsVerified(false);
        } else {
          // User is accessing the correct interface
          setIsVerified(true);
        }
      } catch (error) {
        console.error('❌ Error checking user type:', error);
        // On error, allow access to prevent blocking
        setIsVerified(true);
      } finally {
        setIsLoading(false);
        isCheckingRef.current = false;
      }
    };

    checkUserType();
  }, [user, session, isInitialized, authLoading, expectedType, navigate]);

  // Re-check on visibility change (page comes back from background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && isInitialized) {
        // Force re-check after returning to page
        hasCheckedRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isInitialized]);

  return { userType, isLoading: isLoading || authLoading, isVerified };
}

interface UserTypeGuardProps {
  expectedType: Exclude<UserType, null>;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

/**
 * Composant wrapper qui bloque l'accès si le type d'utilisateur ne correspond pas
 */
export function UserTypeGuard({ 
  expectedType, 
  children, 
  loadingComponent 
}: UserTypeGuardProps) {
  const { isLoading, isVerified } = useUserTypeGuard(expectedType);

  if (isLoading) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-destructive/10">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-destructive border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
