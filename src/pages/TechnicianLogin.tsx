import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Loader2, KeyRound, Mail, ArrowLeft, Lock } from 'lucide-react';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRecovery } from '@/integrations/supabase/recoveryClient';
import { PASSWORD_RESET_URL } from '@/constants/appUrl';
import { storageService } from '@/services/storageService';

export default function TechnicianLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useTechnicianAuth();

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

    if (!email.trim() || !password.trim()) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir tous les champs"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) throw error;

      toast({
        title: "Connexion réussie ! ✅",
        description: "Bienvenue"
      });

      storageService.saveActivePortal('technician');

      navigate('/technician/hotels');
    } catch (error: any) {
      console.error('Erreur connexion:', error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message || "Email ou mot de passe incorrect"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Recovery mode - show new password form
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-700 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
        
        <Card className="w-full max-w-md relative z-10 bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-lg">
                <KeyRound className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Nouveau mot de passe</CardTitle>
            <CardDescription>
              Entrez votre nouveau mot de passe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Minimum 6 caractères"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-200"
                />
              </div>

              <Button
                onClick={handleUpdatePassword}
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
    );
  }

  // Request reset mode
  if (isRequestingReset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-700 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
        
        <div className="absolute top-4 left-4 z-20">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsRequestingReset(false)}
            className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        
        <Card className="w-full max-w-md relative z-10 bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-lg">
                <Mail className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
            <CardDescription>
              Entrez votre email pour recevoir un lien de réinitialisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  placeholder="technicien@hotel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-200"
                />
              </div>

              <Button
                onClick={handlePasswordReset}
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-700 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
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
      
      <Card className="w-full max-w-md relative z-10 bg-white/95 backdrop-blur-sm shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-lg">
              <Wrench className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Connexion Technicien</CardTitle>
          <CardDescription>
            Connectez-vous pour gérer les incidents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-blue-600" />Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="technicien@hotel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-slate-50 border-slate-200"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-blue-600" />Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-slate-50 border-slate-200"
                required
              />
            </div>

            <div className="text-right">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setIsRequestingReset(true)}
                className="text-blue-600 hover:text-blue-800 p-0 h-auto font-normal"
              >
                Mot de passe oublié ?
              </Button>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connexion...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Se connecter
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{' '}
              <Link to="/technician/signup" className="text-blue-600 hover:underline font-medium">
                S'inscrire
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
