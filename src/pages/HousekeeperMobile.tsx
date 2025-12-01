import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  Clock, 
  LogOut, 
  RefreshCw, 
  ChevronRight,
  Home,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Room {
  id: string;
  room_number: string;
  status: string;
  floor: number;
  cleaning_priority: number;
  notes?: string;
}

interface Assignment {
  id: string;
  room_id: string;
  housekeeper_name: string;
  status: string;
  assigned_at: string;
  started_at?: string;
  room?: Room;
}

export default function HousekeeperMobile() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hotel, setHotel] = useState<any>(null);
  const [housekeeperName, setHousekeeperName] = useState('');
  const [swipingCard, setSwipingCard] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  // Get housekeeper info from URL or localStorage
  const accessCode = searchParams.get('access_code');
  const hotelId = searchParams.get('hotel') || localStorage.getItem('selectedHotelId');
  const nameFromUrl = searchParams.get('name');

  useEffect(() => {
    const housekeeperData = localStorage.getItem('housekeeper');
    const housekeeperProfile = localStorage.getItem('housekeeperProfile');
    
    if (housekeeperProfile) {
      const profile = JSON.parse(housekeeperProfile);
      setHousekeeperName(profile.name || nameFromUrl || 'Femme de chambre');
    } else if (housekeeperData) {
      const data = JSON.parse(housekeeperData);
      setHousekeeperName(data.name || nameFromUrl || 'Femme de chambre');
    } else if (nameFromUrl) {
      setHousekeeperName(nameFromUrl);
    }
  }, [nameFromUrl]);

  useEffect(() => {
    if (hotelId) {
      loadData();
    }
  }, [hotelId]);

  const loadData = async () => {
    if (!hotelId) return;
    
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
      // Update assignment status
      const { error: assignmentError } = await supabase
        .from('assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', assignment.id);

      if (assignmentError) throw assignmentError;

      // Update room status
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'clean' })
        .eq('id', assignment.room_id);

      if (roomError) throw roomError;

      // Remove from list
      setAssignments(prev => prev.filter(a => a.id !== assignment.id));

      toast({
        title: "✅ Chambre terminée",
        description: `Chambre ${assignment.room?.room_number} marquée comme propre`,
        duration: 3000
      });

    } catch (error: any) {
      console.error('Error marking complete:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de marquer la chambre comme terminée"
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

      toast({
        title: "🧹 Nettoyage commencé",
        description: `Chambre ${assignment.room?.room_number}`,
        duration: 2000
      });

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
    localStorage.removeItem('housekeeper');
    localStorage.removeItem('housekeeperProfile');
    localStorage.removeItem('selectedHotelId');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

      {/* Stats */}
      <div className="px-4 py-6">
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

      {/* Instructions */}
      {assignments.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Comment utiliser :</p>
              <p>• Glissez vers la droite pour terminer</p>
              <p>• Appuyez pour commencer le nettoyage</p>
            </div>
          </div>
        </div>
      )}

      {/* Rooms List */}
      <div className="px-4 space-y-3">
        {assignments.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-semibold mb-2">Tout est terminé !</h3>
              <p className="text-muted-foreground">
                Vous n'avez plus de chambres assignées
              </p>
            </CardContent>
          </Card>
        ) : (
          assignments.map((assignment) => {
            const room = assignment.room;
            if (!room) return null;

            const offset = swipeOffset[assignment.id] || 0;
            const isInProgress = assignment.status === 'in_progress';

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
                    isInProgress && "border-2 border-primary shadow-lg"
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
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-primary">
                          {room.room_number}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getPriorityColor(room.cleaning_priority), "text-white")}
                          >
                            {getPriorityLabel(room.cleaning_priority)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Étage {room.floor}
                          </Badge>
                        </div>
                      </div>
                      {isInProgress && (
                        <Badge className="bg-primary">
                          <Clock className="h-3 w-3 mr-1" />
                          En cours
                        </Badge>
                      )}
                    </div>

                    {room.notes && (
                      <div className="mb-3 p-2 bg-muted/50 rounded text-sm">
                        <p className="text-muted-foreground">{room.notes}</p>
                      </div>
                    )}

                    {!isInProgress && (
                      <Button 
                        className="w-full"
                        size="lg"
                        onClick={() => startCleaning(assignment)}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Commencer le nettoyage
                      </Button>
                    )}

                    {isInProgress && (
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          size="lg"
                          onClick={() => markRoomComplete(assignment)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Terminer
                        </Button>
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
    </div>
  );
}
