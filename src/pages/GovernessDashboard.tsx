import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Crown, LogOut, Building2, CheckCircle, AlertTriangle, Eye, Loader2, ClipboardList, RefreshCw } from 'lucide-react';
import { GovernessInspectionInterface } from '@/components/governess/GovernessInspectionInterface';
import { IncidentReportDialogSimple } from '@/components/incident/IncidentReportDialogSimple';
import { IncidentList } from '@/components/incident/IncidentList';

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

export default function GovernessDashboard() {
  const [profile, setProfile] = useState<GovernessProfile | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRooms: 0,
    cleanRooms: 0,
    inspectedRooms: 0,
    pendingIncidents: 0
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const storedProfile = localStorage.getItem('governess_profile');
    if (!storedProfile) {
      navigate('/governess/auth');
      return;
    }
    
    const parsedProfile = JSON.parse(storedProfile);
    setProfile(parsedProfile);
    loadHotels(parsedProfile.id);
  }, [navigate]);

  const loadHotels = async (profileId: string) => {
    try {
      // Charger les sessions d'hôtel actives pour cette gouvernante
      const { data: sessions, error } = await supabase
        .from('governess_hotel_sessions')
        .select(`
          hotel_id,
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
          .map(s => s.hotels)
          .filter((h): h is Hotel => h !== null);
        setHotels(uniqueHotels);
        
        // Sélectionner le premier hôtel par défaut
        if (uniqueHotels.length > 0 && !selectedHotel) {
          setSelectedHotel(uniqueHotels[0]);
        }
      }
    } catch (error) {
      console.error('Erreur chargement hôtels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = useCallback(async () => {
    if (!selectedHotel) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      // Chambres totales
      const { count: totalRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id);

      // Chambres propres
      const { count: cleanRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id)
        .eq('status', 'clean');

      // Chambres inspectées aujourd'hui
      const { count: inspectedRooms } = await supabase
        .from('room_inspections')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id)
        .eq('inspection_date', today)
        .eq('status', 'passed');

      // Incidents en cours
      const { count: pendingIncidents } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', selectedHotel.id)
        .in('status', ['open', 'in_progress']);

      setStats({
        totalRooms: totalRooms || 0,
        cleanRooms: cleanRooms || 0,
        inspectedRooms: inspectedRooms || 0,
        pendingIncidents: pendingIncidents || 0
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

  const handleRequestHotelAccess = async () => {
    const hotelCode = prompt("Entrez le code de l'hôtel :");
    if (!hotelCode || !profile) return;

    try {
      // Trouver l'hôtel
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('id, name, hotel_code')
        .eq('hotel_code', hotelCode.toUpperCase())
        .single();

      if (hotelError || !hotel) {
        toast({
          variant: "destructive",
          title: "Hôtel non trouvé",
          description: "Vérifiez le code et réessayez"
        });
        return;
      }

      // Créer une session
      const { error: sessionError } = await supabase
        .from('governess_hotel_sessions')
        .insert({
          governess_profile_id: profile.id,
          hotel_id: hotel.id,
          hotel_name: hotel.name,
          is_active: true,
          started_at: new Date().toISOString()
        });

      if (sessionError) throw sessionError;

      toast({
        title: "Hôtel ajouté !",
        description: `Vous avez maintenant accès à ${hotel.name}`
      });

      loadHotels(profile.id);
    } catch (error: any) {
      console.error('Erreur ajout hôtel:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-full">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Gouvernante</h1>
                <p className="text-sm text-muted-foreground">{profile.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedHotel && (
                <Badge variant="outline" className="hidden sm:flex">
                  <Building2 className="h-3 w-3 mr-1" />
                  {selectedHotel.name}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Sélection d'hôtel si plusieurs */}
        {hotels.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Aucun hôtel assigné</h2>
              <p className="text-muted-foreground mb-4">
                Demandez l'accès à un hôtel pour commencer
              </p>
              <Button onClick={handleRequestHotelAccess}>
                <Building2 className="h-4 w-4 mr-2" />
                Demander l'accès à un hôtel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalRooms}</p>
                    <p className="text-xs text-muted-foreground">Chambres</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.cleanRooms}</p>
                    <p className="text-xs text-muted-foreground">Propres</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-full">
                    <Eye className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.inspectedRooms}</p>
                    <p className="text-xs text-muted-foreground">Inspectées</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-red-100 p-2 rounded-full">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.pendingIncidents}</p>
                    <p className="text-xs text-muted-foreground">Incidents</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sélection hôtel si plusieurs */}
            {hotels.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Sélectionner un hôtel</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {hotels.map(hotel => (
                      <Button
                        key={hotel.id}
                        variant={selectedHotel?.id === hotel.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedHotel(hotel)}
                      >
                        {hotel.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs principal */}
            {selectedHotel && (
              <Tabs defaultValue="inspection" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="inspection" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Inspections
                  </TabsTrigger>
                  <TabsTrigger value="incidents" className="gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Incidents
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="inspection">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Inspections des chambres</CardTitle>
                          <CardDescription>
                            Validez les chambres nettoyées
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={loadStats}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Actualiser
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <GovernessInspectionInterface
                        hotelId={selectedHotel.id}
                        governessName={profile.name}
                        governessId={profile.id}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="incidents">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Gestion des incidents</CardTitle>
                          <CardDescription>
                            Signalez et suivez les incidents
                          </CardDescription>
                        </div>
                        <IncidentReportDialogSimple 
                          hotelId={selectedHotel.id}
                          userType="admin"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <IncidentList hotelId={selectedHotel.id} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {/* Bouton ajouter hôtel */}
            <div className="text-center">
              <Button variant="outline" onClick={handleRequestHotelAccess}>
                <Building2 className="h-4 w-4 mr-2" />
                Demander accès à un autre hôtel
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
