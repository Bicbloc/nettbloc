import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { validateEmailForUserType } from '@/services/userTypeValidationService';
import { APP_ORIGIN } from '@/constants/appUrl';

export default function HousekeeperSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password) {
      toast({ variant: "destructive", title: "Champs requis", description: "Veuillez remplir tous les champs" });
      return;
    }

    if (password.length < 6) {
      toast({ variant: "destructive", title: "Mot de passe trop court", description: "Le mot de passe doit contenir au moins 6 caractères" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Mots de passe différents", description: "Les mots de passe ne correspondent pas" });
      return;
    }

    setIsLoading(true);

    try {
      const validation = await validateEmailForUserType(email, 'housekeeper');
      if (!validation.isValid) {
        toast({ variant: "destructive", title: "Email déjà utilisé", description: validation.error || "Cette adresse est déjà associée à un autre type de compte." });
        if (validation.existingType) {
          toast({ title: "Redirection", description: `Connectez-vous sur ${validation.existingType === 'establishment' ? "l'interface Établissement" : "l'interface appropriée"}.` });
        }
        setIsLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${APP_ORIGIN}/housekeeper/hotels`,
          data: { name, user_type: 'housekeeper' }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erreur lors de la création du compte");

      const { error: profileError } = await supabase
        .from('housekeeper_profiles')
        .insert({ id: authData.user.id, name, email, is_active: true, total_rooms_cleaned: 0, total_hotels_worked: 0 });

      if (profileError) console.error('Erreur création profil:', profileError);

      toast({ title: "Inscription réussie ! 🎉", description: "Connectez-vous avec votre email et ajoutez le code de votre hôtel" });
      navigate('/housekeeper/auth');
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      toast({ variant: "destructive", title: "Erreur d'inscription", description: error.message || "Une erreur est survenue" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blur circles */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-violet-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />

      {/* Back button */}
      <div className="absolute top-4 left-4 z-20">
        <Link to="/housekeeper/auth">
          <Button variant="ghost" size="icon" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* External header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl shadow-lg">
              <UserPlus className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Créer un compte</h1>
          <p className="text-white/80 text-sm sm:text-base">Inscrivez-vous pour gérer vos services dans plusieurs hôtels</p>
        </div>

        {/* Glassmorphic card */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4 text-violet-600" />
                  Nom complet
                </Label>
                <Input id="name" type="text" placeholder="Marie Dupont" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-slate-50 border-slate-200 text-base" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-violet-600" />
                  Email
                </Label>
                <Input id="email" type="email" placeholder="marie@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-slate-50 border-slate-200 text-base" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4 text-violet-600" />
                  Mot de passe
                </Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-slate-50 border-slate-200 text-base" required />
                <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4 text-violet-600" />
                  Confirmer le mot de passe
                </Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 bg-slate-50 border-slate-200 text-base" required />
              </div>

              <Button type="submit" className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Création du compte...</>
                ) : (
                  <><UserPlus className="h-4 w-4 mr-2" />S'inscrire</>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Vous avez déjà un compte ?{' '}
                <Link to="/housekeeper/auth" className="text-violet-600 hover:underline font-medium">
                  Se connecter
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
