import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Home, LogOut } from 'lucide-react';
import { MobileOptimizedInterface } from './MobileOptimizedInterface';

interface Room {
  number: string;
  status: 'to_clean' | 'in_progress' | 'completed';
  priority: 'normal' | 'high' | 'urgent';
  notes?: string;
  cleaningType?: 'recouche' | 'full';
}

interface GuestModeProps {
  accessCode: string;
}

export const HousekeeperGuestMode: React.FC<GuestModeProps> = ({ accessCode }) => {
  const [hotel, setHotel] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [managerName, setManagerName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadGuestModeData();
  }, [accessCode]);

  const loadGuestModeData = async () => {
    try {
      
      if (!accessCode) {
        console.error('❌ Aucun code d\'accès fourni');
        toast({
          title: "Code manquant",
          description: "Aucun code d'accès fourni",
          variant: "destructive"
        });
        return;
      }

      // Get access code info
      const { data: codeData, error: codeError } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          hotels (
            id,
            name,
            hotel_code,
            address
          )
        `)
        .eq('access_code', accessCode)
        .eq('is_active', true)
        .maybeSingle();


      if (codeError) {
        console.error('❌ Erreur recherche code:', codeError);
        toast({
          title: "Erreur de recherche",
          description: "Impossible de vérifier le code d'accès",
          variant: "destructive"
        });
        return;
      }

      if (!codeData || !codeData.hotels) {
        console.error('❌ Code invalide ou hôtel non trouvé');
        toast({
          title: "Code invalide",
          description: "Code d'accès non trouvé, expiré ou hôtel non configuré",
          variant: "destructive"
        });
        
        // Show fallback data for debugging
        const fallbackRooms: Room[] = [
          { number: '101', status: 'to_clean', priority: 'normal', notes: 'Mode démonstration - Code invalide' },
          { number: '102', status: 'to_clean', priority: 'high', notes: 'Données de test' },
          { number: '103', status: 'to_clean', priority: 'normal' }
        ];
        setRooms(fallbackRooms);
        setHotel({ name: 'Hôtel Démonstration', hotel_code: 'DEMO', address: 'Mode test' });
        setManagerName('Mode Démonstration');
        return;
      }

      setHotel(codeData.hotels);
      setManagerName('Mode Invité - Personnel d\'entretien');

      // Get all rooms from hotel (guest mode = access to all rooms, no assignment needed)
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', codeData.hotels.id)
        .order('room_number');


      if (roomsError) {
        console.error('❌ Erreur chargement chambres:', roomsError);
        // Fallback to mock data if real rooms not available
        const fallbackRooms: Room[] = [
          { number: '101', status: 'to_clean', priority: 'normal', notes: 'Mode invité - données de démonstration' },
          { number: '102', status: 'to_clean', priority: 'high', notes: 'Départ tardif client VIP' },
          { number: '103', status: 'to_clean', priority: 'normal' },
          { number: '201', status: 'to_clean', priority: 'urgent', notes: 'Priorité absolue' },
          { number: '202', status: 'to_clean', priority: 'normal' }
        ];
        setRooms(fallbackRooms);
        toast({
          title: "Données de démonstration",
          description: "Affichage des données de test car aucune chambre n'est configurée",
          variant: "default"
        });
      } else if (!roomsData || roomsData.length === 0) {
        // No rooms in hotel, show helpful message
        const emptyStateRooms: Room[] = [
          { number: 'Aucune chambre', status: 'to_clean', priority: 'normal', notes: 'Aucune chambre configurée dans cet hôtel' }
        ];
        setRooms(emptyStateRooms);
        toast({
          title: "Aucune chambre",
          description: "Cet hôtel n'a pas encore de chambres configurées",
          variant: "default"
        });
      } else {
        // Convert database rooms to interface format
        const formattedRooms: Room[] = roomsData.map(room => ({
          number: room.room_number,
          status: room.status === 'dirty' ? 'to_clean' : 
                  room.status === 'in_progress' ? 'in_progress' : 
                  room.status === 'clean' ? 'completed' : 'to_clean',
          priority: room.cleaning_priority === 3 ? 'urgent' : 
                   room.cleaning_priority === 2 ? 'high' : 'normal',
          notes: room.notes || undefined,
          cleaningType: room.cleaning_type === 'full' ? 'full' : 'recouche'
        }));
        
        setRooms(formattedRooms);
        toast({
          title: "Mode invité activé",
          description: `Accès à ${formattedRooms.length} chambre(s) en mode invité`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error('❌ Erreur générale mode invité:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateRoomStatus = async (roomNumber: string, newStatus: Room['status']) => {
    try {
      // Update room status in database
      const dbStatus = newStatus === 'completed' ? 'clean' : 
                      newStatus === 'in_progress' ? 'in_progress' : 'dirty';
      
      const { error } = await supabase
        .from('rooms')
        .update({ 
          status: dbStatus,
          last_cleaned_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('hotel_id', hotel.id)
        .eq('room_number', roomNumber);

      if (error) {
        console.error('Error updating room status:', error);
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour le statut de la chambre",
          variant: "destructive"
        });
        return;
      }

      // Répercuter le statut (propre/sale) vers le PMS Apaleo (best-effort)
      supabase.functions
        .invoke('apaleo-update-condition', {
          body: { hotelId: hotel.id, roomNumber, status: dbStatus },
        })
        .then(({ error: apaleoError }) => {
          if (apaleoError) console.warn('⚠️ Synchro statut Apaleo échouée:', apaleoError.message);
        })
        .catch((e) => console.warn('⚠️ Synchro statut Apaleo échouée:', e));


      // Update local state
      setRooms(prev => prev.map(room => 
        room.number === roomNumber 
          ? { ...room, status: newStatus }
          : room
      ));

      // Create activity log
      await supabase
        .from('activities')
        .insert({
          hotel_id: hotel.id,
          entity_type: 'room',
          entity_id: hotel.id, // Using hotel id as fallback
          activity_type: 'room_status_update',
          actor_name: managerName,
          actor_type: 'manager',
          details: {
            room_number: roomNumber,
            old_status: rooms.find(r => r.number === roomNumber)?.status,
            new_status: newStatus
          }
        });

      // Success notification with sound
      const successMessage = `Chambre ${roomNumber} : ${newStatus === 'completed' ? 'terminée' : newStatus === 'in_progress' ? 'en cours' : 'à nettoyer'}`;
      
      toast({
        title: "Statut mis à jour",
        description: successMessage
      });

      // Play success sound for completed rooms
      if (newStatus === 'completed') {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
        } catch (audioError) {
          // Silent fail for audio
        }
      }

    } catch (error) {
      console.error('Error updating room status:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la mise à jour",
        variant: "destructive"
      });
    }
  };

  const getRoomStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'to_clean': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: Room['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'normal': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const completedRooms = rooms.filter(r => r.status === 'completed').length;
  const totalRooms = rooms.length;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  if (!hotel) {
    return <Navigate to="/housekeeper/login" replace />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-6 w-6" />
            {hotel.name}
          </h1>
          <p className="text-muted-foreground">
            Bonjour {managerName} • Mode Gestion • {hotel.address}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/housekeeper/login'}>
          <LogOut className="h-4 w-4 mr-2" />
          Quitter
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Progression du jour</h3>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {completedRooms} / {totalRooms}
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${totalRooms > 0 ? (completedRooms / totalRooms) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {completedRooms === totalRooms ? 'Toutes les chambres terminées !' : `${totalRooms - completedRooms} chambres restantes`}
          </p>
        </CardContent>
      </Card>

      {/* Room List */}
      <div className="sm:hidden">
        {/* Mobile optimized view */}
        <MobileOptimizedInterface 
          hotelId={hotel.id}
          rooms={rooms}
          housekeeperName={managerName}
          onRoomStatusUpdate={updateRoomStatus}
        />
      </div>
      
      <div className="hidden sm:block">
        <Card>
          <CardHeader>
            <CardTitle>Gestion des chambres - Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {rooms.map(room => (
                <div
                  key={room.number}
                  className={`p-4 rounded-lg border-2 ${getRoomStatusColor(room.status)}`}
                >
                    <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">Chambre {room.number}</span>
                        <Badge 
                          className={room.cleaningType === 'full' 
                            ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                            : 'bg-blue-500 hover:bg-blue-600 text-white'}
                        >
                          {room.cleaningType === 'full' ? '✨ À BLANC' : '🛏️ RECOUCHE'}
                        </Badge>
                        <Badge className={getPriorityColor(room.priority)}>
                          {room.priority === 'urgent' ? 'Urgent' : 
                           room.priority === 'high' ? 'Prioritaire' : 'Normal'}
                        </Badge>
                      </div>
                      {room.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📝 {room.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {room.status === 'to_clean' && (
                        <Button 
                          onClick={() => updateRoomStatus(room.number, 'in_progress')}
                          variant="outline"
                        >
                          Commencer
                        </Button>
                      )}
                      {room.status === 'in_progress' && (
                        <Button 
                          onClick={() => updateRoomStatus(room.number, 'completed')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Terminer
                        </Button>
                      )}
                      {room.status === 'completed' && (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Terminée
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};