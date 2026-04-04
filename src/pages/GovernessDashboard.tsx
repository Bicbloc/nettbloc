import React, { useState, useEffect, useCallback } from 'react';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Crown, 
  LogOut, 
  Building2, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  Loader2, 
  RefreshCw, 
  Clock, 
  XCircle, 
  Home, 
  Users, 
  FileText,
  Package,
  Shirt,
  ClipboardCheck,
  ArrowLeft,
  Info,
  ClipboardList
} from 'lucide-react';
import { GovernessInspectionInterface } from '@/components/governess/GovernessInspectionInterface';
import { GovernessRoomManagement } from '@/components/governess/GovernessRoomManagement';
import { GovernessStaffPanel } from '@/components/governess/GovernessStaffPanel';
import { GovernessActionLog } from '@/components/governess/GovernessActionLog';
import { IncidentReportWizard } from '@/components/incident/IncidentReportWizard';
import { IncidentList } from '@/components/incident/IncidentList';
import { LostItemReportWizard } from '@/components/lost-and-found/LostItemReportWizard';
import { LostAndFoundList } from '@/components/lost-and-found/LostAndFoundList';
import { LinenQuickInventory } from '@/components/linen/LinenQuickInventory';
import { AdminLinenInventory } from '@/components/linen/AdminLinenInventory';
import { StaffTasksList } from '@/components/tasks/StaffTasksList';
import { DailyInstructionsBanner } from '@/components/housekeeper/DailyInstructionsBanner';
import { StaffNotificationBanner } from '@/components/housekeeper/StaffNotificationBanner';
import { ReadOnlyFloorPlan } from '@/components/registry/ReadOnlyFloorPlan';
import { LayoutGrid } from 'lucide-react';

type GovTab = 'rooms' | 'inspection' | 'incidents' | 'lost' | 'linen' | 'staff' | 'validate' | 'logs' | 'tasks' | 'instructions' | 'plan';

interface GovernessProfile {
  id: string;
  name: string;
  email: string;
}

interface Hotel {
  id: string;
  name: string;
  hotel_code: string;
}

interface PendingRequest {
  id: string;
  hotel_id: string;
  hotel_code: string;
  status: string;
  requested_at: string;
  hotels: {
    name: string;
  } | null;
}

