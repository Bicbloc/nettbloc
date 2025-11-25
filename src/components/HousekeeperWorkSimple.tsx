import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Home, LogOut, Building2, MapPin, User } from 'lucide-react';
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';
import { GamificationService } from '@/services/gamificationService';
import { BadgeUnlockNotification } from './gamification/BadgeUnlockNotification';
import { LevelUpNotification } from './gamification/LevelUpNotification';
import { LevelProgressBar } from './gamification/LevelProgressBar';
import { IncidentReportDialogSimple } from './incident/IncidentReportDialogSimple';
import { Textarea } from './ui/textarea';
import { AlertTriangle, MessageSquare } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  status: string;
  notes?: string;
  cleaning_priority: number;
}

export const HousekeeperWorkSimple: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [hotel, setHotel] = useState<any>(null);
  const [housekeeper, setHousekeeper] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [levelData, setLevelData] = useState<any>(null);
  const [newBadges, setNewBadges] = useState<any[]>([]);
  const [levelUpData, setLevelUpData] = useState<number | null>(null);
  const [roomNotes, setRoomNotes] = useState<Record<string, string>>({});

  // Essayer d'abord les query params, puis le localStorage
  const accessCodeFromUrl = searchParams.get('access_code');
  const hotelIdFromUrl = searchParams.get('hotel');
  const housekeeperNameFromUrl = searchParams.get('name');

  // Récupérer depuis localStorage
  const housekeeperData = localStorage.getItem('housekeeper') ? JSON.parse(localStorage.getItem('housekeeper')!) : null;
  const housekeeperProfile = localStorage.getItem('housekeeperProfile') ? JSON.parse(localStorage.getItem('housekeeperProfile')!) : null;
  
   const isAuthenticatedHousekeeper = housekeeperProfile?.isAuthenticated;
   const accessCode = isAuthenticatedHousekeeper 
     ? null 
     : (accessCodeFromUrl || housekeeperData?.accessCode);
   const hotelId = hotelIdFromUrl || localStorage.getItem('selectedHotelId');
   const housekeeperName = housekeeperNameFromUrl || housekeeperProfile?.name || housekeeperData?.name || 'Femme de chambre';

  useEffect(() => {
    // Une femme de chambre authentifiée n'a pas besoin de code d'accès
    if ((accessCode && hotelId) || (isAuthenticatedHousekeeper && hotelId)) {
      loadWorkData();
    } else {
      toast({
        title: "Paramètres manquants",
        description: "Veuillez vous reconnecter.",
        variant: "destructive"
      });
      // Nettoyer le localStorage
      localStorage.removeItem('housekeeper');
      localStorage.removeItem('housekeeperProfile');
      localStorage.removeItem('selectedHotelId');
      localStorage.removeItem('selectedHotelName');
      localStorage.removeItem('selectedHotelCode');
      navigate('/housekeeper/login');
    }
  }, [accessCode, hotelId, isAuthenticatedHousekeeper]);

  const loadWorkData = async () => {
    try {
      let authResult: any;
      
      // Si c'est une femme de chambre authentifiée (avec profil)
      if (isAuthenticatedHousekeeper && housekeeperProfile) {
        // Récupérer l'hôtel
        const { data: hotelData, error: hotelError } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', hotelId)
          .single();

        if (hotelError || !hotelData) {
          toast({
            title: "Erreur",
            description: "Hôtel non trouvé",
            variant: "destructive"
          });
          navigate('/housekeeper/hotels');
          return;
        }

        authResult = {
          success: true,
          hotel: hotelData,
          user: {
            id: housekeeperProfile.id,
            name: housekeeperProfile.name,
            email: housekeeperProfile.email
          }
        };
      } else {
        // Vérifier l'authentification avec le code (femmes de chambre temporaires)
        authResult = await HousekeeperAuthService.authenticateWithFullCode(accessCode!);
        
        if (!authResult.success) {
          toast({
            title: "Code invalide",
            description: authResult.error || "Code d'accès non valide",
            variant: "destructive"
          });
          navigate('/housekeeper/login');
          return;
        }
      }

      setHotel(authResult.hotel);
      setHousekeeper(authResult.user);

      // Charger les données de niveau
      const level = await GamificationService.getHousekeeperLevel(
        authResult.user?.id || authResult.user?.access_code,
        hotelId!
      );
      setLevelData(level);

      // Charger les assignations de cette femme de chambre
      // Utiliser l'ID du profil pour les femmes de chambre authentifiées
      const housekeeperId = isAuthenticatedHousekeeper 
        ? housekeeperProfile.id 
        : (authResult.user?.id || authResult.user?.access_code);

      console.log('🔍 Recherche assignations pour:', {
        housekeeperId,
        hotelId,
        isAuthenticated: isAuthenticatedHousekeeper,
        profileId: housekeeperProfile?.id
      });

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          rooms (
            id,
            room_number,
            status,
            notes,
            cleaning_priority
          )
        `)
        .eq('hotel_id', hotelId)
        .eq('housekeeper_id', housekeeperId)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false });

      console.log('📋 Assignations trouvées:', assignmentsData);
      console.log('❌ Erreur assignations (le cas échéant):', assignmentsError);

      if (assignmentsError) {
        console.error('Erreur chargement assignations:', assignmentsError);
        // Fallback: afficher toutes les chambres en attente
        loadAllPendingRooms();
      } else {
        setAssignments(assignmentsData || []);
        const roomsList = (assignmentsData || [])
          .map(a => a.rooms)
          .filter(Boolean);
        setRooms(roomsList);
      }

    } catch (error) {
      console.error('Erreur chargement données travail:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de travail",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllPendingRooms = async () => {
    // Fallback: charger toutes les chambres à nettoyer
    console.log('🔄 Fallback: Chargement de toutes les chambres à nettoyer pour hotel:', hotelId);
    const { data: roomsData, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .in('status', ['dirty', 'to_clean'])
      .order('room_number');

    console.log('🏠 Chambres en fallback:', roomsData);
    if (error) {
      console.error('❌ Erreur fallback chambres:', error);
    }

    if (!error && roomsData) {
      setRooms(roomsData);
      
      // Si aucune chambre trouvée, afficher un message informatif
      if (roomsData.length === 0) {
        toast({
          title: "Aucune chambre à nettoyer",
          description: "Toutes les chambres sont propres ou aucune chambre n'est configurée pour cet établissement.",
          variant: "default"
        });
      }
    } else if (error) {
      console.error('Erreur chargement chambres:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les chambres",
        variant: "destructive"
      });
    }
  };

  const updateRoomStatus = async (roomId: string, newStatus: string) => {
    const startTime = Date.now();
    
    try {
      // Mettre à jour le statut de la chambre
      const updateData: any = { 
        status: newStatus,
        last_cleaned_at: newStatus === 'clean' ? new Date().toISOString() : null
      };
      
      // Ajouter les notes si disponibles
      if (roomNotes[roomId]) {
        updateData.notes = roomNotes[roomId];
      }
      
      const { error: roomError } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', roomId);

      if (roomError) {
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour le statut",
          variant: "destructive"
        });
        return;
      }

      // Calculer la durée si la chambre est terminée
      let duration = 0;
      const assignment = assignments.find(a => a.rooms?.id === roomId);
      
      if (assignment && newStatus === 'clean') {
        const startedAt = new Date(assignment.started_at || assignment.assigned_at).getTime();
        duration = Math.round((Date.now() - startedAt) / 60000); // en minutes
      }

      // Mettre à jour l'assignation si elle existe
      if (assignment) {
        const updateData: any = {
          status: newStatus === 'clean' ? 'completed' : 'in_progress',
        };
        
        if (newStatus === 'in_progress') {
          updateData.started_at = new Date().toISOString();
        } else if (newStatus === 'clean') {
          updateData.completed_at = new Date().toISOString();
          updateData.actual_duration = duration;
        }

        const { error: assignmentError } = await supabase
          .from('assignments')
          .update(updateData)
          .eq('id', assignment.id);

        if (assignmentError) {
          console.error('Erreur mise à jour assignation:', assignmentError);
        }
      }

      // Si la chambre est terminée, ajouter de l'XP
      if (newStatus === 'clean' && housekeeper && hotelId) {
        const gamificationResult = await GamificationService.addXpForRoomCleaned(
          housekeeper.id || housekeeper.access_code,
          hotelId,
          duration
        );

        if (gamificationResult) {
          // Recharger les données de niveau
          const updatedLevel = await GamificationService.getHousekeeperLevel(
            housekeeper.id || housekeeper.access_code,
            hotelId
          );
          setLevelData(updatedLevel);

          // Afficher les notifications de nouveaux badges
          if (gamificationResult.new_badges && gamificationResult.new_badges.length > 0) {
            for (const badgeCode of gamificationResult.new_badges) {
              const badgeData = await GamificationService.getBadgeByCode(badgeCode);
              if (badgeData) {
                setNewBadges(prev => [...prev, badgeData]);
              }
            }
          }

          // Afficher la notification de level up
          if (gamificationResult.level_up) {
            setLevelUpData(gamificationResult.current_level);
          }

          // Toast avec XP gagné
          toast({
            title: "🎉 Chambre terminée !",
            description: `+${duration <= 20 ? 80 : duration <= 30 ? 65 : 50} XP${
              duration <= 20 ? ' (Bonus vitesse !)' : ''
            }`,
          });
        }
      }

      // Mettre à jour l'état local
      setRooms(prev => prev.map(room => 
        room.id === roomId 
          ? { ...room, status: newStatus }
          : room
      ));

      // Log d'activité
      await supabase
        .from('activities')
        .insert({
          hotel_id: hotelId,
          entity_type: 'room',
          entity_id: roomId,
          activity_type: 'room_status_update',
          actor_name: housekeeperName,
          actor_type: 'housekeeper',
          details: {
            room_number: rooms.find(r => r.id === roomId)?.room_number,
            new_status: newStatus,
            access_code: accessCode
          }
        });

      if (newStatus !== 'clean') {
        const statusText = newStatus === 'in_progress' ? 'en cours' : 'à nettoyer';
        toast({
          title: "Statut mis à jour",
          description: `Chambre ${rooms.find(r => r.id === roomId)?.room_number} : ${statusText}`
        });
      }

    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    // Nettoyer le localStorage
    localStorage.removeItem('housekeeper');
    localStorage.removeItem('housekeeperProfile');
    localStorage.removeItem('selectedHotelId');
    localStorage.removeItem('selectedHotelName');
    localStorage.removeItem('selectedHotelCode');
    
    // Rediriger vers la page appropriée
    if (isAuthenticatedHousekeeper) {
      navigate('/housekeeper/hotels');
    } else {
      navigate('/housekeeper/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <div className="animate-pulse">Chargement...</div>
        </Card>
      </div>
    );
  }

  const completedRooms = rooms.filter(r => r.status === 'clean').length;
  const totalRooms = rooms.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4 lg:p-6">
      {/* Notifications de badges et level up */}
      {newBadges.map((badge, index) => (
        <BadgeUnlockNotification
          key={badge.code + index}
          badge={badge}
          onClose={() => setNewBadges(prev => prev.filter((_, i) => i !== index))}
        />
      ))}
      
      {levelUpData && (
        <LevelUpNotification
          newLevel={levelUpData}
          onClose={() => setLevelUpData(null)}
        />
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">
                {hotel?.name}
              </h1>
              <p className="text-xs sm:text-base text-gray-600 flex items-center gap-2 truncate">
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">{hotel?.address || 'Adresse non spécifiée'}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAuthenticatedHousekeeper && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/housekeeper/hotels')}
                className="flex-1 sm:flex-initial"
              >
                <Building2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Mes Hôtels</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/housekeeper/profile')}
              className="flex-1 sm:flex-initial"
            >
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Profil</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex-1 sm:flex-initial">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Barre de progression du niveau */}
        {levelData && (
          <div className="mb-4">
            <LevelProgressBar
              currentLevel={levelData.current_level}
              totalXp={levelData.total_xp}
              currentStreak={levelData.current_streak}
            />
          </div>
        )}

         {/* Session Info */}
         <Card className="p-3 sm:p-4 bg-blue-50 border-blue-200">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
               <div>
                 <p className="text-xs sm:text-sm font-medium text-blue-800">Connecté en tant que</p>
                 <p className="text-sm sm:text-base text-blue-600 truncate">{housekeeperName}</p>
               </div>
               {!isAuthenticatedHousekeeper && (
                 <div>
                   <p className="text-xs sm:text-sm font-medium text-blue-800">Code d'accès</p>
                   <p className="text-sm font-mono text-blue-600">{accessCode}</p>
                 </div>
               )}
             </div>
             <Badge variant="default" className="bg-green-100 text-green-800 whitespace-nowrap">
               <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
               Connecté
             </Badge>
           </div>
         </Card>
      </div>

      {/* Progress */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold">Progression</h3>
            <Badge variant="outline" className="text-sm sm:text-lg px-2 sm:px-3 py-1">
              {completedRooms} / {totalRooms}
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
            <div 
              className="bg-green-500 h-2 sm:h-3 rounded-full transition-all duration-300"
              style={{ width: `${totalRooms > 0 ? (completedRooms / totalRooms) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            {completedRooms === totalRooms && totalRooms > 0 
              ? 'Toutes les chambres terminées !' 
              : `${totalRooms - completedRooms} chambres restantes`}
          </p>
        </CardContent>
      </Card>

      {/* Room List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Mes chambres assignées</CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="text-center py-8">
              <Home className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                Aucune chambre à nettoyer
              </h3>
              <p className="text-xs sm:text-base text-gray-500 mb-4 px-4">
                {isLoading 
                  ? "Chargement des chambres..." 
                  : "Toutes les chambres sont propres ou aucune chambre n'est configurée pour cet établissement."}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 px-4">
                L'administrateur doit créer des chambres ou vous assigner des chambres à nettoyer.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {rooms.map(room => (
                <div
                  key={room.id}
                  className={`p-3 sm:p-4 rounded-lg border-2 ${
                    room.status === 'clean' 
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : room.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg sm:text-xl font-bold">Chambre {room.room_number}</span>
                         <Badge className={
                           room.cleaning_priority === 3 ? 'bg-red-100 text-red-800 text-xs' :
                           room.cleaning_priority === 2 ? 'bg-orange-100 text-orange-800 text-xs' :
                           'bg-gray-100 text-gray-800 text-xs'
                         }>
                           {room.cleaning_priority === 3 ? 'Urgent' : 
                            room.cleaning_priority === 2 ? 'Prioritaire' : 'Normal'}
                         </Badge>
                         <Badge variant="outline" className={
                           room.status === 'to_clean' || room.status === 'dirty' 
                             ? 'bg-blue-100 text-blue-800 border-blue-300 text-xs' 
                             : 'bg-gray-100 text-gray-800 text-xs'
                         }>
                           {room.status === 'to_clean' || room.status === 'dirty' 
                             ? '🧹 À blanc' 
                             : '🛏️ Recouche'}
                         </Badge>
                      </div>
                      {room.notes && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                          📝 {room.notes}
                        </p>
                      )}
                      
                      {/* Champ de commentaires */}
                      {room.status !== 'clean' && (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            placeholder="Ajouter un commentaire (optionnel)..."
                            value={roomNotes[room.id] || ''}
                            onChange={(e) => setRoomNotes({ ...roomNotes, [room.id]: e.target.value })}
                            rows={2}
                            className="text-xs sm:text-sm resize-none"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      {/* Bouton signaler incident */}
                      {room.status !== 'clean' && (
                        <IncidentReportDialogSimple 
                          hotelId={hotelId!} 
                          userType="housekeeper"
                          defaultLocation={room.room_number}
                        />
                      )}
                      
                      {room.status === 'dirty' && (
                        <Button 
                          onClick={() => updateRoomStatus(room.id, 'in_progress')}
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          Commencer
                        </Button>
                      )}
                      {room.status === 'in_progress' && (
                        <Button 
                          onClick={() => updateRoomStatus(room.id, 'clean')}
                          className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                          size="sm"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Terminer
                        </Button>
                      )}
                      {room.status === 'clean' && (
                        <div className="flex items-center text-green-600 w-full sm:w-auto justify-center">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          <span className="text-sm sm:text-base">Terminée</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};