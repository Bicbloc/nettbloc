import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Coffee, Loader2, ArrowLeft, User, Mail, Phone, Lock } from 'lucide-react';
import { useCafetiereAuth } from '@/contexts/CafetiereAuthContext';

export default function CafetiereSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useCafetiereAuth();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Veuillez remplir tous les champs obligatoires' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Les mots de passe ne correspondent pas' });
      return;
    }
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Mot de passe trop court', description: 'Le mot de passe doit contenir au moins 6 caractères' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUp(email, password, name, phone);
      if (error) throw error;
      toast({ title: 'Inscription réussie ! ✅', description: "Vous pouvez maintenant vous connecter et demander l'accès à un établissement" });
      navigate('/cafetiere/login');
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      toast({ variant: 'destructive', title: "Erreur d'inscription", description: error.message || 'Une erreur est survenue' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-600 to-amber-800 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-amber-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl" />

      <div className="absolute top-4 left-4 z-20">
        <Link to="/auth">
          <Button variant="ghost" size="icon" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <Card className="w-full max-w-md relative z-10 bg-white/95 backdrop-blur-sm shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-2xl shadow-lg">
              <Coffee className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Inscription Cafetière</CardTitle>
          <CardDescription>Créez votre compte pour déclarer les petits-déjeuners</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2 font-medium"><User className="h-4 w-4 text-amber-600" />Nom complet *</Label>
              <Input id="name" placeholder="Marie Martin" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-slate-50 border-slate-200" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-amber-600" />Email *</Label>
              <Input id="email" type="email" placeholder="cafetiere@hotel.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-slate-50 border-slate-200" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2 font-medium"><Phone className="h-4 w-4 text-amber-600" />Téléphone (optionnel)</Label>
              <Input id="phone" type="tel" placeholder="+33 6 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 bg-slate-50 border-slate-200" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-amber-600" />Mot de passe *</Label>
              <Input id="password" type="password" placeholder="Minimum 6 caractères" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-slate-50 border-slate-200" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-amber-600" />Confirmer le mot de passe *</Label>
              <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 bg-slate-50 border-slate-200" required />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full h-12 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg">
              {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Inscription...</>) : (<><Coffee className="h-4 w-4 mr-2" />S'inscrire</>)}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link to="/cafetiere/login" className="text-amber-600 hover:underline font-medium">Se connecter</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
