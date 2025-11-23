import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BackButton from '@/components/BackButton';

export default function HousekeeperAuth() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('housekeeper_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        navigate('/housekeeper/hotels');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Email requis",
        description: "Veuillez entrer votre email"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/housekeeper/hotels`
        }
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Email envoyé ! 📧",
        description: "Vérifiez votre boîte mail pour vous connecter"
      });

    } catch (error: any) {
      console.error('Erreur connexion:', error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message || "Impossible d'envoyer l'email"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4">
        <BackButton to="/" />
      </div>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600/10 p-3 rounded-full">
              <LogIn className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            {emailSent ? "Email envoyé !" : "Connexion"}
          </CardTitle>
          <CardDescription>
            {emailSent 
              ? "Vérifiez votre boîte mail et cliquez sur le lien de connexion"
              : "Recevez un lien de connexion par email"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!emailSent ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4" />
                  Email professionnel
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="marie@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Recevoir le lien
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="bg-green-50 text-green-800 p-4 rounded-lg">
                <p className="font-medium">📧 Email envoyé avec succès !</p>
                <p className="text-sm mt-2">Vérifiez votre boîte mail et cliquez sur le lien pour vous connecter.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setEmailSent(false)}
                className="w-full"
              >
                Renvoyer un email
              </Button>
            </div>
          )}

          {!emailSent && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Pas encore de compte ?</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/housekeeper/signup')}
                className="flex items-center gap-2 mx-auto"
              >
                <UserPlus className="h-4 w-4" />
                Créer un compte
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
