import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Building, Users, ArrowLeft, Mail, Lock, User, ArrowRight, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useHousekeeperAuth } from '@/contexts/HousekeeperAuthContext';
import { useTranslation } from '@/contexts/LanguageContext';

type AuthMode = 'select' | 'hotel-signin' | 'hotel-signup' | 'housekeeper-signin' | 'housekeeper-signup' | 'reset-password' | 'new-password';

const Auth = () => {
  const { signIn, signUp, isAuthenticated } = useAuth();
  const { signIn: housekeeperSignIn, signUp: housekeeperSignUp } = useHousekeeperAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('select');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    name: ''
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { translations: t, language } = useTranslation();

  // Handle password reset link
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    if (accessToken && refreshToken && type === 'recovery') {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            toast({ 
              variant: "destructive", 
              title: language === 'en' ? "Link expired" : "Lien expiré", 
              description: language === 'en' ? "Please request a new link." : "Veuillez demander un nouveau lien." 
            });
          } else {
            setMode('new-password');
            window.history.replaceState({}, '', '/auth');
          }
        });
    }
  }, [toast, language]);

  // Si authentifié, rediriger immédiatement
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Afficher loading uniquement pendant la soumission
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      switch (mode) {
        case 'hotel-signin': {
          const { error } = await signIn(formData.email, formData.password);
          if (error) throw error;
          toast({ title: t.auth.loginSuccess });
          return;
        }
        case 'hotel-signup': {
          if (!formData.companyName.trim()) throw new Error(language === 'en' ? "Establishment name required" : "Nom de l'établissement requis");
          if (formData.password !== formData.confirmPassword) throw new Error(t.auth.passwordMismatch);
          const { error } = await signUp(formData.email, formData.password, formData.companyName);
          if (error) throw error;
          toast({ title: t.auth.signupSuccess });
          navigate('/plan-selection');
          break;
        }
        case 'housekeeper-signin': {
          const { error } = await housekeeperSignIn(formData.email, formData.password);
          if (error) throw error;
          toast({ title: language === 'en' ? "Welcome!" : "Bienvenue !" });
          navigate('/housekeeper/hotels');
          break;
        }
        case 'housekeeper-signup': {
          if (!formData.name.trim()) throw new Error(language === 'en' ? "Name required" : "Nom requis");
          if (formData.password !== formData.confirmPassword) throw new Error(t.auth.passwordMismatch);
          if (formData.password.length < 6) throw new Error(t.auth.passwordTooShort);
          const { error } = await housekeeperSignUp(formData.email, formData.password, formData.name);
          if (error) throw error;
          toast({ 
            title: t.auth.signupSuccess, 
            description: language === 'en' ? "You can now log in" : "Vous pouvez vous connecter" 
          });
          setMode('housekeeper-signin');
          break;
        }
        case 'reset-password': {
          const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
            redirectTo: `${window.location.origin}/auth`
          });
          if (error) throw error;
          toast({ 
            title: language === 'en' ? "Email sent" : "Email envoyé", 
            description: language === 'en' ? "Check your inbox" : "Vérifiez votre boîte mail" 
          });
          setMode('hotel-signin');
          break;
        }
        case 'new-password': {
          if (formData.password !== formData.confirmPassword) throw new Error(t.auth.passwordMismatch);
          if (formData.password.length < 6) throw new Error(t.auth.passwordTooShort);
          const { error } = await supabase.auth.updateUser({ password: formData.password });
          if (error) throw error;
          toast({ title: language === 'en' ? "Password updated" : "Mot de passe mis à jour" });
          navigate('/');
          break;
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t.auth.loginError,
        description: error.message === "Invalid login credentials" ? t.auth.invalidCredentials : error.message
      });
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({ email: '', password: '', confirmPassword: '', companyName: '', name: '' });
  };

  const goBack = () => {
    resetForm();
    setMode('select');
  };

  // Selection screen
  if (mode === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-primary rounded-2xl mb-2">
              <Building className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Nettobloc</h1>
            <p className="text-muted-foreground text-sm">
              {language === 'en' ? 'Simplified hotel management' : 'Gestion hôtelière simplifiée'}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/auth/establishment')}
              className="w-full p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{language === 'en' ? 'Establishment' : 'Établissement'}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'en' ? 'Manager, supervisor' : 'Gérant, responsable'}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/housekeeper/auth')}
              className="w-full p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/50 text-secondary-foreground">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{language === 'en' ? 'Team' : 'Équipe'}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'en' ? 'Housekeeper' : 'Femme/valet de chambre'}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/governess/auth')}
              className="w-full p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{language === 'en' ? 'Governess' : 'Gouvernante'}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'en' ? 'Inspection & incidents' : 'Inspection & incidents'}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground pt-4">
            {language === 'en' ? 'By continuing, you accept our terms' : 'En continuant, vous acceptez nos conditions'}
          </p>
        </div>
      </div>
    );
  }

  // Form screens
  const getFormConfig = () => {
    switch (mode) {
      case 'hotel-signin':
        return { 
          title: language === 'en' ? 'Establishment login' : 'Connexion établissement', 
          subtitle: language === 'en' ? 'Access your dashboard' : 'Accédez à votre tableau de bord', 
          switchText: t.auth.noAccount, 
          switchAction: () => setMode('hotel-signup'), 
          switchLabel: t.auth.signUp 
        };
      case 'hotel-signup':
        return { 
          title: t.auth.signup, 
          subtitle: language === 'en' ? 'Register your establishment' : 'Inscrivez votre établissement', 
          switchText: t.auth.hasAccount, 
          switchAction: () => setMode('hotel-signin'), 
          switchLabel: t.auth.signIn 
        };
      case 'housekeeper-signin':
        return { 
          title: language === 'en' ? 'Team login' : 'Connexion équipe', 
          subtitle: language === 'en' ? 'Access your rooms' : 'Accédez à vos chambres', 
          switchText: t.auth.noAccount, 
          switchAction: () => setMode('housekeeper-signup'), 
          switchLabel: t.auth.signUp 
        };
      case 'housekeeper-signup':
        return { 
          title: language === 'en' ? 'Create profile' : 'Créer un profil', 
          subtitle: language === 'en' ? 'Join your team' : 'Rejoignez votre équipe', 
          switchText: t.auth.hasAccount, 
          switchAction: () => setMode('housekeeper-signin'), 
          switchLabel: t.auth.signIn 
        };
      case 'reset-password':
        return { 
          title: t.auth.forgotPassword, 
          subtitle: language === 'en' ? 'Receive a link by email' : 'Recevez un lien par email', 
          switchText: '', 
          switchAction: () => {}, 
          switchLabel: '' 
        };
      case 'new-password':
        return { 
          title: language === 'en' ? 'New password' : 'Nouveau mot de passe', 
          subtitle: language === 'en' ? 'Set your new password' : 'Définissez votre nouveau mot de passe', 
          switchText: '', 
          switchAction: () => {}, 
          switchLabel: '' 
        };
      default:
        return { title: '', subtitle: '', switchText: '', switchAction: () => {}, switchLabel: '' };
    }
  };

  const config = getFormConfig();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="w-full max-w-sm">
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-lg">{config.title}</CardTitle>
                <CardDescription className="text-sm">{config.subtitle}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Hotel signup: company name */}
              {mode === 'hotel-signup' && (
                <div className="space-y-2">
                  <Label htmlFor="company">
                    {language === 'en' ? 'Establishment name' : "Nom de l'établissement"}
                  </Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="company"
                      placeholder={language === 'en' ? "My Hotel" : "Mon Hôtel"}
                      value={formData.companyName}
                      onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Housekeeper signup: name */}
              {mode === 'housekeeper-signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name">{language === 'en' ? 'Your name' : 'Votre nom'}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder={t.auth.namePlaceholder}
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              {mode !== 'new-password' && (
                <div className="space-y-2">
                  <Label htmlFor="email">{t.common.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t.auth.emailPlaceholder}
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              {mode !== 'reset-password' && (
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {mode === 'new-password' 
                      ? (language === 'en' ? 'New password' : 'Nouveau mot de passe') 
                      : t.common.password}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="pl-10 h-11"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              {/* Confirm password */}
              {(mode === 'hotel-signup' || mode === 'housekeeper-signup' || mode === 'new-password') && (
                <div className="space-y-2">
                  <Label htmlFor="confirm">{t.auth.confirmPassword}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm"
                      type="password"
                      placeholder="••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'reset-password' 
                  ? (language === 'en' ? 'Send link' : 'Envoyer le lien') 
                  : mode.includes('signup') 
                    ? t.auth.signUp 
                    : mode === 'new-password' 
                      ? t.common.confirm 
                      : t.auth.signIn}
              </Button>

              {/* Forgot password link */}
              {(mode === 'hotel-signin' || mode === 'housekeeper-signin') && (
                <button
                  type="button"
                  onClick={() => setMode('reset-password')}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t.auth.forgotPassword}
                </button>
              )}
            </form>

            {/* Switch mode */}
            {config.switchText && (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">{config.switchText} </span>
                <button onClick={config.switchAction} className="text-primary font-medium hover:underline">
                  {config.switchLabel}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
