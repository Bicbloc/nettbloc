import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Loader2, Building, KeyRound, ArrowLeft, Mail, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRecovery } from '@/integrations/supabase/recoveryClient';
import { validateEmailForUserType, validateUserAccessToInterface, getRedirectMessage } from '@/services/userTypeValidationService';
import { PASSWORD_RESET_URL } from '@/constants/appUrl';

const EstablishmentAuth = () => {
  const { signIn, signUp, signOut, isAuthenticated, loading, isInitialized, user } = useAuth();
  const { refreshHotel, isHotelReady } = useHotel();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [isWaitingForHotel, setIsWaitingForHotel] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
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

  // Vérifier si l'utilisateur actuel a le droit d'accéder à cette interface
  // Si non, le déconnecter pour permettre une nouvelle connexion
  useEffect(() => {
    const checkExistingSession = async () => {
      if (!isInitialized || loading) return;
      
      // Pas de session = OK pour afficher le formulaire
      if (!user) {
        setIsCheckingAccess(false);
        return;
      }

      // Vérifier si c'est un compte établissement via RPC sécurisée
      const email = user.email?.trim().toLowerCase();
      if (!email) {
        setIsCheckingAccess(false);
        return;
      }

      const accessCheck = await validateUserAccessToInterface(email, 'establishment');

      if (accessCheck.allowed) {
        navigate('/', { replace: true });
        return;
      }

      // L'utilisateur connecté n'est PAS un établissement
      // Déconnecter pour permettre une connexion avec le bon compte
      // Nettoyer TOUS les profils locaux d'abord
      localStorage.removeItem('housekeeper_profile');
      localStorage.removeItem('governess_profile');
      localStorage.removeItem('technician_profile');
      try {
        await supabase.auth.signOut();
      } catch (err) {
        localStorage.removeItem('sb-rarhqnvvbjzfdevnghnz-auth-token');
      }
      // Petit délai pour laisser le listener auth mettre à jour l'état
      await new Promise(resolve => setTimeout(resolve, 300));
      setIsCheckingAccess(false);
    };

    checkExistingSession();
  }, [isInitialized, loading, user, navigate, signOut]);

  // Handle password reset from URL
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);

    const type = hashParams.get('type') ?? searchParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const code = searchParams.get('code');

    const handleRecovery = async () => {
      if (type !== 'recovery') return;

      // Legacy format: #access_token=...&refresh_token=...&type=recovery
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: 'Lien de récupération invalide ou expiré.',
          });
          return;
        }

        setIsPasswordReset(true);
        window.history.replaceState({}, document.title, '/auth/establishment');
        return;
      }

      // New format (PKCE): ?code=...&type=recovery
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: 'Lien de récupération invalide ou expiré.',
          });
          return;
        }

        setIsPasswordReset(true);
        window.history.replaceState({}, document.title, '/auth/establishment');
      }
    };

    void handleRecovery();
  }, [toast]);

  // IMPORTANT: en recovery, l'utilisateur est authentifié mais doit voir l'écran "nouveau mot de passe"
  // On ne redirige plus automatiquement ici - la vérification se fait dans checkExistingSession
  
  // Afficher loading pendant la vérification d'accès initiale
  if (isCheckingAccess || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-white/80">Vérification de l'authentification...</p>
      </div>
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Vérifier que l'email est bien un compte établissement
    const accessCheck = await validateUserAccessToInterface(formData.email, 'establishment');
    if (!accessCheck.allowed && accessCheck.correctInterface) {
      toast({
        variant: "destructive",
        title: "Compte lié à un autre type d'utilisateur",
        description: getRedirectMessage(accessCheck.correctInterface, 'fr'),
        duration: 8000,
      });
      setIsLoading(false);
      return;
    }
    
    const { error } = await signIn(formData.email, formData.password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message
      });
      setIsLoading(false);
      return;
    }
    
    toast({
      title: "Connexion réussie",
      description: "Chargement de votre établissement..."
    });
    
    // Attendre que l'hôtel soit chargé avant de naviguer
    setIsWaitingForHotel(true);
    try {
      await refreshHotel();
      // Petit délai pour laisser React mettre à jour l'état
      await new Promise(resolve => setTimeout(resolve, 150));
      navigate('/');
    } catch (err) {
      console.error('Erreur chargement hôtel:', err);
      // Naviguer quand même, Index.tsx gérera le chargement
      navigate('/');
    }
    
    setIsLoading(false);
    setIsWaitingForHotel(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le nom de l'établissement est obligatoire."
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
    
    // Vérifier que l'email n'est pas déjà utilisé sur une autre interface
    const validation = await validateEmailForUserType(formData.email, 'establishment');
    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "Email déjà utilisé",
        description: validation.error || "Cette adresse est déjà associée à un autre type de compte."
      });
      setIsLoading(false);
      return;
    }
    
    const { error, needsEmailVerification } = await signUp(
      formData.email,
      formData.password,
      formData.companyName
    );
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message
      });
    } else if (needsEmailVerification) {
      toast({
        title: "Email de vérification envoyé",
        description: "Vérifiez votre boîte mail, confirmez votre email, puis connectez-vous."
      });
    } else {
      toast({
        title: "Compte créé avec succès",
        description: "Vous êtes maintenant connecté."
      });
      navigate('/plan-selection');
    }
    
    setIsLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!formData.email.trim()) {
      toast({
        variant: "destructive",
        title: "Email requis",
        description: "Veuillez saisir votre email."
      });
      return;
    }

    try {
      const { error } = await supabaseRecovery.auth.resetPasswordForEmail(formData.email, {
        redirectTo: PASSWORD_RESET_URL,
      });

      if (error) throw error;

      toast({
        title: "Email envoyé",
        description: "Un email de réinitialisation a été envoyé."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
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

      if (error) throw error;

      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été changé avec succès."
      });

      setIsPasswordReset(false);
      navigate('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    }

    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-white/80">Vérification de l'authentification...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />
      
      <div className="absolute top-4 left-4 z-20">
        <Link to="/auth">
          <Button 
            variant="ghost" 
            size="icon"
            className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>
      
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl shadow-lg">
              <Building className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Espace Établissement</h1>
          <p className="text-white/80">Gérez votre hôtel et vos équipes</p>
        </div>

        <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardHeader className="pb-2">
            <CardTitle>
              {isPasswordReset ? (
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-emerald-600" />
                  Nouveau mot de passe
                </div>
              ) : (
                "Connexion Établissement"
              )}
            </CardTitle>
            <CardDescription>
              {isPasswordReset 
                ? "Définissez votre nouveau mot de passe"
                : "Connectez-vous pour gérer votre établissement"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPasswordReset ? (
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
                    className="h-12 bg-slate-50 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirmer</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="Répétez le mot de passe"
                    value={formData.confirmNewPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                    required
                    minLength={6}
                    className="h-12 bg-slate-50 border-slate-200"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg" 
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mettre à jour
                </Button>
              </form>
            ) : (
              <Tabs defaultValue="signin" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Connexion</TabsTrigger>
                  <TabsTrigger value="signup">Inscription</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin" className="space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-emerald-600" />Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                        className="h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-emerald-600" />Mot de passe</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        className="h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg" 
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Se connecter
                    </Button>
                    <div className="text-center">
                      <Button 
                        variant="link" 
                        type="button"
                        onClick={handlePasswordReset}
                        className="text-sm text-emerald-600 hover:text-emerald-800"
                      >
                        Mot de passe oublié ?
                      </Button>
                    </div>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup" className="space-y-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-company" className="flex items-center gap-2 font-medium"><Building className="h-4 w-4 text-emerald-600" />Nom de l'établissement</Label>
                      <Input
                        id="signup-company"
                        type="text"
                        placeholder="Mon Hôtel"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        required
                        className="h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-emerald-600" />Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                        className="h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-emerald-600" />Mot de passe</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Minimum 6 caractères"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={6}
                        className="h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm" className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-emerald-600" />Confirmer le mot de passe</Label>
                      <Input
                        id="signup-confirm"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        required
                        className="h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg" 
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Créer mon compte
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EstablishmentAuth;
