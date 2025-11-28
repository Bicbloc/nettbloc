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
import { HotelStorageService } from '@/services/hotelStorageService';

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
      console.log('🔍 Chargement des hôtels approuvés pour:', profileData.id);
      const { data: approvedHotels, error: hotelsError } = await supabase
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

      console.log('📋 Hôtels approuvés trouvés:', approvedHotels);
      if (hotelsError) {
        console.error('❌ Erreur chargement hôtels:', hotelsError);
      }

      if (approvedHotels) {
        const uniqueHotels = Array.from(
          new Map(approvedHotels.map(item => [item.hotel_id, item.hotels])).values()
        ).filter(h => h !== null);
        setHotels(uniqueHotels);

        // Charger le nombre de chambres assignées pour chaque hôtel
        const assignmentCounts: Record<string, number> = {};
        // Load assignments in parallel with timeout
        const assignmentPromises = uniqueHotels.map(async (hotel) => {
          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 10000)
            );

            const queryPromise = supabase
              .from('assignments')
              .select('*', { count: 'exact', head: true })
              .eq('hotel_id', hotel.id)
              .eq('housekeeper_id', profileData.id)
              .in('status', ['assigned', 'in_progress']);

            const { count } = await Promise.race([queryPromise, timeoutPromise]);
            assignmentCounts[hotel.id] = count || 0;
          } catch (error) {
            console.error(`Error loading assignments for hotel ${hotel.id}:`, error);
            assignmentCounts[hotel.id] = 0;
          }
        });

        await Promise.all(assignmentPromises);
        setHotelAssignments(assignmentCounts);
        console.log('✅ Comptage assignations final:', assignmentCounts);
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
    import('@/services/hotelStorageService').then(({ HotelStorageService }) => {
      HotelStorageService.save({
        id: hotel.id,
        name: hotel.name,
        code: hotel.hotel_code,
      });
      
      // Store housekeeper profile
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
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    HotelStorageService.clear();
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-3 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Profil */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="bg-purple-100 p-3 rounded-full flex-shrink-0">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate">{profile.name}</CardTitle>
                  <CardDescription className="truncate">{profile.email}</CardDescription>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/housekeeper/profile')}
                  className="w-full sm:w-auto"
                >
                  <User className="h-4 w-4 mr-2" />
                  Mon profil
                </Button>
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
            </div>
          </CardHeader>
        </Card>

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
                  Sélectionnez un hôtel pour commencer à travailler
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowAddDialog(true)}
                size="sm"
                className="w-full sm:w-auto"
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
                  Ajoutez votre premier hôtel pour commencer à travailler
                </p>
                <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un hôtel
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 sm:gap-3">
                {hotels.map((hotel: any) => {
                  const assignedRooms = hotelAssignments[hotel.id] || 0;
                  const hasAssignments = assignedRooms > 0;
                  
                  return (
                    <button
                      key={hotel.id}
                      onClick={() => handleSelectHotel(hotel)}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-2 rounded-lg hover:bg-accent transition-all text-left gap-3 ${
                        hasAssignments 
                          ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className={`p-2 rounded flex-shrink-0 ${
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
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium truncate">{hotel.name}</p>
                            {hasAssignments && (
                              <Badge variant="default" className="bg-green-600 text-xs">
                                {assignedRooms} {assignedRooms === 1 ? 'chambre' : 'chambres'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            Code: {hotel.hotel_code}
                          </p>
                        </div>
                      </div>
                      <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${
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
