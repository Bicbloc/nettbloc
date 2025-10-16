import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import BackButton from '@/components/BackButton';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Building, Users, Shield, UserCheck, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const { signIn, signUp, isAuthenticated, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle password reset from URL and hash
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Check for recovery tokens in the URL hash (from email link)
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    
    if (accessToken && refreshToken && type === 'recovery') {
      // Set the session with the recovery tokens
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ error }) => {
        if (error) {
          console.error('Error setting session:', error);
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Lien de récupération invalide ou expiré."
          });
        } else {
          setIsPasswordReset(true);
          // Clear the hash to clean the URL
          window.history.replaceState({}, '', '/auth');
          toast({
            title: "Récupération activée",
            description: "Vous pouvez maintenant définir un nouveau mot de passe."
          });
        }
      });
    }
    
    // Handle the old reset parameter for backward compatibility
    const isReset = urlParams.get('reset') === 'true';
    if (isReset && !accessToken) {
      window.history.replaceState({}, '', '/auth');
      toast({
        title: "Email envoyé",
        description: "Vérifiez votre email et cliquez sur le lien de récupération."
      });
    }
  }, []);

  // Check for forced access parameter
  const urlParams = new URLSearchParams(window.location.search);
  const forceAuth = urlParams.get('force') === 'true';

  // Redirect if already authenticated (unless forced)
  if (!loading && isAuthenticated && !forceAuth) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signIn(formData.email, formData.password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message
      });
    } else {
      toast({
        title: "Connexion réussie",
        description: "Vous êtes maintenant connecté."
      });
      
        // Vérifier si l'utilisateur a déjà un plan configuré
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('plan, subscription_type')
            .eq('id', (await supabase.auth.getUser()).data.user?.id)
            .single();
          
          // Toujours rediriger vers l'accueil - plus de sélection de plan forcée
          navigate('/');
        } catch (error) {
          // En cas d'erreur, rediriger vers l'accueil aussi
          navigate('/');
        }
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le nom de l'entreprise est obligatoire."
      });
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas."
      });
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await signUp(formData.email, formData.password, formData.companyName);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message
      });
    } else {
      toast({
        title: "Compte créé avec succès",
        description: "Vous êtes maintenant connecté."
      });
      
      // Pour les nouveaux comptes, toujours rediriger vers la sélection de plan
      navigate('/plan-selection');
    }
    
    setIsLoading(false);
  };

  const handleGuestMode = () => {
    navigate('/guest');
  };

  const handleHousekeeperAccess = () => {
    navigate('/housekeeper/login');
  };


  const handlePasswordReset = async () => {
    if (!formData.email.trim()) {
      toast({
        variant: "destructive",
        title: "Email requis",
        description: "Veuillez saisir votre email avant de demander une réinitialisation."
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Email envoyé",
        description: "Un email de réinitialisation a été envoyé à votre adresse."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'email de réinitialisation."
      });
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmNewPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas."
      });
      return;
    }

    if (formData.newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères."
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été changé avec succès."
      });

      setIsPasswordReset(false);
      setFormData(prev => ({ ...prev, newPassword: '', confirmNewPassword: '' }));
      navigate('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le mot de passe."
      });
    }

    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-4 text-muted-foreground">Vérification de l'authentification...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4 relative">
      <div className="absolute top-4 left-4">
        <BackButton to="/" />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Building className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-3xl font-bold">Nettobloc</h1>
          <p className="text-muted-foreground">Gestion hôtelière simplifiée</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isPasswordReset ? (
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Nouveau mot de passe
                </div>
              ) : (
                "Bienvenue"
              )}
            </CardTitle>
            <CardDescription>
              {isPasswordReset ? 
                "Définissez votre nouveau mot de passe" :
                isAuthenticated && forceAuth ? 
                  "Vous êtes déjà connecté. Vous pouvez vous déconnecter ou changer de compte." :
                  "Connectez-vous ou créez un compte pour gérer vos hôtels"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPasswordReset ? (
              // Interface de changement de mot de passe
              <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={formData.newPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirmer le nouveau mot de passe</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="Répétez le nouveau mot de passe"
                    value={formData.confirmNewPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mettre à jour le mot de passe
                </Button>
                <div className="text-center">
                  <Button 
                    variant="link" 
                    type="button"
                    onClick={() => {
                      setIsPasswordReset(false);
                      setFormData(prev => ({ ...prev, newPassword: '', confirmNewPassword: '' }));
                    }}
                    className="text-sm text-muted-foreground"
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {isAuthenticated && forceAuth && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 mb-2">Vous êtes déjà connecté.</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        toast({
                          title: "Déconnexion réussie",
                          description: "Vous pouvez maintenant vous reconnecter."
                        });
                      }}
                    >
                      Se déconnecter
                    </Button>
                  </div>
                )}
                <Tabs defaultValue="signin" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Mot de passe</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Se connecter
                  </Button>
                  <div className="text-center">
                    <Button 
                      variant="link" 
                      type="button"
                      onClick={handlePasswordReset}
                      className="text-sm text-muted-foreground"
                    >
                      Mot de passe oublié ?
                    </Button>
                  </div>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-company">Nom de l'entreprise *</Label>
                    <Input
                      id="signup-company"
                      placeholder="Mon Hôtel"
                      value={formData.companyName}
                      onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Obligatoire pour créer votre hôtel et gérer votre compte
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirmer le mot de passe</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer un compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Ou continuer sans compte :</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleGuestMode}
                  type="button"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Mode invité (pas de sauvegarde)
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  En mode invité, vos données ne seront pas sauvegardées et seront réinitialisées à chaque session.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCheck className="h-4 w-4" />
                  <span>Accès personnel de ménage :</span>
                </div>
                <Button 
                  variant="secondary" 
                  className="w-full" 
                  onClick={handleHousekeeperAccess}
                  type="button"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Accès Femme de Chambre
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Interface dédiée pour le personnel de ménage avec code d'accès.
                </p>
              </div>
            </div>
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;