import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2, LogIn, UserPlus, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BackButton from '@/components/BackButton';
import { retryQuery } from '@/services/queryUtils';

export default function HousekeeperAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir votre email et mot de passe"
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
        const profileResult = await retryQuery(async () => {
          const profileQuery = supabase
            .from('housekeeper_profiles')
            .select('*')
            .eq('email', data.user.email)
            .maybeSingle();
          return await profileQuery;
        });

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (profileResult.data) {
          localStorage.setItem('housekeeper_profile', JSON.stringify(profileResult.data));
          
          toast({
            title: "Connexion réussie",
            description: `Bienvenue ${profileResult.data.name}`
          });
          navigate('/housekeeper/hotels');
        } else {
          throw new Error("Profil femme de chambre non trouvé. Créez d'abord un compte.");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-4 left-4 z-10">
        <BackButton to="/" className="text-white hover:bg-white/20" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Header section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 shadow-2xl border border-white/30">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Espace Personnel</h1>
          <p className="text-white/80">Connectez-vous pour accéder à vos hôtels</p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-center flex items-center justify-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Connexion sécurisée
            </CardTitle>
            <CardDescription className="text-center">
              Entrez vos identifiants pour continuer
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
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
                  className="h-12 text-base bg-muted/50 border-muted-foreground/20 focus:border-primary focus:ring-primary"
                  autoComplete="email"
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
                  className="h-12 text-base bg-muted/50 border-muted-foreground/20 focus:border-primary focus:ring-primary"
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Connexion en cours...
                  </>
                ) : (
                  <>
                    Se connecter
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
                  <span className="bg-white px-2 text-muted-foreground">Ou</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={() => navigate('/housekeeper/signup')}
                  className="w-full h-11 border-2 hover:bg-primary/5 hover:border-primary transition-all"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Créer un nouveau compte
                </Button>
                
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    Code d'accès fourni par votre hôtel ?
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => navigate('/housekeeper/hotels')}
                    className="text-primary hover:text-primary/80 font-medium"
                  >
                    Connexion rapide avec code
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs mt-6">
          Vos données sont protégées et sécurisées
        </p>
      </div>
    </div>
  );
}
