import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BackButton from '@/components/BackButton';

export default function HousekeeperSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir tous les champs"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Envoyer un lien magique par email
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/housekeeper/hotels`,
          data: {
            name: name,
            user_type: 'housekeeper'
          }
        }
      });

      if (authError) throw authError;

      toast({
        title: "Email envoyé ! 📧",
        description: "Vérifiez votre boîte mail pour vous connecter"
      });

      navigate('/housekeeper/auth');

    } catch (error: any) {
      console.error('Erreur inscription:', error);
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message || "Une erreur est survenue"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4">
        <BackButton to="/housekeeper/auth" />
      </div>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-purple-600/10 p-3 rounded-full">
              <UserPlus className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">Créer un compte</CardTitle>
          <CardDescription>
            Recevez un lien de connexion par email (sans mot de passe)
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2 font-medium">
                <User className="h-4 w-4" />
                Nom complet
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Marie Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
                required
              />
            </div>

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
                required
              />
              <p className="text-xs text-muted-foreground">
                Vous recevrez un lien de connexion à chaque fois
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base bg-purple-600 hover:bg-purple-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Création du compte...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  S'inscrire
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Vous avez déjà un compte ?</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/housekeeper/auth')}
              className="flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Se connecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
