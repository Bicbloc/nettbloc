import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHousekeeperAuth } from '@/contexts/HousekeeperAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Building, Users, KeyRound, Zap, FileText, BarChart3, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const { signIn, signUp, isAuthenticated, loading, clearCorruptedSession } = useAuth();
  const { signIn: housekeeperSignIn, signUp: housekeeperSignUp } = useHousekeeperAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    newPassword: '',
    confirmNewPassword: '',
    housekeeperName: ''
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowRetry(true), 2000);
      return () => clearTimeout(timer);
    }
    setShowRetry(false);
  }, [loading]);

  const handleClearAndRetry = () => {
    clearCorruptedSession();
    toast({
      title: "Cache effacé",
      description: "Les données de session ont été réinitialisées."
    });
    setTimeout(() => window.location.reload(), 500);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    
    if (accessToken && refreshToken && type === 'recovery') {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ error }) => {
        if (error) {
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Lien de récupération invalide ou expiré."
          });
        } else {
          setIsPasswordReset(true);
          window.history.replaceState({}, '', '/auth');
          toast({
            title: "Récupération activée",
            description: "Vous pouvez maintenant définir un nouveau mot de passe."
          });
        }
      });
    }
    
    const isReset = urlParams.get('reset') === 'true';
    if (isReset && !accessToken) {
      window.history.replaceState({}, '', '/auth');
      toast({
        title: "Email envoyé",
        description: "Vérifiez votre email et cliquez sur le lien de récupération."
      });
    }
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const forceAuth = urlParams.get('force') === 'true';

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
      navigate('/');
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
      navigate('/plan-selection');
    }
    
    setIsLoading(false);
  };

  const handleGuestMode = () => {
    navigate('/guest');
  };

  const handleHousekeeperSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await housekeeperSignIn(formData.email, formData.password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message === "Invalid login credentials" 
          ? "Email ou mot de passe incorrect" 
          : error.message
      });
    } else {
      toast({
        title: "Connexion réussie ! 🎉",
        description: "Bienvenue"
      });
      navigate('/housekeeper/hotels');
    }
    
    setIsLoading(false);
  };

  const handleHousekeeperSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.housekeeperName.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le nom est obligatoire."
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

    if (formData.password.length < 6) {
      toast({
        variant: "destructive",
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères"
      });
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await housekeeperSignUp(formData.email, formData.password, formData.housekeeperName);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message
      });
    } else {
      toast({
        title: "Inscription réussie ! 🎉",
        description: "Vous pouvez maintenant vous connecter"
      });
    }
    
    setIsLoading(false);
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

      if (error) throw error;

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

      if (error) throw error;

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Vérification de l'authentification...</p>
        {showRetry && (
          <div className="flex flex-col gap-2 items-center">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Rafraîchir la page
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearAndRetry} className="text-xs text-muted-foreground">
              Problème persistant ? Réinitialiser la session
            </Button>
          </div>
        )}
      </div>
    );
  }

  const features = [
    { icon: Zap, text: "Distribution automatique des chambres" },
    { icon: Users, text: "Équipe connectée en temps réel" },
    { icon: FileText, text: "Rapports PDF générés en 1 clic" },
    { icon: BarChart3, text: "Statistiques et suivi d'avancement" }
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <Building className="h-10 w-10 text-white" />
            </div>
            <span className="text-3xl font-bold text-white font-display">Nettobloc</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight font-display">
            Simplifiez votre gestion hôtelière
          </h1>
          <p className="text-xl text-white/80 mb-12 leading-relaxed max-w-md">
            Assignation automatique • Suivi temps réel • Rapports détaillés
          </p>
        </div>
        
        {/* Features */}
        <div className="relative z-10 space-y-4">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="flex items-center gap-4 text-white/90 bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="p-2 bg-white/20 rounded-lg">
                <feature.icon className="h-5 w-5" />
              </div>
              <span className="font-medium">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Bottom decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center space-y-4">
            <div className="inline-flex items-center gap-3 p-4 bg-gradient-hero rounded-2xl">
              <Building className="h-8 w-8 text-white" />
              <span className="text-2xl font-bold text-white font-display">Nettobloc</span>
            </div>
            <p className="text-muted-foreground">Gestion hôtelière simplifiée</p>
          </div>

          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-display">
                {isPasswordReset ? (
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-6 w-6 text-primary" />
                    Nouveau mot de passe
                  </div>
                ) : (
                  "Bienvenue"
                )}
              </CardTitle>
              <CardDescription className="text-base">
                {isPasswordReset ? 
                  "Définissez votre nouveau mot de passe" :
                  "Connectez-vous ou créez un compte"
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
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirmer</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="Répétez le nouveau mot de passe"
                      value={formData.confirmNewPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                      required
                      minLength={6}
                      className="h-12"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Mettre à jour
                  </Button>
                  <Button 
                    variant="ghost" 
                    type="button"
                    onClick={() => setIsPasswordReset(false)}
                    className="w-full"
                  >
                    Annuler
                  </Button>
                </form>
              ) : (
                <>
                  {isAuthenticated && forceAuth && (
                    <div className="mb-4 p-4 bg-info/10 border border-info/20 rounded-xl">
                      <p className="text-sm text-foreground mb-2">Vous êtes déjà connecté.</p>
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
                  
                  <Tabs defaultValue="signin" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50">
                      <TabsTrigger value="signin" className="h-10 font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        Connexion
                      </TabsTrigger>
                      <TabsTrigger value="signup" className="h-10 font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        Inscription
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="signin" className="space-y-4 mt-6">
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
                            className="h-12"
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
                            className="h-12"
                          />
                        </div>
                        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Se connecter
                        </Button>
                        <div className="text-center">
                          <Button variant="link" type="button" onClick={handlePasswordReset} className="text-sm">
                            Mot de passe oublié ?
                          </Button>
                        </div>
                      </form>
                    </TabsContent>
                    
                    <TabsContent value="signup" className="space-y-4 mt-6">
                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="company-name">Nom de l'établissement</Label>
                          <Input
                            id="company-name"
                            type="text"
                            placeholder="Hôtel Exemple"
                            value={formData.companyName}
                            onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                            required
                            className="h-12"
                          />
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
                            className="h-12"
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
                            className="h-12"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirmer</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            required
                            className="h-12"
                          />
                        </div>
                        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Créer mon compte
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>

                  {/* Divider */}
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Ou</span>
                    </div>
                  </div>

                  {/* Housekeeper Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-center text-muted-foreground">
                      Espace Femme de chambre
                    </h3>
                    
                    <Tabs defaultValue="hk-signin" className="space-y-4">
                      <TabsList className="grid w-full grid-cols-2 h-10 bg-muted/30">
                        <TabsTrigger value="hk-signin" className="text-sm">Connexion</TabsTrigger>
                        <TabsTrigger value="hk-signup" className="text-sm">Inscription</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="hk-signin" className="space-y-3">
                        <form onSubmit={handleHousekeeperSignIn} className="space-y-3">
                          <Input
                            type="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            required
                            className="h-11"
                          />
                          <Input
                            type="password"
                            placeholder="Mot de passe"
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            required
                            className="h-11"
                          />
                          <Button type="submit" variant="secondary" className="w-full h-11" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Users className="mr-2 h-4 w-4" />
                            Accéder à mon espace
                          </Button>
                        </form>
                      </TabsContent>
                      
                      <TabsContent value="hk-signup" className="space-y-3">
                        <form onSubmit={handleHousekeeperSignUp} className="space-y-3">
                          <Input
                            type="text"
                            placeholder="Votre nom"
                            value={formData.housekeeperName}
                            onChange={(e) => setFormData(prev => ({ ...prev, housekeeperName: e.target.value }))}
                            required
                            className="h-11"
                          />
                          <Input
                            type="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            required
                            className="h-11"
                          />
                          <Input
                            type="password"
                            placeholder="Mot de passe"
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            required
                            className="h-11"
                          />
                          <Input
                            type="password"
                            placeholder="Confirmer le mot de passe"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            required
                            className="h-11"
                          />
                          <Button type="submit" variant="secondary" className="w-full h-11" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Créer mon profil
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Guest Mode */}
                  <div className="pt-4 border-t">
                    <Button 
                      variant="ghost" 
                      className="w-full text-muted-foreground hover:text-foreground"
                      onClick={handleGuestMode}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Continuer en mode invité
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            En vous connectant, vous acceptez nos conditions d'utilisation
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
