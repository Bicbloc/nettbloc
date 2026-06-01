import { supabase } from '@/integrations/supabase/client';

export type UserType = 'establishment' | 'housekeeper' | 'governess' | 'technician';

interface ValidationResult {
  isValid: boolean;
  existingType: UserType | null;
  error: string | null;
}

const ERROR_MESSAGES: Record<UserType, string> = {
  establishment: "Cette adresse email est liée à un compte Établissement. Aucune redirection effectuée — utilisez une autre adresse ou connectez-vous sur l'interface Établissement.",
  housekeeper: "Cette adresse email est liée à un compte Femme de chambre (Housekeeper). Aucune redirection effectuée — utilisez une autre adresse ou connectez-vous sur l'interface Housekeeper.",
  governess: "Cette adresse email est liée à un compte Gouvernante. Aucune redirection effectuée — utilisez une autre adresse ou connectez-vous sur l'interface Gouvernante.",
  technician: "Cette adresse email est liée à un compte Technicien. Aucune redirection effectuée — utilisez une autre adresse ou connectez-vous sur l'interface Technicien."
};

/**
 * Vérifie si un email est déjà utilisé dans une autre interface
 * Utilise une fonction SECURITY DEFINER pour contourner les RLS
 */
export async function validateEmailForUserType(
  email: string, 
  intendedType: UserType
): Promise<ValidationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const { data, error } = await supabase.rpc('check_email_exists_for_role', {
      p_email: normalizedEmail
    });

    if (error) {
      console.error('Error checking email role:', error);
      // En cas d'erreur, on laisse passer pour ne pas bloquer
      return { isValid: true, existingType: null, error: null };
    }

    // data est un tableau de { found_in: string }
    if (data && Array.isArray(data) && data.length > 0) {
      // Chercher un rôle différent du type voulu
      const conflictingRole = data.find((row: any) => row.found_in !== intendedType);
      if (conflictingRole) {
        const existingType = conflictingRole.found_in as UserType;
        return {
          isValid: false,
          existingType,
          error: ERROR_MESSAGES[existingType] || "Cette adresse est déjà associée à un autre type de compte."
        };
      }

      // Si l'email existe déjà pour le même type, c'est OK (re-inscription)
      const sameType = data.find((row: any) => row.found_in === intendedType);
      if (sameType) {
        return {
          isValid: false,
          existingType: intendedType,
          error: `Un compte ${intendedType} existe déjà avec cette adresse. Connectez-vous plutôt.`
        };
      }
    }

    return { isValid: true, existingType: null, error: null };
  } catch (error: any) {
    console.error('Error validating email type:', error);
    return { isValid: true, existingType: null, error: null };
  }
}

/**
 * Vérifie qu'un utilisateur connecté accède à la bonne interface
 * Utilise la fonction SECURITY DEFINER pour contourner les RLS
 */
export async function validateUserAccessToInterface(
  email: string,
  currentInterface: UserType
): Promise<{ allowed: boolean; correctInterface: UserType | null }> {
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const rpcPromise = supabase.rpc('check_email_exists_for_role', {
      p_email: normalizedEmail
    });
    // Filet de sécurité: ne jamais bloquer l'écran si la requête traîne
    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 8000)
    );
    const { data, error } = (await Promise.race([rpcPromise, timeoutPromise])) as any;

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      // Aucun profil trouvé - nouvel utilisateur, autoriser
      return { allowed: true, correctInterface: null };
    }

    const priority: UserType[] = ['establishment', 'housekeeper', 'governess', 'technician'];
    const foundRoles = Array.from(new Set(data.map((row: any) => row.found_in as UserType)));

    // Si l'interface courante fait partie des rôles détectés, on l'autorise.
    // Cela évite de bloquer les utilisateurs multi-profils sur une priorité arbitraire.
    if (foundRoles.includes(currentInterface)) {
      return {
        allowed: true,
        correctInterface: currentInterface
      };
    }
    
    const primaryRole = priority.find(role => foundRoles.includes(role)) || foundRoles[0];

    return {
      allowed: primaryRole === currentInterface,
      correctInterface: primaryRole
    };
  } catch (error) {
    console.error('Error validating interface access:', error);
    return { allowed: true, correctInterface: null };
  }
}

/**
 * Messages indiquant à quel type de compte l'email est lié.
 * Pas de redirection automatique : on informe seulement l'utilisateur.
 */
export function getRedirectMessage(correctInterface: UserType, language: 'fr' | 'en' = 'fr'): string {
  const messages: Record<UserType, { fr: string; en: string }> = {
    establishment: {
      fr: "Cette adresse email est liée à un compte Établissement. Aucune redirection effectuée — utilisez l'interface correspondante pour vous connecter.",
      en: "This email is linked to an Establishment account. No redirection performed — please use the matching interface to sign in."
    },
    housekeeper: {
      fr: "Cette adresse email est liée à un compte Femme de chambre (Housekeeper). Aucune redirection effectuée — utilisez l'interface correspondante pour vous connecter.",
      en: "This email is linked to a Housekeeper account. No redirection performed — please use the matching interface to sign in."
    },
    governess: {
      fr: "Cette adresse email est liée à un compte Gouvernante. Aucune redirection effectuée — utilisez l'interface correspondante pour vous connecter.",
      en: "This email is linked to a Governess account. No redirection performed — please use the matching interface to sign in."
    },
    technician: {
      fr: "Cette adresse email est liée à un compte Technicien. Aucune redirection effectuée — utilisez l'interface correspondante pour vous connecter.",
      en: "This email is linked to a Technician account. No redirection performed — please use the matching interface to sign in."
    }
  };
  
  return messages[correctInterface][language];
}

/**
 * Retourne l'URL de redirection pour un type d'utilisateur
 */
export function getInterfaceUrl(userType: UserType): string {
  const urls: Record<UserType, string> = {
    establishment: '/auth/establishment',
    housekeeper: '/housekeeper/auth',
    governess: '/governess/auth',
    technician: '/technician/login'
  };
  
  return urls[userType];
}
