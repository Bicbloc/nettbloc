import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, Home, LogOut, Building2, MapPin, AlertCircle, Wifi, WifiOff, Sparkles, ScrollText, X } from 'lucide-react';
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';
import { IncidentReportDialogSimple } from './incident/IncidentReportDialogSimple';
import { Package } from 'lucide-react';
import { LinenQuickInventory } from './linen/LinenQuickInventory';
import { RoomCardEnhanced } from './housekeeper/RoomCardEnhanced';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { storageService } from '@/services/storageService';

interface Room {
  id: string;
  room_number: string;
  status: string;
  notes?: string;
  cleaning_priority: number;
  cleaning_type?: string;
}

interface ActivityLogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
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
  const [roomNotes, setRoomNotes] = useState<Record<string, string>>({});
  const [showGeneralIncidentDialog, setShowGeneralIncidentDialog] = useState(false);
  const [showLinenInventory, setShowLinenInventory] = useState(false);
  const [activeLinenTask, setActiveLinenTask] = useState<string | null>(null);
  const [newRoomsCount, setNewRoomsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<'rooms' | 'inventory'>('rooms');
  
  // Pointage
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  
  // Journal d'activité local
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);

  // Fonction pour ajouter au journal d'activité
  const addToActivityLog = useCallback((message: string, type: ActivityLogEntry['type'] = 'info') => {
    setActivityLog(prev => [{
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      message,
      type
    }, ...prev].slice(0, 50));
  }, []);

  // Récupération des paramètres URL
  const accessCodeFromUrl = searchParams.get('access_code');
  const hotelIdFromUrl = searchParams.get('hotel');
  const housekeeperNameFromUrl = searchParams.get('name');

  // Récupération unifiée depuis storageService
  const housekeeperProfile = storageService.getHousekeeperProfile();
  // Check localStorage for legacy data
  const legacyHousekeeper = localStorage.getItem('housekeeper') ? JSON.parse(localStorage.getItem('housekeeper')!) : null;
  const legacyProfile = localStorage.getItem('housekeeperProfile') ? JSON.parse(localStorage.getItem('housekeeperProfile')!) : null;
  
  const isAuthenticatedHousekeeper = legacyProfile?.isAuthenticated || false;
  
  // Code d'accès: URL ou profil stocké
  const accessCode = isAuthenticatedHousekeeper 
    ? null 
    : (accessCodeFromUrl || legacyHousekeeper?.accessCode);
  
  // Récupération robuste du hotelId - simplifié avec storageService
  const getHotelId = (): string | null => {
    // 1. URL en priorité
    if (hotelIdFromUrl && hotelIdFromUrl.length >= 30) return hotelIdFromUrl;
    // 2. storageService unifié
    const storedId = storageService.getHotelId();
    if (storedId && storedId.length >= 30) return storedId;
    // 3. Profil housekeeper
    if (housekeeperProfile?.currentHotelId && housekeeperProfile.currentHotelId.length >= 30) {
      return housekeeperProfile.currentHotelId;
    }
    return null;
  };
  
  const hotelId = getHotelId();
  const housekeeperName = housekeeperNameFromUrl || housekeeperProfile?.name || 'Femme de chambre';

  // Charger/sauvegarder le pointage
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedStart = localStorage.getItem(`pointage_start_${today}_${housekeeperName}`);
    const savedEnd = localStorage.getItem(`pointage_end_${today}_${housekeeperName}`);
    
    if (savedStart) setStartTime(savedStart);
    if (savedEnd) setEndTime(savedEnd);
  }, [housekeeperName]);

  const handleStartPointage = () => {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const today = new Date().toISOString().split('T')[0];
    setStartTime(now);
    localStorage.setItem(`pointage_start_${today}_${housekeeperName}`, now);
    addToActivityLog(`⏰ Pointage début: ${now}`, 'success');
  };

  const handleEndPointage = () => {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const today = new Date().toISOString().split('T')[0];
    setEndTime(now);
    localStorage.setItem(`pointage_end_${today}_${housekeeperName}`, now);
    addToActivityLog(`⏰ Pointage fin: ${now}`, 'success');
  };

  useEffect(() => {
    console.log('🔍 Vérification hotelId:', {
      fromUrl: hotelIdFromUrl,
      fromStorage: storageService.getHotelId(),
      final: hotelId,
      isAuthenticatedHousekeeper
    });

    // Validation stricte du hotelId
    if (hotelId && hotelId.length < 30) {
      console.error('❌ HotelId invalide:', hotelId);
      toast({
        title: "Erreur de session",
        description: "Hotel ID introuvable. Veuillez resélectionner votre hôtel.",
        variant: "destructive"
      });
      navigate('/housekeeper/hotels');
      return;
    }

    if ((accessCode && hotelId) || (isAuthenticatedHousekeeper && hotelId)) {
      loadWorkData();
    } else if (!accessCode && !isAuthenticatedHousekeeper) {
      navigate('/housekeeper/auth');
    }
  }, [accessCode, hotelId, isAuthenticatedHousekeeper]);

  // Normaliser un nom pour comparaison
  const normalizeName = (name: string | null | undefined): string => {
    return (name || '').trim().toLowerCase();
  };

  // Gestion intelligente des mises à jour temps réel
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
    console.log(`📡 Mise à jour temps réel ${table}:`, payload);
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (table === 'assignments') {
      if (eventType === 'INSERT') {
        const possibleIds = [
          housekeeperProfile?.id,
          housekeeper?.id,
          housekeeper?.access_code,
          housekeeper?.user_id
        ].filter(Boolean);
        
        const normalizedMyName = normalizeName(housekeeperName);
        const normalizedRecordName = normalizeName(newRecord.housekeeper_name);
        
        const isForMe = possibleIds.includes(newRecord.housekeeper_id) || 
                        normalizedRecordName === normalizedMyName;
        const isCorrectHotel = newRecord.hotel_id === hotelId;
        
        if (isForMe && isCorrectHotel) {
          console.log('🆕 Nouvelle assignation reçue! Rechargement...');
          loadWorkData();
          addToActivityLog('🆕 Nouvelle chambre assignée', 'info');
          setNewRoomsCount(prev => prev + 1);
          setTimeout(() => setNewRoomsCount(0), 5000);
        }
      } else if (eventType === 'UPDATE') {
        setAssignments(prev => prev.map(a => 
          a.id === newRecord.id ? { ...a, ...newRecord } : a
        ));
      } else if (eventType === 'DELETE') {
        setAssignments(prev => prev.filter(a => a.id !== oldRecord.id));
        setRooms(prev => prev.filter(r => r.id !== oldRecord.room_id));
      }
    }
    
    if (table === 'rooms') {
      if (eventType === 'UPDATE' || eventType === 'INSERT') {
        if (newRecord.status === 'ready-to-clean' && oldRecord?.status !== 'ready-to-clean') {
          addToActivityLog(`🚪 Chambre ${newRecord.room_number} disponible - Client sorti`, 'info');
          setAvailableRooms(prev => {
            if (!prev.find(r => r.id === newRecord.id)) {
              return [...prev, newRecord];
            }
            return prev;
          });
        }
        
        setRooms(prev => {
          const exists = prev.find(r => r.id === newRecord.id);
          if (exists) {
            return prev.map(r => r.id === newRecord.id ? { ...r, ...newRecord } : r);
          } else if (eventType === 'INSERT') {
            return [...prev, newRecord];
          }
          return prev;
        });
      } else if (eventType === 'DELETE') {
        setRooms(prev => prev.filter(r => r.id !== oldRecord.id));
      }
    }
  }, [hotelId, housekeeperName, housekeeperProfile, housekeeper, addToActivityLog]);

  // Synchronisation en temps réel
  const { isConnected } = useRealtimeSync({
    hotelId: hotelId || undefined,
    tables: ['assignments', 'rooms'],
    onUpdate: handleRealtimeUpdate
  });

  const loadWorkData = async () => {
    try {
      setIsRefreshing(true);
      
      // Cache rapide
      const cachedKey = `assignments_${hotelId}_${housekeeperProfile?.id || 'temp'}`;
      const cachedData = localStorage.getItem(cachedKey);
      if (cachedData && rooms.length === 0) {
        try {
          const { assignments: cachedAssignments, rooms: cachedRooms, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
            setAssignments(cachedAssignments || []);
            setRooms(cachedRooms || []);
          }
        } catch (e) {
          console.error('Erreur parsing cache:', e);
        }
      }
      
      let authResult: any;
      
      if (isAuthenticatedHousekeeper && housekeeperProfile) {
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

      const housekeeperId = isAuthenticatedHousekeeper 
        ? housekeeperProfile?.id 
        : (authResult.user?.id || authResult.user?.access_code);

      let housekeeperTableId = housekeeperId;
      if (isAuthenticatedHousekeeper && housekeeperId) {
        const { data: hkData } = await supabase
          .from('housekeepers')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('user_id', housekeeperId)
          .single();
        
        if (hkData) {
          housekeeperTableId = hkData.id;
        }
      }

      const possibleIds = [
        housekeeperId,
        housekeeperTableId,
        housekeeperProfile?.id
      ].filter(Boolean);

      let orFilter = possibleIds.map(id => `housekeeper_id.eq.${id}`).join(',');
      if (housekeeperName) {
        orFilter += `,housekeeper_name.eq.${housekeeperName}`;
      }

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          rooms (
            id,
            room_number,
            status,
            notes,
            cleaning_priority,
            cleaning_type
          )
        `)
        .eq('hotel_id', hotelId)
        .or(orFilter)
        .in('status', ['assigned', 'in_progress', 'completed'])
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        console.error('Erreur chargement assignations:', assignmentsError);
        const cached = localStorage.getItem(`assignments_${hotelId}_${housekeeperId}`);
        if (cached) {
          try {
            const { assignments: cachedAssignments, rooms: cachedRooms, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
              setAssignments(cachedAssignments);
              setRooms(cachedRooms);
            }
          } catch (e) {
            console.error('Erreur parsing cache:', e);
          }
        }
        return;
      }

      // Dédupliquer les assignations
      const uniqueAssignments = assignmentsData?.reduce((acc: any[], curr: any) => {
        const existingIndex = acc.findIndex(a => a.room_id === curr.room_id);
        if (existingIndex === -1) {
          acc.push(curr);
        } else if (new Date(curr.created_at) > new Date(acc[existingIndex].created_at)) {
          acc[existingIndex] = curr;
        }
        return acc;
      }, []) || [];

      const extractedRooms: Room[] = uniqueAssignments
        .filter((a: any) => a.rooms)
        .map((a: any) => ({
          id: a.rooms.id,
          room_number: a.rooms.room_number,
          status: a.rooms.status || 'needs-cleaning',
          notes: a.rooms.notes,
          cleaning_priority: a.rooms.cleaning_priority || 5,
          cleaning_type: a.rooms.cleaning_type
        }));

      setAssignments(uniqueAssignments);
      setRooms(extractedRooms);
      
      // Sauvegarder dans le cache
      localStorage.setItem(`assignments_${hotelId}_${housekeeperId}`, JSON.stringify({
        assignments: uniqueAssignments,
        rooms: extractedRooms,
        timestamp: Date.now()
      }));

      // Charger les tâches d'inventaire linge
      const today = new Date().toISOString().split('T')[0];
      const { data: linenTasks } = await supabase
        .from('linen_inventory_tasks')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('task_date', today)
        .in('status', ['pending', 'in_progress']);
      
      if (linenTasks && linenTasks.length > 0) {
        const myTask = linenTasks.find((t: any) => 
          t.assigned_to === housekeeperName || 
          t.assigned_to === housekeeperId
        );
        if (myTask) {
          setActiveLinenTask(myTask.id);
        }
      }
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de travail",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRoomStatusChange = async (roomId: string, newStatus: string, notes?: string) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      const { error: roomError } = await supabase
        .from('rooms')
        .update({ 
          status: newStatus,
          notes: notes || room.notes
        })
        .eq('id', roomId);

      if (roomError) throw roomError;

      const assignment = assignments.find(a => a.room_id === roomId);
      if (assignment) {
        const newAssignmentStatus = newStatus === 'clean' ? 'completed' : 
                                    newStatus === 'in-progress' ? 'in_progress' : 'assigned';
        
        await supabase
          .from('assignments')
          .update({ 
            status: newAssignmentStatus,
            completed_at: newStatus === 'clean' ? new Date().toISOString() : null
          })
          .eq('id', assignment.id);
      }

      // Logger l'action
      if (hotelId) {
        await supabase.from('daily_action_logs').insert({
          hotel_id: hotelId,
          action_type: newStatus === 'clean' ? 'cleaning-end' : 'cleaning-start',
          description: `Chambre ${room.room_number} - ${newStatus === 'clean' ? 'Nettoyage terminé' : 'Nettoyage en cours'}`,
          room_number: room.room_number,
          actor_name: housekeeperName,
          actor_type: 'housekeeper',
          details: { notes, previousStatus: room.status }
        });
      }

      setRooms(prev => prev.map(r => 
        r.id === roomId ? { ...r, status: newStatus, notes: notes || r.notes } : r
      ));

      const statusText = newStatus === 'clean' ? 'terminé' : 'en cours';
      addToActivityLog(`✅ Chambre ${room.room_number} - Nettoyage ${statusText}`, 'success');

      toast({
        title: newStatus === 'clean' ? "✅ Chambre nettoyée" : "🔄 En cours",
        description: `Chambre ${room.room_number} ${statusText}`,
      });

    } catch (error) {
      console.error('Erreur changement statut:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    storageService.clearHousekeeperProfile();
    localStorage.removeItem(`assignments_${hotelId}_${housekeeperProfile?.id || 'temp'}`);
    
    if (isAuthenticatedHousekeeper) {
      navigate('/housekeeper/hotels');
    } else {
      navigate('/housekeeper/login');
    }
  };

  const completedRooms = rooms.filter(r => r.status === 'clean').length;
  const totalRooms = rooms.length;
  const progressPercent = totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;

  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.status === 'clean' && b.status !== 'clean') return 1;
    if (a.status !== 'clean' && b.status === 'clean') return -1;
    if (a.cleaning_priority !== b.cleaning_priority) return b.cleaning_priority - a.cleaning_priority;
    return a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Chargement de vos chambres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">{hotel?.name || 'Mon Hôtel'}</h1>
                <p className="text-sm text-muted-foreground">{housekeeperName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Indicateur connexion */}
              <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
                {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isConnected ? 'Connecté' : 'Hors ligne'}
              </Badge>
              
              {/* Nouvelles chambres */}
              {newRoomsCount > 0 && (
                <Badge variant="secondary" className="animate-pulse bg-green-100 text-green-800">
                  +{newRoomsCount} nouvelle(s)
                </Badge>
              )}
              
              <Button variant="ghost" size="icon" onClick={() => setShowActivityLog(!showActivityLog)}>
                <ScrollText className="h-5 w-5" />
              </Button>
              
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Journal d'activité */}
      {showActivityLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <Card className="w-full max-w-md max-h-[60vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-lg">Journal d'activité</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowActivityLog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(60vh-80px)]">
              {activityLog.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucune activité</p>
              ) : (
                <div className="space-y-2">
                  {activityLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground whitespace-nowrap">{entry.time}</span>
                      <span className={
                        entry.type === 'success' ? 'text-green-600' :
                        entry.type === 'warning' ? 'text-yellow-600' :
                        entry.type === 'error' ? 'text-red-600' : ''
                      }>{entry.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{completedRooms}</div>
            <div className="text-xs text-muted-foreground">Terminées</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold">{totalRooms - completedRooms}</div>
            <div className="text-xs text-muted-foreground">Restantes</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{progressPercent}%</div>
            <div className="text-xs text-muted-foreground">Progression</div>
          </Card>
        </div>

        {/* Barre de progression */}
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-primary to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Pointage */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Pointage</span>
            </div>
            <div className="flex items-center gap-2">
              {startTime && <Badge variant="outline">Début: {startTime}</Badge>}
              {endTime && <Badge variant="outline">Fin: {endTime}</Badge>}
              {!startTime && (
                <Button size="sm" onClick={handleStartPointage}>
                  Commencer
                </Button>
              )}
              {startTime && !endTime && (
                <Button size="sm" variant="secondary" onClick={handleEndPointage}>
                  Terminer
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'rooms' ? 'default' : 'outline'}
            onClick={() => setActiveTab('rooms')}
            className="flex-1"
          >
            <Home className="h-4 w-4 mr-2" />
            Chambres ({totalRooms})
          </Button>
          {activeLinenTask && (
            <Button 
              variant={activeTab === 'inventory' ? 'default' : 'outline'}
              onClick={() => setActiveTab('inventory')}
              className="flex-1"
            >
              <Package className="h-4 w-4 mr-2" />
              Inventaire
            </Button>
          )}
        </div>

        {/* Contenu */}
        {activeTab === 'rooms' ? (
          <>
            {/* Actions rapides */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => loadWorkData()}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Actualisation...' : 'Actualiser'}
              </Button>
              {hotelId && (
                <IncidentReportDialogSimple 
                  hotelId={hotelId}
                  userType="housekeeper"
                />
              )}
            </div>

            {/* Liste des chambres */}
            {sortedRooms.length === 0 ? (
              <Card className="p-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Aucune chambre assignée</h3>
                <p className="text-muted-foreground">
                  Attendez que le responsable vous assigne des chambres
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {sortedRooms.map(room => (
                  <RoomCardEnhanced
                    key={room.id}
                    room={room}
                    hotelId={hotelId || ''}
                    onStatusChange={handleRoomStatusChange}
                    onNotesChange={(roomId, notes) => {
                      setRoomNotes(prev => ({ ...prev, [roomId]: notes }));
                    }}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Inventaire linge */
          activeLinenTask && hotelId && (
            <LinenQuickInventory
              taskId={activeLinenTask}
              hotelId={hotelId}
              onComplete={() => {
                setActiveLinenTask(null);
                setActiveTab('rooms');
                toast({
                  title: "✅ Inventaire terminé",
                  description: "Merci pour votre travail!"
                });
              }}
            />
          )
        )}

        {/* Chambres disponibles (client sorti) */}
        {availableRooms.length > 0 && (
          <Card className="border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">
                {availableRooms.length} chambre(s) disponible(s)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableRooms.map(room => (
                <Badge key={room.id} variant="outline" className="bg-white">
                  {room.room_number}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