function GovernessDashboardContent() {
  const [profile, setProfile] = useState<GovernessProfile | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRooms: 0,
    cleanRooms: 0,
    inspectedRooms: 0,
    pendingIncidents: 0,
    lostItems: 0
  });
  
  // Dialog states
  const [isHotelDialogOpen, setIsHotelDialogOpen] = useState(false);
  const [hotelCodeInput, setHotelCodeInput] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [hotelCodeError, setHotelCodeError] = useState<string | null>(null);
  const [showLinenScanner, setShowLinenScanner] = useState(false);
  const [activeTab, setActiveTab] = useState<GovTab>('rooms');
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Realtime sync for live updates
  useRealtimeSync({
    hotelId: selectedHotel?.id,
    tables: ['rooms', 'incidents', 'assignments', 'lost_and_found', 'room_inspections'],
    onUpdate: useCallback(() => {
      loadStats();
    }, [selectedHotel]),
  });

  // Periodic session validation — check every 5 minutes that session is still active
  useEffect(() => {
    if (!profile || !selectedHotel) return;
    
    const validateSession = async () => {
      try {
        const { data } = await supabase
          .from('governess_hotel_sessions')
          .select('is_active')
          .eq('governess_profile_id', profile.id)
          .eq('hotel_id', selectedHotel.id)
          .eq('is_active', true)
          .maybeSingle();
        
        if (!data) {
          toast({
            variant: "destructive",
            title: "Session expirée",
            description: "Votre accès à cet hôtel a été révoqué."
          });
          setSelectedHotel(null);
          localStorage.removeItem('governess_selected_hotel');
          loadHotels(profile.id);
        }
      } catch (e) {
      }
    };

    const interval = setInterval(validateSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [profile, selectedHotel, toast]);

  useEffect(() => {
    const storedProfile = localStorage.getItem('governess_profile');
    if (!storedProfile) {
      navigate('/governess/auth');
      return;
    }
    
    const parsedProfile = JSON.parse(storedProfile);
    setProfile(parsedProfile);
    
    // Vérifier si un hôtel est déjà sélectionné
    const storedHotel = localStorage.getItem('governess_selected_hotel');
    if (storedHotel) {
      try {
        const hotel = JSON.parse(storedHotel);
        setSelectedHotel(hotel);
      } catch { /* ignore */ }
    }
    
    loadHotels(parsedProfile.id);
    loadPendingRequests(parsedProfile.id);
  }, [navigate]);

  const loadHotels = async (profileId: string) => {
    try {
      const { data: sessions, error } = await supabase
        .from('governess_hotel_sessions')
        .select(`
          hotel_id,
          is_active,
          hotels:hotel_id (
            id,
            name,
            hotel_code
          )
        `)
        .eq('governess_profile_id', profileId)
        .eq('is_active', true);

      if (error) throw error;

      if (sessions && sessions.length > 0) {
        const uniqueHotels = sessions
          .filter(s => s.is_active)
          .map(s => s.hotels)
          .filter((h): h is Hotel => h !== null);
        setHotels(uniqueHotels);
        
        // Validate currently selected hotel is still active
        if (selectedHotel) {
          const stillActive = uniqueHotels.some(h => h.id === selectedHotel.id);
          if (!stillActive) {
            toast({
              title: "Session expirée",
              description: "Votre accès à cet hôtel a été désactivé.",
              variant: "destructive"
            });
            setSelectedHotel(uniqueHotels.length > 0 ? uniqueHotels[0] : null);
            if (uniqueHotels.length > 0) {
              localStorage.setItem('governess_selected_hotel', JSON.stringify(uniqueHotels[0]));
            } else {
              localStorage.removeItem('governess_selected_hotel');
            }
          }
        } else if (uniqueHotels.length > 0) {
          const h = uniqueHotels[0];
          setSelectedHotel(h);
          localStorage.setItem('governess_selected_hotel', JSON.stringify(h));
        }
      } else {
        setHotels([]);
        if (selectedHotel) {
          setSelectedHotel(null);
          localStorage.removeItem('governess_selected_hotel');
        }
      }
    } catch (error) {
      console.error('Erreur chargement hôtels:', error);
      toast({
        title: "Erreur réseau",
        description: "Impossible de charger vos hôtels. Vérifiez votre connexion.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingRequests = async (profileId: string) => {
    try {
      const { data, error } = await supabase
        .from('governess_access_requests')
        .select(`
          id,
          hotel_id,
          hotel_code,
          status,
          requested_at,
          hotels:hotel_id (
            name
          )
        `)
        .eq('governess_profile_id', profileId)
        .in('status', ['pending', 'rejected'])
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setPendingRequests(data || []);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    }
  };

  const loadStats = useCallback(async () => {
    if (!selectedHotel) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { count: totalRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id);

      const { count: cleanRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id)
        .eq('status', 'clean');

      const { count: inspectedRooms } = await supabase
        .from('room_inspections')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id)
        .eq('inspection_date', today)
        .eq('status', 'passed');

      const { count: pendingIncidents } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id)
        .in('status', ['open', 'in_progress', 'new']);

      const { count: lostItems } = await supabase
        .from('lost_and_found')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id)
        .in('status', ['pending', 'reported']);

      setStats({
        totalRooms: totalRooms || 0,
        cleanRooms: cleanRooms || 0,
        inspectedRooms: inspectedRooms || 0,
        pendingIncidents: pendingIncidents || 0,
        lostItems: lostItems || 0
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  }, [selectedHotel]);

  useEffect(() => {
    if (selectedHotel) {
      loadStats();
    }
  }, [selectedHotel, loadStats]);

  const handleLogout = () => {
    localStorage.removeItem('governess_profile');
    toast({
      title: "Déconnexion",
      description: "À bientôt !"
    });
    navigate('/governess/auth');
  };

  const openHotelAccessDialog = () => {
    setHotelCodeInput('');
    setHotelCodeError(null);
    setIsHotelDialogOpen(true);
  };

  const handleSubmitHotelCode = async () => {
    if (!hotelCodeInput.trim() || !profile) return;

    setIsSubmittingCode(true);
    setHotelCodeError(null);

    try {
      const { data, error } = await supabase.functions.invoke('governess-request-hotel-access', {
        body: { 
          hotelCode: hotelCodeInput.trim(),
          governessProfileId: profile.id
        }
      });

      if (error) {
        console.error('Erreur edge function:', error);
        setHotelCodeError("Erreur de connexion au serveur");
        return;
      }

      if (data.error === 'hotel_not_found') {
        setHotelCodeError(`Code "${hotelCodeInput.toUpperCase().trim()}" introuvable.`);
        return;
      }

      if (data.error) {
        setHotelCodeError(data.details || data.error);
        return;
      }

      if (data.status === 'already_has_access') {
        toast({
          title: "Déjà accès",
          description: `Vous avez déjà accès à "${data.hotel.name}"`
        });
        setIsHotelDialogOpen(false);
        return;
      }

      if (data.status === 'request_pending') {
        toast({
          title: "Demande déjà en cours",
          description: `Votre demande pour "${data.hotel.name}" est en attente.`
        });
        setIsHotelDialogOpen(false);
        loadPendingRequests(profile.id);
        return;
      }

      if (data.status === 'request_submitted') {
        toast({
          title: "Demande envoyée !",
          description: `Demande d'accès à "${data.hotel.name}" soumise.`
        });
        setIsHotelDialogOpen(false);
        loadPendingRequests(profile.id);
      }
    } catch (error: any) {
      console.error('Erreur ajout hôtel:', error);
      setHotelCodeError("Erreur inattendue. Réessayez.");
    } finally {
      setIsSubmittingCode(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const initials = profile.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const bottomTabs: { key: GovTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'rooms', label: 'Chambres', icon: Home },
    { key: 'inspection', label: 'Contrôle', icon: Eye },
    { key: 'incidents', label: 'Incidents', icon: AlertTriangle, badge: stats.pendingIncidents },
    { key: 'staff', label: 'Personnel', icon: Users },
    { key: 'tasks', label: 'Tâches', icon: ClipboardList },
  ];

  const secondaryTabs: { key: GovTab; label: string; icon: React.ElementType }[] = [
    { key: 'lost', label: 'Objets trouvés', icon: Package },
    { key: 'linen', label: 'Linge', icon: Shirt },
    { key: 'validate', label: 'Validation', icon: ClipboardCheck },
    { key: 'plan', label: 'Plan', icon: LayoutGrid },
    { key: 'instructions', label: 'Consignes', icon: Info },
    { key: 'logs', label: 'Journal', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* App Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-500 to-orange-500 text-white safe-area-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <span className="font-bold text-base">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-medium">{greeting} 👑</p>
                <h1 className="font-bold text-base truncate">{profile.name}</h1>
                {selectedHotel && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Building2 className="h-3 w-3 text-white/60 flex-shrink-0" />
                    <span className="text-xs text-white/70 truncate">{selectedHotel.name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => navigate('/governess/hotels')}>
                <Building2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Secondary tabs - scrollable */}
        <div className="flex overflow-x-auto gap-1 px-4 pb-2 scrollbar-hide">
          {secondaryTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                activeTab === key
                  ? "bg-white text-amber-700"
                  : "bg-white/15 text-white/80 hover:bg-white/25"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <StaffNotificationBanner hotelId={selectedHotel?.id} />

      <main className="px-4 py-4 space-y-4">
        {/* Demandes en attente */}
        {pendingRequests.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Demandes en attente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingRequests.filter(r => r.status === 'pending').map(request => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="font-medium text-sm">{request.hotels?.name || request.hotel_code}</p>
                      <p className="text-xs text-muted-foreground">
                        Demandé le {new Date(request.requested_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                    En attente
                  </Badge>
                </div>
              ))}
              {pendingRequests.filter(r => r.status === 'rejected').map(request => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-red-200">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="font-medium text-sm">{request.hotels?.name || request.hotel_code}</p>
                      <p className="text-xs text-muted-foreground">Demande refusée</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs rounded-xl"
                    onClick={() => { setHotelCodeInput(request.hotel_code); setIsHotelDialogOpen(true); }}>
                    Réessayer
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {hotels.length === 0 && pendingRequests.filter(r => r.status === 'pending').length === 0 ? (
          <Card className="text-center py-12 rounded-2xl">
            <CardContent>
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Aucun hôtel assigné</h2>
              <p className="text-muted-foreground mb-4">Demandez l'accès à un hôtel pour commencer</p>
              <Button onClick={openHotelAccessDialog} className="rounded-xl">
                <Building2 className="h-4 w-4 mr-2" />
                Demander l'accès
              </Button>
            </CardContent>
          </Card>
        ) : hotels.length === 0 ? (
          <Card className="text-center py-8 rounded-2xl">
            <CardContent>
              <Clock className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h2 className="text-lg font-semibold mb-2">Demandes en cours</h2>
              <p className="text-muted-foreground mb-4">Vos demandes sont en attente de validation.</p>
              <Button variant="outline" onClick={openHotelAccessDialog} className="rounded-xl">
                <Building2 className="h-4 w-4 mr-2" />
                Demander accès à un autre hôtel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { value: stats.totalRooms, label: 'Total', color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30', icon: Building2 },
                { value: stats.cleanRooms, label: 'Propres', color: 'bg-green-100 text-green-600 dark:bg-green-950/30', icon: CheckCircle },
                { value: stats.inspectedRooms, label: 'Inspectées', color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30', icon: Eye },
                { value: stats.pendingIncidents, label: 'Incidents', color: 'bg-red-100 text-red-600 dark:bg-red-950/30', icon: AlertTriangle },
                { value: stats.lostItems, label: 'Objets', color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30', icon: Package },
              ].map(({ value, label, color, icon: StatIcon }) => (
                <Card key={label} className="p-2 rounded-2xl">
                  <div className="text-center">
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1", color)}>
                      <StatIcon className="h-4 w-4" />
                    </div>
                    <p className="text-lg font-bold">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Hotel selector */}
            {hotels.length > 1 && (
              <div className="flex overflow-x-auto gap-2 pb-1">
                {hotels.map(hotel => (
                  <Button
                    key={hotel.id}
                    variant={selectedHotel?.id === hotel.id ? "default" : "outline"}
                    size="sm"
                    className="rounded-xl whitespace-nowrap"
                    onClick={() => { setSelectedHotel(hotel); localStorage.setItem('governess_selected_hotel', JSON.stringify(hotel)); }}
                  >
                    {hotel.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Tab Content */}
            {selectedHotel && (
              <>
                {activeTab === 'rooms' && (
                  <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b">
                      <h2 className="font-semibold">Gestion des chambres</h2>
                      <p className="text-xs text-muted-foreground">Visualisez et assignez les chambres</p>
                    </div>
                    <div className="p-4">
                      <GovernessRoomManagement hotelId={selectedHotel.id} governessName={profile.name} />
                    </div>
                  </div>
                )}

                {activeTab === 'inspection' && (
                  <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold">Inspections</h2>
                        <p className="text-xs text-muted-foreground">Validez les chambres nettoyées</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={loadStats} className="rounded-xl">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Actualiser
                      </Button>
                    </div>
                    <div className="p-4">
                      <GovernessInspectionInterface hotelId={selectedHotel.id} governessName={profile.name} governessId={profile.id} />
                    </div>
                  </div>
                )}

                {activeTab === 'incidents' && (
                  <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h2 className="font-semibold">Incidents</h2>
                        <p className="text-xs text-muted-foreground">Signalez et suivez les incidents</p>
                      </div>
                      <IncidentReportWizard hotelId={selectedHotel.id} userType="governess" userName={profile.name} userId={profile.id} onSuccess={loadStats} />
                    </div>
                    <div className="p-4">
                      <IncidentList hotelId={selectedHotel.id} />
                    </div>
                  </div>
                )}

                {activeTab === 'lost' && (
                  <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h2 className="font-semibold">Objets trouvés</h2>
                        <p className="text-xs text-muted-foreground">Déclarez et gérez les objets perdus</p>
                      </div>
                      <LostItemReportWizard hotelId={selectedHotel.id} reporterName={profile.name} reporterType="governess" onSuccess={loadStats} />
                    </div>
                    <div className="p-4">
                      <LostAndFoundList hotelId={selectedHotel.id} />
                    </div>
                  </div>
                )}

                {activeTab === 'linen' && (
                  <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h2 className="font-semibold">Inventaire du linge</h2>
                        <p className="text-xs text-muted-foreground">Scanner et compter le linge</p>
                      </div>
                      <Button onClick={() => setShowLinenScanner(true)} className="rounded-xl">
                        <Shirt className="h-4 w-4 mr-2" />
                        Scanner
                      </Button>
                    </div>
                    <div className="p-4">
                      {showLinenScanner && (
                        <LinenQuickInventory taskId={`temp-governess-${Date.now()}`} hotelId={selectedHotel.id} onClose={() => setShowLinenScanner(false)} />
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'staff' && (
                  <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b">
                      <h2 className="font-semibold">Personnel</h2>
                      <p className="text-xs text-muted-foreground">Suivez l'activité des femmes de chambre</p>
                    </div>
                    <div className="p-4">
                      <GovernessStaffPanel hotelId={selectedHotel.id} />
                    </div>
                  </div>
                )}

                {activeTab === 'validate' && (
                  <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b">
                      <h2 className="font-semibold">Validation des inventaires</h2>
                      <p className="text-xs text-muted-foreground">Vérifiez les comptages de linge</p>
                    </div>
                    <div className="p-4">
                      <AdminLinenInventory hotelId={selectedHotel.id} hotelName={selectedHotel.name} />
                    </div>
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b">
                      <h2 className="font-semibold">Journal d'actions</h2>
                      <p className="text-xs text-muted-foreground">Historique du personnel</p>
                    </div>
                    <div className="p-4">
                      <GovernessActionLog hotelId={selectedHotel.id} />
                    </div>
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className="space-y-4">
                    <div className="bg-card rounded-2xl p-4 shadow-sm border">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500 text-white">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="font-semibold">Tâches du jour</h2>
                          <p className="text-xs text-muted-foreground">Vos missions assignées</p>
                        </div>
                      </div>
                    </div>
                    <StaffTasksList hotelId={selectedHotel.id} staffType="governess" staffId={profile.id} staffName={profile.name} />
                  </div>
                )}

                {activeTab === 'instructions' && (
                  <DailyInstructionsBanner hotelId={selectedHotel.id} />
                )}
              </>
            )}

            {/* Add hotel button */}
            <div className="text-center pt-2">
              <Button variant="outline" onClick={openHotelAccessDialog} className="rounded-xl">
                <Building2 className="h-4 w-4 mr-2" />
                Demander accès à un autre hôtel
              </Button>
            </div>
          </>
        )}
      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t safe-area-bottom">
        <div className="grid grid-cols-5 px-2 py-1">
          {bottomTabs.map(({ key, label, icon: Icon, badge }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all duration-200",
                  isActive ? "text-amber-600" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "relative p-1.5 rounded-xl transition-all duration-200",
                  isActive && "bg-amber-100 dark:bg-amber-950/30"
                )}>
                  <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                  {badge && badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 bg-destructive text-destructive-foreground">
                      {badge}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-amber-600" : "text-muted-foreground"
                )}>
                  {label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-1 w-5 h-0.5 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dialog code hôtel */}
      <Dialog open={isHotelDialogOpen} onOpenChange={setIsHotelDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-600" />
              Accès à un hôtel
            </DialogTitle>
            <DialogDescription>
              Entrez le code de l'hôtel fourni par l'établissement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hotel-code">Code hôtel</Label>
              <Input
                id="hotel-code"
                placeholder="Ex: HTL630"
                value={hotelCodeInput}
                onChange={(e) => { setHotelCodeInput(e.target.value.toUpperCase()); setHotelCodeError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isSubmittingCode) handleSubmitHotelCode(); }}
                className="uppercase rounded-xl"
                autoFocus
              />
              {hotelCodeError && <p className="text-sm text-destructive">{hotelCodeError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHotelDialogOpen(false)} disabled={isSubmittingCode} className="rounded-xl">
              Annuler
            </Button>
            <Button onClick={handleSubmitHotelCode} disabled={!hotelCodeInput.trim() || isSubmittingCode} className="rounded-xl">
              {isSubmittingCode ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Vérification...</> : 'Valider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GovernessDashboard() {
  return <GovernessDashboardContent />;
}
