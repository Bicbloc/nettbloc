import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, LogOut, User, Loader2, CheckCircle2, Crown, Clock, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
// Gouvernantes use localStorage auth, not Supabase Auth - no UserTypeGuard needed

interface GovernessProfile {
  id: string;
  name: string;
  email: string;
}

interface Hotel {
  id: string;
  name: string;
  hotel_code: string;
  approved_at?: string;
}

interface PendingRequest {
  id: string;
  hotel_id: string;
  hotel_code: string;
  status: string;
  requested_at: string;
  hotels: { name: string } | null;
}

function GovernessHotelsContent() {
  const [profile, setProfile] = useState<GovernessProfile | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [hotelCode, setHotelCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingHotel, setIsAddingHotel] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const storedProfile = localStorage.getItem('governess_profile');
      if (!storedProfile) {
        navigate('/governess/auth');
        return;
      }

      const parsedProfile = JSON.parse(storedProfile);
      setProfile(parsedProfile);

      // Charger les hôtels via sessions actives
      const { data: sessions, error } = await supabase
        .from('governess_hotel_sessions')
        .select(`
          hotel_id,
          started_at,
          hotels:hotel_id (
            id,
            name,
            hotel_code
          )
        `)
        .eq('governess_profile_id', parsedProfile.id)
        .eq('is_active', true);

      if (error) throw error;

      if (sessions && sessions.length > 0) {
        const uniqueHotels: Hotel[] = sessions
          .map(s => ({
            id: (s.hotels as any)?.id as string,
            name: (s.hotels as any)?.name as string,
            hotel_code: (s.hotels as any)?.hotel_code as string,
            approved_at: s.started_at || undefined
          }))
          .filter(h => h.id !== undefined);
        
        setHotels(uniqueHotels);
      }

      // Charger les demandes en attente
      const { data: requests } = await supabase
        .from('governess_access_requests')
        .select(`
          id,
          hotel_id,
          hotel_code,
          status,
          requested_at,
          hotels:hotel_id (name)
        `)
        .eq('governess_profile_id', parsedProfile.id)
        .in('status', ['pending', 'rejected'])
        .order('requested_at', { ascending: false });

      setPendingRequests(requests || []);

    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHotel = async () => {
    if (!hotelCode.trim() || !profile) return;

    setIsAddingHotel(true);

    try {
      const { data, error } = await supabase.functions.invoke('governess-request-hotel-access', {
        body: { 
          hotelCode: hotelCode.trim(),
          governessProfileId: profile.id
        }
      });

      if (error) throw error;

      if (data.error === 'hotel_not_found') {
        toast({
          variant: "destructive",
          title: "Code introuvable",
          description: `Le code "${hotelCode.toUpperCase().trim()}" n'existe pas`
        });
        return;
      }

      if (data.error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: data.details || data.error
        });
        return;
      }

      if (data.status === 'already_has_access') {
        toast({
          title: "Déjà accès",
          description: `Vous avez déjà accès à "${data.hotel.name}"`
        });
        setShowAddDialog(false);
        return;
      }

      if (data.status === 'request_pending') {
        toast({
          title: "Demande déjà en cours",
          description: `Votre demande pour "${data.hotel.name}" est en attente.`
        });
        setShowAddDialog(false);
        checkUser();
        return;
      }

      if (data.status === 'request_submitted') {
        toast({
          title: "Demande envoyée !",
          description: `Demande d'accès à "${data.hotel.name}" soumise.`
        });
        setShowAddDialog(false);
        setHotelCode('');
        checkUser();
      }
    } catch (error: any) {
      console.error('Erreur ajout hôtel:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Erreur inattendue"
      });
    } finally {
      setIsAddingHotel(false);
    }
  };

  const handleSelectHotel = (hotel: Hotel) => {
    // Sauvegarder l'hôtel sélectionné
    localStorage.setItem('governess_selected_hotel', JSON.stringify(hotel));
    
    toast({
      title: "Hôtel sélectionné ! 🏨",
      description: `Vous travaillez maintenant pour ${hotel.name}`
    });
    
    navigate('/governess/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('governess_profile');
    localStorage.removeItem('governess_selected_hotel');
    toast({
      title: "Déconnexion",
      description: "À bientôt !"
    });
    navigate('/governess/auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-3 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Bouton Retour */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/governess/auth')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour</span>
        </Button>

        {/* Profil */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="bg-amber-100 p-3 rounded-full flex-shrink-0">
                  <Crown className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate">{profile.name}</CardTitle>
                  <CardDescription className="truncate">{profile.email}</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="w-full sm:w-auto"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Demandes en attente */}
        {pendingRequests.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Demandes en attente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingRequests.filter(r => r.status === 'pending').map(request => (
                <div 
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="font-medium">{request.hotels?.name || request.hotel_code}</p>
                      <p className="text-xs text-muted-foreground">
                        Demandé le {new Date(request.requested_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                    En attente
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Mes hôtels */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Building2 className="h-5 w-5" />
                  Mes hôtels
                </CardTitle>
                <CardDescription className="text-sm">
                  Sélectionnez un hôtel pour commencer
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowAddDialog(true)}
                size="sm"
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un hôtel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {hotels.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Building2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-base sm:text-lg mb-2">Aucun hôtel enregistré</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 px-4">
                  Ajoutez votre premier hôtel pour commencer
                </p>
                <Button onClick={() => setShowAddDialog(true)} className="bg-amber-600 hover:bg-amber-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un hôtel
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 sm:gap-3">
                {hotels.map((hotel) => (
                  <button
                    key={hotel.id}
                    onClick={() => handleSelectHotel(hotel)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-2 rounded-lg hover:bg-accent transition-all text-left gap-3 border-amber-300 hover:border-amber-500"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="bg-amber-100 p-2 rounded flex-shrink-0">
                        <Building2 className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{hotel.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          Code: {hotel.hotel_code}
                        </p>
                      </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog pour ajouter un hôtel */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-600" />
              Demander l'accès à un hôtel
            </DialogTitle>
            <DialogDescription>
              Entrez le code de l'établissement fourni par votre responsable
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hotel-code">Code hôtel</Label>
              <Input
                id="hotel-code"
                placeholder="Ex: HTL630"
                value={hotelCode}
                onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAddingHotel) {
                    handleAddHotel();
                  }
                }}
                className="uppercase"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isAddingHotel}>
              Annuler
            </Button>
            <Button
              onClick={handleAddHotel}
              disabled={!hotelCode.trim() || isAddingHotel}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isAddingHotel ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Envoyer la demande'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Gouvernantes use localStorage auth - no Supabase Auth guard needed
export default function GovernessHotels() {
  return <GovernessHotelsContent />;
}
