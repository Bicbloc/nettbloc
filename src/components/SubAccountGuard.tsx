import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Mail, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SubAccountGuardProps {
  children: React.ReactNode;
  /** Description de la fonctionnalité restreinte */
  featureName?: string;
}

/**
 * Bloque l'accès aux sous-comptes pour certaines fonctionnalités
 * et affiche l'email de l'administrateur parent
 */
export const SubAccountGuard: React.FC<SubAccountGuardProps> = ({ 
  children, 
  featureName = 'cette fonctionnalité' 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubAccount, setIsSubAccount] = useState<boolean | null>(null);
  const [parentEmail, setParentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubAccountStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Vérifier si c'est un sous-compte via les métadonnées auth
        const isSubAccountFlag = user.user_metadata?.is_sub_account === true;
        setIsSubAccount(isSubAccountFlag);

        if (isSubAccountFlag) {
          // Récupérer l'email de l'admin parent via sub_accounts
          const { data: subAccountData, error } = await supabase
            .from('sub_accounts')
            .select('parent_user_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!error && subAccountData?.parent_user_id) {
            // Récupérer l'email du parent via la table profiles
            const { data: parentProfile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', subAccountData.parent_user_id)
              .maybeSingle();

            if (parentProfile?.email) {
              setParentEmail(parentProfile.email);
            }
          }
        }
      } catch (error) {
        console.error('Erreur vérification sous-compte:', error);
        setIsSubAccount(false);
      } finally {
        setLoading(false);
      }
    };

    checkSubAccountStatus();
  }, [user]);

  // Chargement
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si c'est un sous-compte, bloquer l'accès
  if (isSubAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <ShieldAlert className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-xl">Accès restreint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Vous n'avez pas accès à <strong>{featureName}</strong> en tant que sous-compte.
            </p>
            
            <p className="text-sm text-muted-foreground">
              Pour modifier ces paramètres, veuillez contacter l'administrateur de votre compte.
            </p>

            {parentEmail && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Administrateur du compte :
                </p>
                <a 
                  href={`mailto:${parentEmail}`}
                  className="flex items-center justify-center gap-2 text-primary hover:underline font-medium"
                >
                  <Mail className="h-4 w-4" />
                  {parentEmail}
                </a>
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au tableau de bord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si ce n'est pas un sous-compte, afficher le contenu normalement
  return <>{children}</>;
};

export default SubAccountGuard;
