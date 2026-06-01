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
import { storageService } from '@/services/storageService';
import { realtimeManager } from '@/services/RealtimeManager';
import { UserTypeGuard } from '@/hooks/use-user-type-guard';

function HousekeeperHotelsContent() {
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
    // 🔍 DIAGNOSTIC boucle de rechargement femme de chambre
    try {
      const navType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type;
      const count = Number(sessionStorage.getItem('hk_hotels_loadcount') || '0') + 1;
      sessionStorage.setItem('hk_hotels_loadcount', String(count));
      console.log('🔍 [HK-HOTELS] mount', {
        navType,
        loadCount: count,
        url: window.location.href,
        ts: new Date().toISOString(),
      });
    } catch (e) {
      console.log('🔍 [HK-HOTELS] diag error', e);
    }

    // Handle email confirmation token exchange before checking user
    const handleTokenExchange = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const hash = window.location.hash;
      
      // PKCE flow: ?code=...
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
          // Clean URL after exchange
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error('Token exchange error:', err);
        }
      }
      // Legacy hash flow: #access_token=...
      else if (hash.includes('access_token')) {
        // detectSessionInUrl handles this, but give it time
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      checkUser();
    };
    
    handleTokenExchange();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/housekeeper/auth');
        return;
      }

      const userEmail = session.user.email?.trim().toLowerCase();

      // Charger le profil par email
      const { data: profileData, error: profileError } = await supabase
        .from('housekeeper_profiles')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      // Auto-create profile if missing (e.g. after email confirmation)
      if (!profileData && !profileError) {
        const meta = session.user.user_metadata || {};
        const isHousekeeper = meta.user_type === 'housekeeper';
        
        if (isHousekeeper || !meta.user_type) {
          const fallbackName = meta.name?.trim() || userEmail?.split('@')[0] || 'Femme de chambre';
          
          const { data: newProfile, error: createError } = await supabase
            .from('housekeeper_profiles')
            .upsert(
              {
                id: session.user.id,
                email: userEmail,
                name: fallbackName,
                phone: meta.phone ?? null,
                is_active: true,
                total_rooms_cleaned: 0,
                total_hotels_worked: 0,
              },
              { onConflict: 'id' }
            )
            .select('*')
            .single();

          if (createError) {
            console.error('Error creating housekeeper profile:', createError);
            toast({
              variant: "destructive",
              title: "Erreur",
              description: "Impossible de créer votre profil. Veuillez réessayer."
            });
            navigate('/housekeeper/auth');
            return;
          }

          toast({
            title: "Compte activé ! 🎉",
            description: `Bienvenue ${newProfile.name} ! Ajoutez le code de votre hôtel pour commencer.`
          });

          setProfile(newProfile);
          setHotels([]);
          setIsLoading(false);
          return;
        } else {
          toast({
            variant: "destructive",
            title: "Mauvaise interface",
            description: "Ce compte n'est pas un compte femme de chambre."
          });
          navigate('/housekeeper/auth');
          return;
        }
      }

      if (profileError) {
        console.error('Profile load error:', profileError);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger votre profil."
        });
        navigate('/housekeeper/auth');
        return;
      }

      setProfile(profileData);

      // Charger les hôtels enregistrés via RPC SECURITY DEFINER (bypass RLS)
      const { data: approvedHotels, error: hotelsError } = await supabase
        .rpc('get_approved_hotels_for_housekeeper' as any, { 
          p_housekeeper_profile_id: profileData.id 
        });

      if (hotelsError) {
        console.error('❌ Erreur chargement hôtels:', hotelsError);
      }

      const hotelsArray = approvedHotels as Array<{ hotel_id: string; hotel_name: string; hotel_code: string; approved_at: string }> | null;
      
      if (hotelsArray && hotelsArray.length > 0) {
        // Transformer les données RPC en format attendu
        const uniqueHotels = hotelsArray.map((h) => ({
          id: h.hotel_id,
          name: h.hotel_name,
          hotel_code: h.hotel_code,
          approved_at: h.approved_at
        }));

        // Charger le nombre de chambres assignées pour chaque hôtel
        const assignmentCounts: Record<string, number> = {};
        const lastActivityMap: Record<string, string> = {};
        
        // Load assignments in parallel with timeout
        const assignmentPromises = uniqueHotels.map(async (hotel) => {
          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 10000)
            );

            // Chercher par housekeeper_id OU housekeeper_name pour couvrir tous les cas
            const queryPromise = supabase
              .from('assignments')
              .select('created_at', { count: 'exact' })
              .eq('hotel_id', hotel.id)
              .or(`housekeeper_id.eq.${profileData.id},housekeeper_name.eq.${profileData.name}`)
              .in('status', ['assigned', 'in_progress'])
              .order('created_at', { ascending: false })
              .limit(1);

            const { count, data } = await Promise.race([queryPromise, timeoutPromise]);
            assignmentCounts[hotel.id] = count || 0;
            
            // Track last activity (most recent assignment)
            if (data && data.length > 0) {
              lastActivityMap[hotel.id] = data[0].created_at;
            }
          } catch (error) {
            console.error(`Error loading assignments for hotel ${hotel.id}:`, error);
            assignmentCounts[hotel.id] = 0;
          }
        });

        await Promise.all(assignmentPromises);
        setHotelAssignments(assignmentCounts);
        
        // Sort hotels: today's active hotel first (has recent assignments), then by name
        const today = new Date().toISOString().split('T')[0];
        const sortedHotels = [...uniqueHotels].sort((a, b) => {
          const aHasAssignments = assignmentCounts[a.id] > 0;
          const bHasAssignments = assignmentCounts[b.id] > 0;
          const aLastActivity = lastActivityMap[a.id];
          const bLastActivity = lastActivityMap[b.id];
          const aIsToday = aLastActivity && aLastActivity.startsWith(today);
          const bIsToday = bLastActivity && bLastActivity.startsWith(today);
          
          // Today's hotel with assignments comes first
          if (aIsToday && aHasAssignments && !(bIsToday && bHasAssignments)) return -1;
          if (bIsToday && bHasAssignments && !(aIsToday && aHasAssignments)) return 1;
          
          // Then hotels with assignments
          if (aHasAssignments && !bHasAssignments) return -1;
          if (bHasAssignments && !aHasAssignments) return 1;
          
          // Then by name
          return a.name.localeCompare(b.name);
        });
        
        setHotels(sortedHotels);
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
      // Trouver l'hôtel par son code via RPC sécurisée (bypass RLS)
      const { data: hotelData, error: hotelError } = await supabase
        .rpc('search_hotel_by_code', { p_code: hotelCode.trim() })
        .maybeSingle();

      if (hotelError) {
        console.error('Erreur recherche hôtel:', hotelError);
        throw new Error("Erreur lors de la recherche de l'établissement");
      }
      
      if (!hotelData) {
        throw new Error("Code d'établissement introuvable. Vérifiez le code auprès de votre responsable.");
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
    
    try {
      // 1. SAUVEGARDER D'ABORD le nouvel hôtel (avant de nettoyer)
      storageService.saveHotel({
        id: hotel.id,
        name: hotel.name,
        code: hotel.hotel_code,
      });
      
      // 2. Sauvegarder le profil housekeeper avec les infos hôtel
      localStorage.setItem('housekeeperProfile', JSON.stringify({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        isAuthenticated: true,
        currentHotelId: hotel.id // Backup additionnel
      }));

      // 3. Sauvegarde redondante pour récupération
      localStorage.setItem('lastSelectedHotelId', hotel.id);
      localStorage.setItem('lastSelectedHotelName', hotel.name);

      // 4. Vérifier que les données sont bien sauvegardées
      const savedId = localStorage.getItem('selectedHotelId');

      // 5. Forcer la reconnexion realtime pour le nouvel hôtel
      realtimeManager.disconnect();
      
      // 6. Naviguer seulement après confirmation de la sauvegarde
      if (savedId === hotel.id) {
        toast({
          title: "Hôtel sélectionné ! 🏨",
          description: `Vous travaillez maintenant pour ${hotel.name}`
        });
        navigate('/housekeeper/work');
      } else {
        throw new Error('Échec de la sauvegarde localStorage');
      }
    } catch (error) {
      console.error('❌ Erreur sélection hôtel:', error);
      toast({
        variant: "destructive",
        title: "Erreur de synchronisation",
        description: "Veuillez réessayer de sélectionner l'hôtel"
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    storageService.clearHotel();
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
                {hotels.map((hotel: any, index: number) => {
                  const assignedRooms = hotelAssignments[hotel.id] || 0;
                  const hasAssignments = assignedRooms > 0;
                  const isTodayHotel = index === 0 && hasAssignments; // First hotel with assignments is "today's"
                  
                  return (
                    <button
                      key={hotel.id}
                      onClick={() => handleSelectHotel(hotel)}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-2 rounded-lg hover:bg-accent transition-all text-left gap-3 ${
                        isTodayHotel
                          ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 shadow-lg shadow-orange-200/50' 
                          : hasAssignments 
                          ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className={`p-2 rounded flex-shrink-0 ${
                          isTodayHotel
                            ? 'bg-orange-100 dark:bg-orange-900'
                            : hasAssignments 
                            ? 'bg-green-100 dark:bg-green-900' 
                            : 'bg-purple-100 dark:bg-purple-900'
                        }`}>
                          <Building2 className={`h-5 w-5 ${
                            isTodayHotel
                              ? 'text-orange-600 dark:text-orange-400'
                              : hasAssignments 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-purple-600 dark:text-purple-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium truncate">{hotel.name}</p>
                            {isTodayHotel && (
                              <Badge className="bg-orange-500 text-white text-xs animate-pulse">
                                📅 Aujourd'hui
                              </Badge>
                            )}
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
                        isTodayHotel
                          ? 'text-orange-600 dark:text-orange-400'
                          : hasAssignments 
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

// Wrapper avec le guard de type d'utilisateur
export default function HousekeeperHotels() {
  return (
    <UserTypeGuard expectedType="housekeeper">
      <HousekeeperHotelsContent />
    </UserTypeGuard>
  );
}
