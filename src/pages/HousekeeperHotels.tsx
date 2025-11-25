import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, LogOut, User, Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function HousekeeperHotels() {
  const [profile, setProfile] = useState<any>(null);
  const [hotels, setHotels] = useState<any[]>([]);
  const [hotelCode, setHotelCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingHotel, setIsAddingHotel] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [hotelAssignments, setHotelAssignments] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/housekeeper/auth');
        return;
      }

      // Charger le profil par email
      const { data: profileData, error: profileError } = await supabase
        .from('housekeeper_profiles')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      if (profileError || !profileData) {
        toast({
          variant: "destructive",
          title: "Profil non trouvé",
          description: "Veuillez créer un compte"
        });
        navigate('/housekeeper/signup');
        return;
      }

      setProfile(profileData);

      // Charger les hôtels enregistrés (uniquement ceux approuvés)
      const { data: approvedHotels } = await supabase
        .from('housekeeper_access_requests')
        .select(`
          hotel_id,
          hotels (
            id,
            name,
            hotel_code
          )
        `)
        .eq('housekeeper_profile_id', profileData.id)
        .eq('status', 'approved')
        .order('requested_at', { ascending: false });

      if (approvedHotels) {
        const uniqueHotels = Array.from(
          new Map(approvedHotels.map(item => [item.hotel_id, item.hotels])).values()
        ).filter(h => h !== null);
        setHotels(uniqueHotels);

        // Charger le nombre de chambres assignées pour chaque hôtel
        const assignmentCounts: Record<string, number> = {};
        for (const hotel of uniqueHotels) {
          const { count } = await supabase
            .from('assignments')
            .select('*', { count: 'exact', head: true })
            .eq('hotel_id', hotel.id)
            .eq('housekeeper_id', profileData.id)
            .in('status', ['assigned', 'in_progress']);
          
          assignmentCounts[hotel.id] = count || 0;
        }
        setHotelAssignments(assignmentCounts);
      }

    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHotel = async () => {
    if (!hotelCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code requis",
        description: "Veuillez entrer un code d'hôtel"
      });
      return;
    }

    setIsAddingHotel(true);

    try {
      // Trouver l'hôtel par son code
      const { data: hotelData, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('hotel_code', hotelCode.trim().toUpperCase())
        .single();

      if (hotelError || !hotelData) {
        throw new Error("Code d'hôtel invalide");
      }

      // Vérifier si une demande existe déjà
      const { data: existingRequest } = await supabase
        .from('housekeeper_access_requests')
        .select('id, status')
        .eq('housekeeper_profile_id', profile.id)
        .eq('hotel_id', hotelData.id)
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          throw new Error("Une demande d'accès est déjà en attente pour cet hôtel");
        }
        if (existingRequest.status === 'approved') {
          throw new Error("Vous êtes déjà approuvé pour cet hôtel");
        }
      }

      // Créer une demande d'accès
      const { error: requestError } = await supabase
        .from('housekeeper_access_requests')
        .insert({
          housekeeper_profile_id: profile.id,
          hotel_id: hotelData.id,
          hotel_code: hotelCode.trim().toUpperCase(),
          status: 'pending',
          requested_at: new Date().toISOString()
        });

      if (requestError) throw requestError;

      toast({
        title: "Demande envoyée ! 📤",
        description: `Votre demande pour ${hotelData.name} est en attente d'approbation`
      });

      setHotelCode('');
      setShowAddDialog(false);
      checkUser(); // Rafraîchir

    } catch (error: any) {
      console.error('Erreur ajout hôtel:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Code d'hôtel invalide"
      });
    } finally {
      setIsAddingHotel(false);
    }
  };

  const handleSelectHotel = (hotel: any) => {
     // Nettoyer les anciennes données de connexion (codes temporaires)
     localStorage.removeItem('housekeeper');
 
     // Stocker les infos dans le localStorage pour une femme de chambre authentifiée
     localStorage.setItem('selectedHotelId', hotel.id);
     localStorage.setItem('selectedHotelName', hotel.name);
     localStorage.setItem('selectedHotelCode', hotel.hotel_code || '');
     localStorage.setItem('housekeeperProfile', JSON.stringify({
       id: profile.id,
       name: profile.name,
       email: profile.email,
       isAuthenticated: true
     }));
 
     toast({
       title: "Hôtel sélectionné ! 🏨",
       description: `Vous travaillez maintenant pour ${hotel.name}`
     });
 
     navigate('/housekeeper/work');
   };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate('/housekeeper/auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profil */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-3 rounded-full">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>{profile.name}</CardTitle>
                  <CardDescription>{profile.email}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/housekeeper/profile')}
                >
                  <User className="h-4 w-4 mr-2" />
                  Mon profil
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Mes hôtels */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Mes hôtels
                </CardTitle>
                <CardDescription>
                  Sélectionnez un hôtel pour commencer à travailler
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowAddDialog(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un hôtel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {hotels.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-lg mb-2">Aucun hôtel enregistré</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ajoutez votre premier hôtel pour commencer à travailler
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un hôtel
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {hotels.map((hotel: any) => {
                  const assignedRooms = hotelAssignments[hotel.id] || 0;
                  const hasAssignments = assignedRooms > 0;
                  
                  return (
                    <button
                      key={hotel.id}
                      onClick={() => handleSelectHotel(hotel)}
                      className={`flex items-center justify-between p-4 border-2 rounded-lg hover:bg-accent transition-all text-left ${
                        hasAssignments 
                          ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${
                          hasAssignments 
                            ? 'bg-green-100 dark:bg-green-900' 
                            : 'bg-purple-100 dark:bg-purple-900'
                        }`}>
                          <Building2 className={`h-5 w-5 ${
                            hasAssignments 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-purple-600 dark:text-purple-400'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{hotel.name}</p>
                            {hasAssignments && (
                              <Badge variant="default" className="bg-green-600">
                                {assignedRooms} {assignedRooms === 1 ? 'chambre' : 'chambres'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Code: {hotel.hotel_code}
                          </p>
                        </div>
                      </div>
                      <CheckCircle2 className={`h-5 w-5 ${
                        hasAssignments 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-purple-600 dark:text-purple-400'
                      }`} />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog pour ajouter un hôtel */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un hôtel</DialogTitle>
            <DialogDescription>
              Demandez l'accès avec le code fourni par votre responsable
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addHotelCode">Code de l'hôtel</Label>
              <Input
                id="addHotelCode"
                placeholder="Ex: HOTEL123"
                value={hotelCode}
                onChange={(e) => setHotelCode(e.target.value.toUpperCase())}
                className="h-11"
              />
            </div>
            <Button
              onClick={handleAddHotel}
              disabled={isAddingHotel}
              className="w-full h-11"
            >
              {isAddingHotel ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Envoi de la demande...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Envoyer la demande
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
