import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { validateEmailForUserType } from '@/services/userTypeValidationService';
import { APP_ORIGIN } from '@/constants/appUrl';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HousekeeperSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isEn = language === 'en';

  useEffect(() => {
    const prefillEmail = searchParams.get('email');
    const prefillName = searchParams.get('name');
    if (prefillEmail) setEmail(prefillEmail);
    if (prefillName) setName(prefillName);
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName || !normalizedEmail || !password) {
      toast({
        variant: 'destructive',
        title: isEn ? 'Required fields' : 'Champs requis',
        description: isEn ? 'Please fill in all fields' : 'Veuillez remplir tous les champs',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: isEn ? 'Password too short' : 'Mot de passe trop court',
        description: isEn
          ? 'Password must be at least 6 characters'
          : 'Le mot de passe doit contenir au moins 6 caractères',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: isEn ? 'Passwords do not match' : 'Mots de passe différents',
        description: isEn
          ? 'The passwords do not match'
          : 'Les mots de passe ne correspondent pas',
      });
      return;
    }

    setIsLoading(true);

    try {
      const validation = await validateEmailForUserType(normalizedEmail, 'housekeeper');
      if (!validation.isValid) {
        toast({
          variant: 'destructive',
          title: isEn ? 'Email already used' : 'Email déjà utilisé',
          description: validation.error || (isEn
            ? 'This address is already linked to another account type.'
            : 'Cette adresse est déjà associée à un autre type de compte.'),
        });
        if (validation.existingType) {
          toast({
            title: isEn ? 'Redirection' : 'Redirection',
            description: isEn
              ? `Log in on ${validation.existingType === 'establishment' ? 'the Establishment interface' : 'the appropriate interface'}.`
              : `Connectez-vous sur ${validation.existingType === 'establishment' ? "l'interface Établissement" : "l'interface appropriée"}.`,
          });
        }
        setIsLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${APP_ORIGIN}/housekeeper/hotels`,
          data: { name: trimmedName, user_type: 'housekeeper' }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error(isEn ? 'Error creating account' : 'Erreur lors de la création du compte');

      if (authData.user.identities && authData.user.identities.length === 0) {
        throw new Error(isEn
          ? 'An account already exists with this email. Log in or use another address.'
          : 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.');
      }

      if (authData.session) {
        const { error: profileError } = await supabase
          .from('housekeeper_profiles')
          .upsert(
            {
              id: authData.user.id,
              name: trimmedName,
              email: normalizedEmail,
              is_active: true,
              total_rooms_cleaned: 0,
              total_hotels_worked: 0,
            },
            { onConflict: 'id' }
          );

        if (profileError) {
          console.error('Erreur création profil housekeeper:', profileError);
        }

        toast({
          title: isEn ? 'Sign-up successful! 🎉' : 'Inscription réussie ! 🎉',
          description: isEn
            ? 'Log in with your email and add your hotel code'
            : 'Connectez-vous avec votre email et ajoutez le code de votre hôtel',
        });
        navigate('/housekeeper/hotels');
        return;
      }

      setShowEmailConfirmation(true);
      setEmail(normalizedEmail);
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      toast({
        variant: 'destructive',
        title: isEn ? 'Sign-up error' : "Erreur d'inscription",
        description: error.message || (isEn ? 'An error occurred' : 'Une erreur est survenue'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showEmailConfirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 shadow-2xl border border-white/30">
              <Mail className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {isEn ? 'Check your email' : 'Vérifiez votre email'}
            </h1>
            <p className="text-white/80">
              {isEn ? 'An activation link has been sent to you' : "Un lien d'activation vous a été envoyé"}
            </p>
          </div>

          <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-0">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <p className="text-base font-medium">
                  {isEn ? 'An email has been sent to' : 'Un email a été envoyé à'}{' '}
                  <span className="font-bold text-primary">{email}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {isEn
                    ? 'Click the link in the email to activate your housekeeper account.'
                    : 'Cliquez sur le lien dans l\'email pour activer votre compte femme de chambre.'}
                </p>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-foreground">
                  {isEn ? (
                    <><strong>💡 Tip:</strong> if you can't find the email, also check your <strong>Spam</strong> or <strong>Junk</strong> folder.</>
                  ) : (
                    <><strong>💡 Astuce :</strong> si vous ne trouvez pas l'email, vérifiez aussi votre dossier <strong>Spam</strong> ou <strong>Indésirables</strong>.</>
                  )}
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => navigate('/housekeeper/auth')}>
                {isEn ? 'Back to login' : 'Retour à la connexion'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 right-10 w-72 h-72 bg-violet-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />

      <div className="absolute top-4 left-4 z-20">
        <Link to="/housekeeper/auth">
          <Button variant="ghost" size="icon" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl shadow-lg">
              <UserPlus className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {isEn ? 'Create an account' : 'Créer un compte'}
          </h1>
          <p className="text-white/80 text-sm sm:text-base">
            {isEn
              ? 'Sign up to manage your services across multiple hotels'
              : 'Inscrivez-vous pour gérer vos services dans plusieurs hôtels'}
          </p>
        </div>

        <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4 text-violet-600" />
                  {isEn ? 'Full name' : 'Nom complet'}
                </Label>
                <Input id="name" type="text" placeholder={isEn ? 'Marie Dupont' : 'Marie Dupont'} value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-slate-50 border-slate-200 text-base" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-violet-600" />
                  {isEn ? 'Email' : 'Email'}
                </Label>
                <Input id="email" type="email" placeholder="marie@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-slate-50 border-slate-200 text-base" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4 text-violet-600" />
                  {isEn ? 'Password' : 'Mot de passe'}
                </Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-slate-50 border-slate-200 text-base" required />
                <p className="text-xs text-muted-foreground">
                  {isEn ? 'Minimum 6 characters' : 'Minimum 6 caractères'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4 text-violet-600" />
                  {isEn ? 'Confirm password' : 'Confirmer le mot de passe'}
                </Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 bg-slate-50 border-slate-200 text-base" required />
              </div>

              <Button type="submit" className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isEn ? 'Creating account...' : 'Création du compte...'}</>
                ) : (
                  <><UserPlus className="h-4 w-4 mr-2" />{isEn ? 'Sign up' : "S'inscrire"}</>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isEn ? 'Already have an account?' : 'Vous avez déjà un compte ?'}{' '}
                <Link to="/housekeeper/auth" className="text-violet-600 hover:underline font-medium">
                  {isEn ? 'Log in' : 'Se connecter'}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
