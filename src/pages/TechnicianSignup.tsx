import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Loader2 } from 'lucide-react';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';

export default function TechnicianSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useTechnicianAuth();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas"
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
      const { error } = await signUp(email, password, name, phone);

      if (error) throw error;

      toast({
        title: "Inscription réussie ! ✅",
        description: "Vous pouvez maintenant vous connecter et demander l'accès à un établissement"
      });

      navigate('/technician/login');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-4 rounded-full">
              <Wrench className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Inscription Technicien</CardTitle>
          <CardDescription>
            Créez votre compte pour accéder aux incidents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet *</Label>
              <Input
                id="name"
                placeholder="Jean Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="technicien@hotel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone (optionnel)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Inscription...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  S'inscrire
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link to="/technician/login" className="text-primary hover:underline">
                Se connecter
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
