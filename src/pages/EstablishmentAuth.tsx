import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import BackButton from '@/components/BackButton';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Loader2, Building, Users, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { validateEmailForUserType, validateUserAccessToInterface, getRedirectMessage } from '@/services/userTypeValidationService';

const EstablishmentAuth = () => {
  const { signIn, signUp, isAuthenticated, loading, isInitialized } = useAuth();
  const { refreshHotel, isHotelReady } = useHotel();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [isWaitingForHotel, setIsWaitingForHotel] = useState(false);
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

  // Handle password reset from URL
  useEffect(() => {
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
          window.history.replaceState({}, '', '/auth/establishment');
        }
      });
    }
  }, []);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Vérifier que l'email est bien un compte établissement
    const accessCheck = await validateUserAccessToInterface(formData.email, 'establishment');
    if (!accessCheck.allowed && accessCheck.correctInterface) {
      toast({
        variant: "destructive",
        title: "Mauvaise interface",
        description: getRedirectMessage(accessCheck.correctInterface, 'fr')
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
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth/establishment`
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Vérification de l'authentification...</p>
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
          <h1 className="text-3xl font-bold">Espace Établissement</h1>
          <p className="text-muted-foreground">Gérez votre hôtel et vos équipes</p>
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
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
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
                      <Label htmlFor="signup-company">Nom de l'établissement</Label>
                      <Input
                        id="signup-company"
                        type="text"
                        placeholder="Mon Hôtel"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        required
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Mot de passe</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Minimum 6 caractères"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        minLength={6}
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
                      Créer mon compte
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Lien vers connexion femme de chambre */}
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Users className="h-6 w-6 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-emerald-800">Vous êtes femme de chambre ?</h3>
                <p className="text-sm text-emerald-700">Accédez à l'interface mobile dédiée</p>
              </div>
            </div>
            <Link to="/housekeeper/login">
              <Button variant="outline" className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                Connexion Femme de chambre
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EstablishmentAuth;
