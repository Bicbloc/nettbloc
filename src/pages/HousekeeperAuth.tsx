import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { HousekeeperGuestMode } from '@/components/HousekeeperGuestMode';
import { useHousekeeperAuth } from '@/contexts/HousekeeperAuthContext';
import { Hotel, User, Key } from 'lucide-react';

const HousekeeperAuth: React.FC = () => {
  const [mode, setMode] = useState<'auth' | 'guest'>('auth');
  const [authType, setAuthType] = useState<'login' | 'signup'>('login');
  const [guestCode, setGuestCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hotelCode, setHotelCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signUp, signIn, connectToHotel, isAuthenticated, isConnectedToHotel } = useHousekeeperAuth();

  // Redirect if already authenticated and connected
  if (isAuthenticated && isConnectedToHotel) {
    navigate('/housekeeper/work');
    return null;
  }

  if (isAuthenticated && !isConnectedToHotel) {
    navigate('/housekeeper/dashboard');
    return null;
  }

  const handleGuestAccess = () => {
    if (!guestCode.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un code d'accès",
        variant: "destructive"
      });
      return;
    }

    // Check if it's a full access code (like HTL002-AMI-1234)
    if (guestCode.includes('-') && guestCode.split('-').length >= 3) {
      setMode('guest');
    } else {
      toast({
        title: "Code invalide",
        description: "Le code d'accès invité doit contenir des tirets (ex: HTL002-AMI-1234)",
        variant: "destructive"
      });
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let result;
      if (authType === 'signup') {
        result = await signUp(email, password, name, phone);
      } else {
        result = await signIn(email, password);
      }

      if (result.error) {
        toast({
          title: "Erreur d'authentification",
          description: result.error.message,
          variant: "destructive"
        });
        return;
      }

      if (authType === 'signup') {
        toast({
          title: "Compte créé",
          description: "Vérifiez votre email pour confirmer votre compte"
        });
      } else {
        toast({
          title: "Connexion réussie",
          description: "Redirection vers votre tableau de bord..."
        });
        navigate('/housekeeper/dashboard');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHotelConnect = async () => {
    if (!hotelCode.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un code",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await connectToHotel(hotelCode);
      
      if (result.success) {
        toast({
          title: "Connexion réussie",
          description: "Vous êtes maintenant connectée à l'hôtel"
        });
        navigate('/housekeeper/work');
      } else {
        toast({
          title: "Erreur de connexion",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Hotel connect error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'guest' && guestCode) {
    return <HousekeeperGuestMode accessCode={guestCode} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Hotel className="h-12 w-12 mx-auto text-blue-600 mb-4" />
          <h1 className="text-2xl font-bold">Espace Femme de chambre</h1>
          <p className="text-muted-foreground">Connectez-vous à votre hôtel</p>
        </div>

        {/* Guest Mode Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Accès invité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="guest-code">Code d'accès temporaire</Label>
              <Input
                id="guest-code"
                value={guestCode}
                onChange={(e) => setGuestCode(e.target.value)}
                placeholder="HTL002-AMI-1234"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Utilisez le code fourni par l'admin
              </p>
            </div>
            <Button 
              onClick={handleGuestAccess}
              className="w-full"
              disabled={isLoading}
            >
              Accéder en mode invité
            </Button>
          </CardContent>
        </Card>

        {/* Authentication Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Compte personnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex mb-4">
              <Button
                variant={authType === 'login' ? 'default' : 'outline'}
                onClick={() => setAuthType('login')}
                className="flex-1 mr-1"
              >
                Connexion
              </Button>
              <Button
                variant={authType === 'signup' ? 'default' : 'outline'}
                onClick={() => setAuthType('signup')}
                className="flex-1 ml-1"
              >
                Inscription
              </Button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authType === 'signup' && (
                <>
                  <div>
                    <Label htmlFor="name">Nom complet</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Téléphone (optionnel)</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Chargement...' : authType === 'login' ? 'Se connecter' : 'S\'inscrire'}
              </Button>
            </form>

            {/* Hotel connection for authenticated users */}
            {isAuthenticated && (
              <div className="mt-6 pt-4 border-t">
                <Label htmlFor="hotel-code">Code d'hôtel ou code d'accès</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="hotel-code"
                    value={hotelCode}
                    onChange={(e) => setHotelCode(e.target.value)}
                    placeholder="HTL002 ou HTL002-AMI-1234"
                  />
                  <Button onClick={handleHotelConnect} disabled={isLoading}>
                    Connecter
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HousekeeperAuth;