import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2, ArrowRight, Crown, UserPlus, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRecovery } from '@/integrations/supabase/recoveryClient';
import BackButton from '@/components/BackButton';
import { validateEmailForUserType, validateUserAccessToInterface, getRedirectMessage } from '@/services/userTypeValidationService';
import { PASSWORD_RESET_URL, APP_ORIGIN } from '@/constants/appUrl';

export default function GovernessAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Vérifier si déjà connecté avec un profil gouvernante valide
    const profile = localStorage.getItem('governess_profile');
    if (profile && !isRecoveryMode) {
      // Vérifier que la session Supabase est aussi active
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          navigate('/governess/hotels');
        } else {
          // Session expirée, nettoyer le profil local
          localStorage.removeItem('governess_profile');
        }
      });
    }
  }, [navigate, isRecoveryMode]);

  // Detect recovery mode from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const hash = window.location.hash;

    if (code) {
      // PKCE flow - exchange code for session
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (!error && data.session) {
          setIsRecoveryMode(true);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    } else if (hash.includes('type=recovery')) {
      setIsRecoveryMode(true);
    }
  }, []);

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email requis",
        description: "Veuillez entrer votre email"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabaseRecovery.auth.resetPasswordForEmail(email, {
        redirectTo: PASSWORD_RESET_URL,
      });

      if (error) throw error;

      toast({
        title: "Email envoyé !",
        description: "Vérifiez votre boîte de réception pour le lien de réinitialisation"
      });
      setIsRequestingReset(false);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      toast({
        title: "Mot de passe mis à jour !",
        description: "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe"
      });
      setIsRecoveryMode(false);
      setNewPassword('');
    } catch (error: any) {
      console.error('Update password error:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir tous les champs"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Vérifier que l'email est bien un compte gouvernante
      const accessCheck = await validateUserAccessToInterface(email, 'governess');
      if (!accessCheck.allowed && accessCheck.correctInterface) {
        toast({
          variant: "destructive",
          title: "Mauvaise interface",
          description: getRedirectMessage(accessCheck.correctInterface, 'fr')
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // Chercher le profil gouvernante
        const { data: profileData, error: profileError } = await supabase
          .from('governess_profiles')
          .select('*')
          .eq('email', data.user.email)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profileData) {
          // Nettoyer les profils d'autres rôles pour éviter les conflits
          localStorage.removeItem('housekeeper_profile');
          localStorage.removeItem('technician_profile');
          localStorage.setItem('governess_profile', JSON.stringify(profileData));
          
          toast({
            title: "Connexion réussie",
            description: `Bienvenue ${profileData.name}`
          });
          navigate('/governess/hotels');
        } else {
          throw new Error("Profil gouvernante non trouvé. Créez d'abord un compte.");
        }
      }
    } catch (error: any) {
      console.error('Erreur connexion:', error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message === "Invalid login credentials" 
          ? "Email ou mot de passe incorrect" 
          : error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !name) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir tous les champs"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Vérifier que l'email n'est pas déjà utilisé sur une autre interface
      const validation = await validateEmailForUserType(email, 'governess');
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: "Email déjà utilisé",
          description: validation.error || "Cette adresse est déjà associée à un autre type de compte."
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${APP_ORIGIN}/governess/auth`,
          data: { name }
        }
      });

      if (error) throw error;

      // Vérifier si c'est un utilisateur déjà existant (user_repeated_signup)
      if (data.user?.identities && data.user.identities.length === 0) {
        throw new Error("Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.");
      }

      // Créer le profil gouvernante avec l'ID auth
      const { error: profileError } = await supabase
        .from('governess_profiles')
        .upsert({
          id: data.user?.id,
          email: email.trim().toLowerCase(),
          name,
          is_active: true
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('Erreur création profil:', profileError);
      }

      // Si pas de session = email de confirmation requis
      if (!data.session) {
        toast({
          title: "📧 Vérifiez votre boîte mail",
          description: "Un email de confirmation a été envoyé. Cliquez sur le lien pour activer votre compte. Vérifiez aussi vos spams.",
          duration: 10000,
        });
      } else {
        // Session immédiate (confirmation email désactivée)
        localStorage.removeItem('housekeeper_profile');
        localStorage.removeItem('technician_profile');
        localStorage.setItem('governess_profile', JSON.stringify({ id: data.user?.id, email, name, is_active: true }));
        toast({
          title: "Inscription réussie !",
          description: `Bienvenue ${name}`
        });
        navigate('/governess/hotels');
        return;
      }
      setIsSignup(false);

    } catch (error: any) {
      console.error('Erreur inscription:', error);
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Recovery mode - show new password form
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-600 to-red-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 shadow-2xl border border-white/30">
              <KeyRound className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Nouveau mot de passe</h1>
            <p className="text-white/80">Entrez votre nouveau mot de passe</p>
          </div>

          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    Nouveau mot de passe
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                <Button
                  onClick={handleUpdatePassword}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Mise à jour...
                    </>
                  ) : (
                    "Mettre à jour le mot de passe"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Request reset mode
  if (isRequestingReset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-600 to-red-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl" />
        </div>

        <div className="absolute top-4 left-4 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsRequestingReset(false)} 
            className="text-white hover:bg-white/20"
          >
            <ArrowRight className="h-5 w-5 rotate-180" />
          </Button>
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 shadow-2xl border border-white/30">
              <Mail className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Mot de passe oublié</h1>
            <p className="text-white/80">Entrez votre email pour recevoir un lien</p>
          </div>

          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail" className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Adresse email
                  </Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    placeholder="exemple@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                <Button
                  onClick={handlePasswordReset}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Envoi...
                    </>
                  ) : (
                    "Envoyer le lien"
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setIsRequestingReset(false)}
                  className="w-full"
                >
                  Retour à la connexion
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-600 to-red-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-4 left-4 z-10">
        <BackButton 
          to="/auth" 
          variant="secondary"
          className="bg-white/90 hover:bg-white text-gray-800 shadow-md backdrop-blur-sm" 
        />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Header section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 shadow-2xl border border-white/30">
            <Crown className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Espace Gouvernante</h1>
          <p className="text-white/80">Gérez les inspections et les incidents</p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-center flex items-center justify-center gap-2">
              <Crown className="h-5 w-5 text-amber-600" />
              {isSignup ? "Créer un compte" : "Connexion"}
            </CardTitle>
            <CardDescription className="text-center">
              {isSignup 
                ? "Inscrivez-vous pour accéder à l'interface" 
                : "Entrez vos identifiants pour continuer"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-5">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                    Votre nom
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Prénom Nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 text-base"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Adresse email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemple@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                />
              </div>

              {!isSignup && (
                <div className="text-right">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setIsRequestingReset(true)}
                    className="text-amber-600 hover:text-amber-700 p-0 h-auto font-normal"
                  >
                    Mot de passe oublié ?
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-lg transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {isSignup ? "Inscription..." : "Connexion..."}
                  </>
                ) : (
                  <>
                    {isSignup ? "S'inscrire" : "Se connecter"}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button
                variant="link"
                onClick={() => setIsSignup(!isSignup)}
                className="text-amber-600 hover:text-amber-700"
              >
                {isSignup ? (
                  <>Déjà un compte ? Se connecter</>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Créer un nouveau compte
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-white/60 text-xs mt-6">
          Interface réservée aux gouvernantes
        </p>
      </div>
    </div>
  );
}
