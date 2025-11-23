import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, LogOut, User, MapPin, Clock, Star, Loader2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HotelHistory {
  id: string;
  hotel_id: string;
  started_at: string;
  ended_at: string | null;
  rooms_cleaned: number;
  is_favorite: boolean;
  hotels: {
    name: string;
    hotel_code: string;
    address: string;
  };
}

export default function HousekeeperHotels() {
  const [profile, setProfile] = useState<any>(null);
  const [hotelHistory, setHotelHistory] = useState<HotelHistory[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [hotelCode, setHotelCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/housekeeper/auth');
        return;
      }

      // Charger le profil
      const { data: profileData, error: profileError } = await supabase
        .from('housekeeper_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profileData) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger votre profil"
        });
        return;
      }

      setProfile(profileData);

      // Charger l'historique des hôtels
      const { data: historyData, error: historyError } = await supabase
        .from('housekeeper_hotel_history')
        .select(`
          *,
          hotels (
            name,
            hotel_code,
            address
          )
        `)
        .eq('housekeeper_profile_id', session.user.id)
        .order('started_at', { ascending: false });

      if (!historyError && historyData) {
        setHotelHistory(historyData as any);
      }

      // Charger la session active
      const { data: sessionData } = await supabase
        .from('hotel_access_sessions')
        .select(`
          *,
          hotels (
            name,
            hotel_code
          )
        `)
        .eq('housekeeper_profile_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (sessionData) {
        setActiveSession(sessionData);
      }

    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectToHotel = async () => {
    if (!hotelCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code requis",
        description: "Veuillez saisir le code de l'hôtel"
      });
      return;
    }

    setIsConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Vérifier le code de l'hôtel
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('hotel_code', hotelCode.toUpperCase())
        .single();

      if (hotelError || !hotel) {
        toast({
          variant: "destructive",
          title: "Hôtel non trouvé",
          description: "Le code de l'hôtel est invalide"
        });
        return;
      }

      // Créer une demande d'accès
      const { data: request, error: requestError } = await supabase
        .from('housekeeper_access_requests')
        .insert({
          housekeeper_profile_id: session.user.id,
          hotel_code: hotelCode.toUpperCase(),
          hotel_id: hotel.id,
          status: 'pending'
        })
        .select()
        .single();

      if (requestError) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de créer la demande d'accès"
        });
        return;
      }

      toast({
        title: "Demande envoyée ! 📩",
        description: `Votre demande d'accès à ${hotel.name} a été envoyée. Vous serez notifié une fois approuvée.`
      });

      setShowConnectDialog(false);
      setHotelCode('');

    } catch (error: any) {
      console.error('Erreur connexion hôtel:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Une erreur est survenue"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleWorkAtHotel = (hotelId: string, hotelName: string) => {
    // Sauvegarder l'hôtel sélectionné
    localStorage.setItem('selectedHotelId', hotelId);
    localStorage.setItem('selectedHotelName', hotelName);
    localStorage.setItem('housekeeper', JSON.stringify({
      id: profile.id,
      name: profile.name
    }));

    navigate('/housekeeper/work');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate('/housekeeper/auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-6">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <Card className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                {profile?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{profile?.name}</h1>
                <p className="text-blue-100">{profile?.email}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="bg-white/20 text-white border-none">
                    {profile?.total_rooms_cleaned} chambres nettoyées
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white border-none">
                    {profile?.total_hotels_worked} hôtels
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/housekeeper/profile')} className="text-white hover:bg-white/20">
                <User className="h-4 w-4 mr-2" />
                Profil
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-white/20">
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Session active */}
        {activeSession && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Session active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{activeSession.hotels.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeSession.rooms_cleaned_today} chambres nettoyées aujourd'hui
                  </p>
                </div>
                <Button onClick={() => handleWorkAtHotel(activeSession.hotel_id, activeSession.hotels.name)}>
                  Continuer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ajouter un hôtel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Se connecter à un nouvel hôtel
            </CardTitle>
            <CardDescription>
              Demandez l'accès à un hôtel avec son code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <KeyRound className="h-4 w-4 mr-2" />
                  Ajouter un hôtel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Se connecter à un hôtel</DialogTitle>
                  <DialogDescription>
                    Saisissez le code de l'hôtel fourni par votre superviseur
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="hotelCode">Code de l'hôtel</Label>
                    <Input
                      id="hotelCode"
                      placeholder="Ex: HTL002"
                      value={hotelCode}
                      onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
                      className="text-center font-mono"
                    />
                  </div>
                  <Button
                    onClick={handleConnectToHotel}
                    disabled={isConnecting}
                    className="w-full"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Envoi...
                      </>
                    ) : (
                      'Envoyer la demande'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Historique des hôtels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Mes hôtels ({hotelHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hotelHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Vous n'avez pas encore travaillé dans d'hôtels
              </p>
            ) : (
              <div className="space-y-3">
                {hotelHistory.map((history) => (
                  <Card key={history.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{history.hotels.name}</h3>
                            {history.is_favorite && (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            )}
                            {!history.ended_at && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Actif
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {history.hotels.address || 'Non renseigné'}
                            </span>
                            <span>{history.rooms_cleaned} chambres</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWorkAtHotel(history.hotel_id, history.hotels.name)}
                        >
                          Travailler
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
