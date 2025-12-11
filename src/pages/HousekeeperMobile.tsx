import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { 
  CheckCircle, 
  Clock, 
  LogOut, 
  RefreshCw, 
  ChevronRight,
  Home,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  Filter,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Room {
  id: string;
  room_number: string;
  status: string;
  floor: number;
  cleaning_priority: number;
  cleaning_type?: string;
  room_type?: string;
  notes?: string;
}

interface Assignment {
  id: string;
  room_id: string;
  housekeeper_name: string;
  status: string;
  assigned_at: string;
  started_at?: string;
  notes?: string;
  room?: Room;
}

type TabType = 'assigned' | 'checkout';

interface Filters {
  floor: string;
  cleaningType: string;
  priority: string;
  roomType: string;
}

export default function HousekeeperMobile() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [checkoutRooms, setCheckoutRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hotel, setHotel] = useState<any>(null);
  const [housekeeperName, setHousekeeperName] = useState('');
  const [swipingCard, setSwipingCard] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const [comment, setComment] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabType>('assigned');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    floor: 'all',
    cleaningType: 'all',
    priority: 'all',
    roomType: 'all'
  });
  
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  // Get housekeeper info from URL or localStorage (utiliser storageService en priorité)
  const accessCode = searchParams.get('access_code');
  const hotelIdFromUrl = searchParams.get('hotel');
  const hotelIdFromStorage = storageService.getHotelId() || localStorage.getItem('selectedHotelId');
  const hotelId = hotelIdFromUrl || hotelIdFromStorage;
  const nameFromUrl = searchParams.get('name');

  // Récupérer le nom du housekeeper au chargement initial
  useEffect(() => {
    const housekeeperData = localStorage.getItem('housekeeper');
    const housekeeperProfile = localStorage.getItem('housekeeperProfile');
    
    let name = nameFromUrl || '';
    
    if (housekeeperProfile) {
      try {
        const profile = JSON.parse(housekeeperProfile);
        name = profile.name || name;
      } catch (e) {
        console.error('Error parsing housekeeperProfile:', e);
      }
    } else if (housekeeperData) {
      try {
        const data = JSON.parse(housekeeperData);
        name = data.name || name;
      } catch (e) {
        console.error('Error parsing housekeeper:', e);
      }
    }
    
    if (name) {
      setHousekeeperName(name);
    }
  }, [nameFromUrl]);

  // Charger les données quand hotelId ET housekeeperName sont disponibles
  useEffect(() => {
    if (hotelId && housekeeperName) {
      loadData();
    }
  }, [hotelId, housekeeperName]);

  // Écouter les changements en temps réel sur les assignments
  useEffect(() => {
    if (!hotelId || !housekeeperName) return;

    const channel = supabase
      .channel('housekeeper-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
          filter: `hotel_id=eq.${hotelId}`
        },
        (payload) => {
          console.log('Assignment change detected:', payload);
          // Recharger les données quand il y a un changement
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotelId, housekeeperName]);

  const loadData = async () => {
    if (!hotelId || !housekeeperName) return;
    
    setIsLoading(true);
    try {
      // Load hotel info
      const { data: hotelData } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', hotelId)
        .single();
      
      setHotel(hotelData);

      // Load assignments with room details
      const { data: assignmentsData, error } = await supabase
        .from('assignments')
        .select(`
          *,
          room:rooms(*)
        `)
        .eq('hotel_id', hotelId)
        .eq('housekeeper_name', housekeeperName)
        .in('status', ['assigned', 'in_progress'])
        .order('assigned_at', { ascending: true });

      if (error) throw error;

      setAssignments(assignmentsData || []);

      // Load checkout rooms (dirty rooms with cleaning_type = 'full' or priority high = client sorti)
      const { data: checkoutData, error: checkoutError } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('status', 'dirty')
        .eq('cleaning_type', 'full')
        .order('cleaning_priority', { ascending: false });

      if (!checkoutError && checkoutData) {
        setCheckoutRooms(checkoutData);
      }
      
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger vos chambres"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, assignmentId: string) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipingCard(assignmentId);
  };

  const handleTouchMove = (e: React.TouchEvent, assignmentId: string) => {
    if (swipingCard !== assignmentId) return;
    
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    // Only allow swipe to the right (positive values)
    if (diff > 0) {
      setSwipeOffset(prev => ({ ...prev, [assignmentId]: diff }));
    }
  };

  const handleTouchEnd = async (assignmentId: string, assignment: Assignment) => {
    const offset = swipeOffset[assignmentId] || 0;
    
    // If swiped more than 100px, mark as complete
    if (offset > 100) {
      await markRoomComplete(assignment);
    }
    
    // Reset swipe
    setSwipingCard(null);
    setSwipeOffset(prev => {
      const newOffsets = { ...prev };
      delete newOffsets[assignmentId];
      return newOffsets;
    });
  };

  const markRoomComplete = async (assignment: Assignment) => {
    try {
      const roomComment = comment[assignment.id] || '';
      const hasComment = roomComment.trim().length > 0;
      
      // Update assignment status
      const { error: assignmentError } = await supabase
        .from('assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: roomComment || assignment.notes
        })
        .eq('id', assignment.id);

      if (assignmentError) throw assignmentError;

      // Update room status
      const updateData: any = { status: 'clean' };
      if (hasComment) {
        updateData.notes = roomComment;
      }
      
      const { error: roomError } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', assignment.room_id);

      if (roomError) throw roomError;

      // Remove from list
      setAssignments(prev => prev.filter(a => a.id !== assignment.id));
      setComment(prev => {
        const newComments = { ...prev };
        delete newComments[assignment.id];
        return newComments;
      });

      // Notification pour chambre terminée
      toast({
        title: "✅ Chambre terminée",
        description: `Chambre ${assignment.room?.room_number} marquée comme propre`,
        duration: 3000
      });
      
      // Notification séparée pour commentaire si présent
      if (hasComment) {
        toast({
          title: "💬 Commentaire ajouté",
          description: `Commentaire enregistré pour la chambre ${assignment.room?.room_number}`,
          duration: 3000
        });
      }

    } catch (error: any) {
      console.error('Error marking complete:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de marquer la chambre comme terminée"
      });
    }
  };

  const unassignRoom = async (assignment: Assignment) => {
    try {
      // Delete assignment
      const { error: assignmentError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignment.id);

      if (assignmentError) throw assignmentError;

      // Remove from list
      setAssignments(prev => prev.filter(a => a.id !== assignment.id));

      // Pas de notification pour désassignation
      console.log(`Chambre ${assignment.room?.room_number} désassignée`);

    } catch (error: any) {
      console.error('Error unassigning:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de désassigner la chambre"
      });
    }
  };

  const startCleaning = async (assignment: Assignment) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', assignment.id);

      if (error) throw error;

      setAssignments(prev => prev.map(a => 
        a.id === assignment.id 
          ? { ...a, status: 'in_progress', started_at: new Date().toISOString() }
          : a
      ));

      // Pas de notification au démarrage
      console.log(`Nettoyage commencé pour chambre ${assignment.room?.room_number}`);

    } catch (error: any) {
      console.error('Error starting:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de démarrer le nettoyage"
      });
    }
  };

  const handleLogout = () => {
    // Nettoyer toutes les données de session
    localStorage.removeItem('housekeeper');
    localStorage.removeItem('housekeeperProfile');
    localStorage.removeItem('selectedHotelId');
    localStorage.removeItem('housekeeperSessionToken');
    localStorage.removeItem('housekeeperSessionExpires');
    storageService.clearHotel();
    navigate('/housekeeper-login');
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'bg-red-500';
    if (priority >= 5) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return 'Urgent';
    if (priority >= 5) return 'Normal';
    return 'Bas';
  };

  const isTwin = (roomType?: string) => {
    if (!roomType) return false;
    return roomType.toLowerCase().includes('twin');
  };

  // Get unique floors for filter
  const uniqueFloors = [...new Set(assignments.map(a => a.room?.floor).filter(Boolean))].sort((a, b) => (a || 0) - (b || 0));

  // Filter assignments
  const filteredAssignments = assignments.filter(assignment => {
    const room = assignment.room;
    if (!room) return false;

    if (filters.floor !== 'all' && room.floor !== parseInt(filters.floor)) return false;
    if (filters.cleaningType !== 'all') {
      const isRecouche = room.cleaning_type !== 'full';
      if (filters.cleaningType === 'recouche' && !isRecouche) return false;
      if (filters.cleaningType === 'full' && isRecouche) return false;
    }
    if (filters.priority !== 'all') {
      if (filters.priority === 'urgent' && room.cleaning_priority < 8) return false;
      if (filters.priority === 'normal' && (room.cleaning_priority >= 8 || room.cleaning_priority < 5)) return false;
      if (filters.priority === 'low' && room.cleaning_priority >= 5) return false;
    }
    if (filters.roomType !== 'all') {
      const roomIsTwin = isTwin(room.room_type);
      if (filters.roomType === 'twin' && !roomIsTwin) return false;
      if (filters.roomType === 'other' && roomIsTwin) return false;
    }

    return true;
  });

  const activeFiltersCount = Object.values(filters).filter(v => v !== 'all').length;

  // Afficher un loader si le nom n'est pas encore disponible
  if (!housekeeperName) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Chargement du profil...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Chargement des chambres...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            <span className="font-semibold">{hotel?.name || 'Hôtel'}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Bonjour,</p>
            <p className="font-bold text-lg">{housekeeperName}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={loadData}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'assigned' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setActiveTab('assigned')}
          >
            Mes chambres ({assignments.length})
          </Button>
          <Button
            variant={activeTab === 'checkout' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setActiveTab('checkout')}
          >
            À blanc ({checkoutRooms.length})
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-4">
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div className="text-center flex-1">
                <p className="text-3xl font-bold text-primary">{assignments.length}</p>
                <p className="text-sm text-muted-foreground">Chambres restantes</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-center flex-1">
                <p className="text-3xl font-bold text-green-600">
                  {assignments.filter(a => a.status === 'in_progress').length}
                </p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {activeTab === 'assigned' && assignments.length > 0 && (
        <div className="px-4 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filtres</span>
              {activeFiltersCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
          </Button>

          {showFilters && (
            <Card className="mt-2">
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Étage</label>
                    <Select value={filters.floor} onValueChange={(v) => setFilters(prev => ({ ...prev, floor: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        {uniqueFloors.map(floor => (
                          <SelectItem key={floor} value={String(floor)}>Étage {floor}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Type nettoyage</label>
                    <Select value={filters.cleaningType} onValueChange={(v) => setFilters(prev => ({ ...prev, cleaningType: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="recouche">Recouche</SelectItem>
                        <SelectItem value="full">À blanc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Urgence</label>
                    <Select value={filters.priority} onValueChange={(v) => setFilters(prev => ({ ...prev, priority: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Bas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Type chambre</label>
                    <Select value={filters.roomType} onValueChange={(v) => setFilters(prev => ({ ...prev, roomType: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="twin">Twin</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setFilters({ floor: 'all', cleaningType: 'all', priority: 'all', roomType: 'all' })}
                  >
                    Réinitialiser les filtres
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Assigned Rooms Tab */}
      {activeTab === 'assigned' && (
        <div className="px-4 space-y-3">
          {filteredAssignments.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-xl font-semibold mb-2">
                  {assignments.length === 0 ? 'Tout est terminé !' : 'Aucun résultat'}
                </h3>
                <p className="text-muted-foreground">
                  {assignments.length === 0 
                    ? "Vous n'avez plus de chambres assignées"
                    : "Aucune chambre ne correspond aux filtres"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAssignments.map((assignment) => {
              const room = assignment.room;
              if (!room) return null;

              const offset = swipeOffset[assignment.id] || 0;
              const isInProgress = assignment.status === 'in_progress';
              const isRecouche = room.cleaning_type !== 'full';
              const roomIsTwin = isTwin(room.room_type);

              return (
                <div 
                  key={assignment.id}
                  className="relative overflow-hidden"
                >
                  {/* Swipe background */}
                  <div 
                    className={cn(
                      "absolute inset-0 bg-green-500 rounded-lg flex items-center justify-end px-6 transition-opacity",
                      offset > 50 ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>

                  {/* Swipeable Card */}
                  <Card
                    className={cn(
                      "relative cursor-grab active:cursor-grabbing transition-all",
                      isInProgress && "border-2 border-primary shadow-lg",
                      !isRecouche && "border-l-4 border-l-orange-500"
                    )}
                    style={{
                      transform: `translateX(${offset}px)`,
                      transition: swipingCard === assignment.id ? 'none' : 'transform 0.3s ease-out'
                    }}
                    onTouchStart={(e) => handleTouchStart(e, assignment.id)}
                    onTouchMove={(e) => handleTouchMove(e, assignment.id)}
                    onTouchEnd={() => handleTouchEnd(assignment.id, assignment)}
                  >
                    <CardContent className="p-4">
                      {/* Type de nettoyage EN HAUT */}
                      <div className="flex items-center justify-between mb-2">
                        <Badge 
                          className={cn(
                            "text-xs font-semibold",
                            isRecouche 
                              ? "bg-blue-500 hover:bg-blue-600 text-white" 
                              : "bg-orange-500 hover:bg-orange-600 text-white"
                          )}
                        >
                          {isRecouche ? '🛏️ RECOUCHE' : '✨ À BLANC'}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getPriorityColor(room.cleaning_priority), "text-white")}
                        >
                          {getPriorityLabel(room.cleaning_priority)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl font-bold text-primary">
                            {room.room_number}
                          </div>
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className="text-xs">
                              Étage {room.floor}
                            </Badge>
                            {roomIsTwin && (
                              <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-300">
                                👥 TWIN
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {isInProgress && (
                            <Badge className="bg-primary">
                              <Clock className="h-3 w-3 mr-1" />
                              En cours
                            </Badge>
                          )}
                        </div>
                      </div>

                      {room.notes && (
                        <div className="mb-3 p-2 bg-muted/50 rounded text-sm">
                          <p className="text-muted-foreground">{room.notes}</p>
                        </div>
                      )}

                      {!isInProgress && (
                        <div className="space-y-2">
                          <Button 
                            className="w-full"
                            size="lg"
                            onClick={() => startCleaning(assignment)}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Commencer le nettoyage
                          </Button>
                          <Button 
                            variant="outline"
                            className="w-full"
                            size="sm"
                            onClick={() => unassignRoom(assignment)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Désassigner
                          </Button>
                        </div>
                      )}

                      {isInProgress && (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Commentaire (optionnel)..."
                            value={comment[assignment.id] || ''}
                            onChange={(e) => setComment(prev => ({ ...prev, [assignment.id]: e.target.value }))}
                            className="min-h-[60px]"
                          />
                          <div className="flex gap-2">
                            <Button 
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              size="lg"
                              onClick={() => markRoomComplete(assignment)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Terminer
                            </Button>
                            <Button 
                              variant="outline"
                              size="lg"
                              onClick={() => unassignRoom(assignment)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-center text-xs text-muted-foreground gap-2">
                        <ChevronRight className="h-3 w-3" />
                        <span>Glissez pour terminer</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Checkout Rooms Tab (À blanc / Client sorti) */}
      {activeTab === 'checkout' && (
        <div className="px-4 space-y-3">
          <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-orange-900 dark:text-orange-100">
              <span className="font-semibold">Chambres "À blanc"</span> - Client sorti, nettoyage complet requis
            </p>
          </div>
          
          {checkoutRooms.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="p-8 text-center">
                <Home className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Aucune chambre à blanc</h3>
                <p className="text-muted-foreground">
                  Toutes les chambres client sorti ont été attribuées
                </p>
              </CardContent>
            </Card>
          ) : (
            checkoutRooms.map((room) => (
              <Card 
                key={room.id}
                className="border-l-4 border-l-orange-500"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl font-bold text-primary">
                        {room.room_number}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold">
                          ✨ À BLANC
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Étage {room.floor}
                        </Badge>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getPriorityColor(room.cleaning_priority), "text-white")}
                    >
                      {getPriorityLabel(room.cleaning_priority)}
                    </Badge>
                  </div>
                  {room.notes && (
                    <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                      <p className="text-muted-foreground">{room.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
