import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2, UserPlus, Sparkles, Shield, ArrowRight, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRecovery } from '@/integrations/supabase/recoveryClient';
import BackButton from '@/components/BackButton';
import { retryQuery } from '@/services/queryUtils';
import { storageService } from '@/services/storageService';
import { useTranslation } from '@/contexts/LanguageContext';
import { PASSWORD_RESET_URL } from '@/constants/appUrl';

export default function HousekeeperAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { translations: t, language } = useTranslation();

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
        title: language === 'en' ? "Email required" : "Email requis",
        description: language === 'en' ? "Please enter your email" : "Veuillez entrer votre email"
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
        title: language === 'en' ? "Email sent!" : "Email envoyé !",
        description: language === 'en' 
          ? "Check your inbox for the reset link" 
          : "Vérifiez votre boîte de réception pour le lien de réinitialisation"
      });
      setIsRequestingReset(false);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        variant: "destructive",
        title: language === 'en' ? "Error" : "Erreur",
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
        title: language === 'en' ? "Password too short" : "Mot de passe trop court",
        description: language === 'en' 
          ? "Password must be at least 6 characters" 
          : "Le mot de passe doit contenir au moins 6 caractères"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: language === 'en' ? "Passwords don't match" : "Les mots de passe ne correspondent pas",
        description: language === 'en' 
          ? "Please make sure both passwords are identical" 
          : "Veuillez vous assurer que les deux mots de passe sont identiques"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      toast({
        title: language === 'en' ? "Password updated!" : "Mot de passe mis à jour !",
        description: language === 'en' 
          ? "You can now log in with your new password" 
          : "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe"
      });
      setIsRecoveryMode(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Update password error:', error);
      toast({
        variant: "destructive",
        title: language === 'en' ? "Error" : "Erreur",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!normalizedEmail || !password) {
      toast({
        variant: "destructive",
        title: t.auth.requiredFields,
        description: language === 'en' 
          ? "Please enter your email and password" 
          : "Veuillez remplir votre email et mot de passe"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) throw error;

      if (data.user) {
        let profileResult = await retryQuery(async () => {
          const profileQuery = supabase
            .from('housekeeper_profiles')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();
          return await profileQuery;
        });

        if (profileResult.error) {
          throw profileResult.error;
        }

        let profileData = profileResult.data;

        const canRepairProfile = !profileData && data.user.user_metadata?.user_type === 'housekeeper';

        if (canRepairProfile) {
          const fallbackName =
            data.user.user_metadata?.name?.trim() ||
            normalizedEmail.split('@')[0] ||
            'Femme de chambre';

          const { error: repairError } = await supabase
            .from('housekeeper_profiles')
            .upsert(
              {
                id: data.user.id,
                email: normalizedEmail,
                name: fallbackName,
                phone: data.user.user_metadata?.phone ?? null,
                is_active: true,
                total_rooms_cleaned: 0,
                total_hotels_worked: 0,
              },
              { onConflict: 'id' }
            );

          if (repairError) {
            throw repairError;
          }

          profileResult = await retryQuery(async () => {
            const profileQuery = supabase
              .from('housekeeper_profiles')
              .select('*')
              .eq('id', data.user.id)
              .maybeSingle();
            return await profileQuery;
          });

          if (profileResult.error) {
            throw profileResult.error;
          }

          profileData = profileResult.data;
        }

        if (profileData) {
          // Nettoyer les profils d'autres rôles pour éviter les conflits
          localStorage.removeItem('governess_profile');
          localStorage.removeItem('technician_profile');
          storageService.saveActivePortal('housekeeper');
          storageService.saveHousekeeperProfile({
            id: profileData.id,
            name: profileData.name,
            email: profileData.email,
          });
          localStorage.setItem('housekeeper_profile', JSON.stringify(profileData));
          
          toast({
            title: t.auth.loginSuccess,
            description: `${language === 'en' ? 'Welcome' : 'Bienvenue'} ${profileData.name}`
          });
          navigate('/housekeeper/hotels');
        } else {
          await supabase.auth.signOut();
          throw new Error(language === 'en'
            ? "This account is not linked to a housekeeper profile."
            : "Ce compte n'est pas lié à un profil femme de chambre.");
        }
      }
    } catch (error: any) {
      console.error('Erreur connexion:', error);
      toast({
        variant: "destructive",
        title: t.auth.loginError,
        description: error.message === "Invalid login credentials" 
          ? t.auth.invalidCredentials
          : error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Recovery mode - show new password form
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 shadow-2xl border border-white/30">
              <KeyRound className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {language === 'en' ? 'New Password' : 'Nouveau mot de passe'}
            </h1>
            <p className="text-white/80">
              {language === 'en' ? 'Enter your new password' : 'Entrez votre nouveau mot de passe'}
            </p>
          </div>

          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    {language === 'en' ? 'New password' : 'Nouveau mot de passe'}
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    {language === 'en' ? 'Confirm new password' : 'Confirmer le nouveau mot de passe'}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                <Button
                  onClick={handleUpdatePassword}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      {language === 'en' ? 'Updating...' : 'Mise à jour...'}
                    </>
                  ) : (
                    language === 'en' ? 'Confirm' : 'Valider'
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
      <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl" />
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
            <h1 className="text-3xl font-bold text-white mb-2">
              {language === 'en' ? 'Reset Password' : 'Mot de passe oublié'}
            </h1>
            <p className="text-white/80">
              {language === 'en' ? 'Enter your email to receive a reset link' : 'Entrez votre email pour recevoir un lien'}
            </p>
          </div>

          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail" className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {language === 'en' ? 'Email address' : 'Adresse email'}
                  </Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    placeholder={t.auth.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                <Button
                  onClick={handlePasswordReset}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      {language === 'en' ? 'Sending...' : 'Envoi...'}
                    </>
                  ) : (
                    language === 'en' ? 'Send reset link' : 'Envoyer le lien'
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setIsRequestingReset(false)}
                  className="w-full"
                >
                  {language === 'en' ? 'Back to login' : 'Retour à la connexion'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
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
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {language === 'en' ? 'Personal Space' : 'Espace Personnel'}
          </h1>
          <p className="text-white/80">
            {language === 'en' ? 'Log in to access your hotels' : 'Connectez-vous pour accéder à vos hôtels'}
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-center flex items-center justify-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {language === 'en' ? 'Secure login' : 'Connexion sécurisée'}
            </CardTitle>
            <CardDescription className="text-center">
              {language === 'en' ? 'Enter your credentials to continue' : 'Entrez vos identifiants pour continuer'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {language === 'en' ? 'Email address' : 'Adresse email'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.auth.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base bg-muted/50 border-muted-foreground/20 focus:border-primary focus:ring-primary"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  {t.common.password}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base bg-muted/50 border-muted-foreground/20 focus:border-primary focus:ring-primary"
                  autoComplete="current-password"
                />
              </div>

              <div className="text-right">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setIsRequestingReset(true)}
                  className="text-primary hover:text-primary/80 p-0 h-auto font-normal"
                >
                  {language === 'en' ? 'Forgot password?' : 'Mot de passe oublié ?'}
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {t.common.loading}
                  </>
                ) : (
                  <>
                    {t.auth.signIn}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted-foreground/20" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">{t.common.or}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={() => navigate('/housekeeper/signup')}
                  className="w-full h-11 border-2 hover:bg-primary/5 hover:border-primary transition-all"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t.auth.signup}
                </Button>
                
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs mt-6">
          {language === 'en' ? 'Your data is protected and secure' : 'Vos données sont protégées et sécurisées'}
        </p>
      </div>
    </div>
  );
}
