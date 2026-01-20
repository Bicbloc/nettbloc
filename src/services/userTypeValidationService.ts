import { supabase } from '@/integrations/supabase/client';

export type UserType = 'establishment' | 'housekeeper' | 'governess' | 'technician';

interface ValidationResult {
  isValid: boolean;
  existingType: UserType | null;
  error: string | null;
}

/**
 * Vérifie si un email est déjà utilisé dans une autre interface
 * Chaque email ne peut être associé qu'à UNE SEULE interface
 */
export async function validateEmailForUserType(
  email: string, 
  intendedType: UserType
): Promise<ValidationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    // Vérifier dans les profils établissement (hotels table - user owns hotel)
    if (intendedType !== 'establishment') {
      const { data: hotelUser } = await supabase
        .from('hotels')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (hotelUser) {
        return {
          isValid: false,
          existingType: 'establishment',
          error: "Cette adresse email est déjà utilisée pour un compte établissement. Utilisez une autre adresse."
        };
      }
    }

    // Vérifier dans les profils femme de chambre
    if (intendedType !== 'housekeeper') {
      const { data: housekeeperProfile } = await supabase
        .from('housekeeper_profiles')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (housekeeperProfile) {
        return {
          isValid: false,
          existingType: 'housekeeper',
          error: "Cette adresse email est déjà utilisée pour un compte femme de chambre. Utilisez une autre adresse."
        };
      }
    }

    // Vérifier dans les profils gouvernante
    if (intendedType !== 'governess') {
      const { data: governessProfile } = await supabase
        .from('governess_profiles')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (governessProfile) {
        return {
          isValid: false,
          existingType: 'governess',
          error: "Cette adresse email est déjà utilisée pour un compte gouvernante. Utilisez une autre adresse."
        };
      }
    }

    // Vérifier dans les profils technicien (si la table existe)
    if (intendedType !== 'technician') {
      try {
        const { data: technicianProfile } = await supabase
          .from('technician_profiles' as any)
          .select('id, email')
          .eq('email', normalizedEmail)
          .maybeSingle();
        
        if (technicianProfile) {
          return {
            isValid: false,
            existingType: 'technician',
            error: "Cette adresse email est déjà utilisée pour un compte technicien. Utilisez une autre adresse."
          };
        }
      } catch {
        // Table might not exist, ignore
      }
    }

    return {
      isValid: true,
      existingType: null,
      error: null
    };
  } catch (error: any) {
    console.error('Error validating email type:', error);
    // En cas d'erreur, on laisse passer pour ne pas bloquer
    return {
      isValid: true,
      existingType: null,
      error: null
    };
  }
}

/**
 * Vérifie qu'un utilisateur connecté accède à la bonne interface
 */
export async function validateUserAccessToInterface(
  email: string,
  currentInterface: UserType
): Promise<{ allowed: boolean; correctInterface: UserType | null }> {
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    // Vérifier profil établissement
    const { data: hotelUser } = await supabase
      .from('hotels')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (hotelUser) {
      return {
        allowed: currentInterface === 'establishment',
        correctInterface: 'establishment'
      };
    }

    // Vérifier profil femme de chambre
    const { data: housekeeperProfile } = await supabase
      .from('housekeeper_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (housekeeperProfile) {
      return {
        allowed: currentInterface === 'housekeeper',
        correctInterface: 'housekeeper'
      };
    }

    // Vérifier profil gouvernante
    const { data: governessProfile } = await supabase
      .from('governess_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (governessProfile) {
      return {
        allowed: currentInterface === 'governess',
        correctInterface: 'governess'
      };
    }

    // Aucun profil trouvé - nouvel utilisateur
    return {
      allowed: true,
      correctInterface: null
    };
  } catch (error) {
    console.error('Error validating interface access:', error);
    return { allowed: true, correctInterface: null };
  }
}

/**
 * Messages d'erreur traduits pour redirection
 */
export function getRedirectMessage(correctInterface: UserType, language: 'fr' | 'en' = 'fr'): string {
  const messages: Record<UserType, { fr: string; en: string }> = {
    establishment: {
      fr: "Votre compte est un compte établissement. Veuillez vous connecter sur l'interface Établissement.",
      en: "Your account is an establishment account. Please log in through the Establishment interface."
    },
    housekeeper: {
      fr: "Votre compte est un compte femme de chambre. Veuillez vous connecter sur l'interface Équipe.",
      en: "Your account is a housekeeper account. Please log in through the Team interface."
    },
    governess: {
      fr: "Votre compte est un compte gouvernante. Veuillez vous connecter sur l'interface Gouvernante.",
      en: "Your account is a governess account. Please log in through the Governess interface."
    },
    technician: {
      fr: "Votre compte est un compte technicien. Veuillez vous connecter sur l'interface Technicien.",
      en: "Your account is a technician account. Please log in through the Technician interface."
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
