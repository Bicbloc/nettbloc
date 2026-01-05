import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2, ArrowRight, Crown, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BackButton from '@/components/BackButton';

export default function GovernessAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Vérifier si déjà connecté
    const profile = localStorage.getItem('governess_profile');
    if (profile) {
      navigate('/governess/dashboard');
    }
  }, [navigate]);

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
          localStorage.setItem('governess_profile', JSON.stringify(profileData));
          
          toast({
            title: "Connexion réussie",
            description: `Bienvenue ${profileData.name}`
          });
          navigate('/governess/dashboard');
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/governess/auth`,
          data: { name }
        }
      });

      if (error) throw error;

      // Créer le profil gouvernante
      const { error: profileError } = await supabase
        .from('governess_profiles')
        .insert({
          email,
          name,
          is_active: true
        });

      if (profileError) {
        console.error('Erreur création profil:', profileError);
      }

      toast({
        title: "Inscription réussie !",
        description: "Vous pouvez maintenant vous connecter"
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-600 to-red-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-4 left-4 z-10">
        <BackButton to="/auth" className="text-white hover:bg-white/20" />
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
