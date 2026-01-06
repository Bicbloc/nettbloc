import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Crown, LogOut, Building2, CheckCircle, AlertTriangle, Eye, Loader2, RefreshCw, Clock, XCircle } from 'lucide-react';
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

export default function GovernessDashboard() {
  const [profile, setProfile] = useState<GovernessProfile | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRooms: 0,
    cleanRooms: 0,
    inspectedRooms: 0,
    pendingIncidents: 0
  });
  
  // Dialog state for hotel code input
  const [isHotelDialogOpen, setIsHotelDialogOpen] = useState(false);
  const [hotelCodeInput, setHotelCodeInput] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [hotelCodeError, setHotelCodeError] = useState<string | null>(null);
  
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
    loadPendingRequests(parsedProfile.id);
  }, [navigate]);

  const loadHotels = async (profileId: string) => {
    try {
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
        setHotelCodeError(`Code "${hotelCodeInput.toUpperCase().trim()}" introuvable. Vérifiez auprès de l'établissement.`);
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
          description: `Votre demande pour "${data.hotel.name}" est en attente de validation.`
        });
        setIsHotelDialogOpen(false);
        loadPendingRequests(profile.id);
        return;
      }

      if (data.status === 'request_submitted') {
        toast({
          title: "Demande envoyée !",
          description: `Votre demande d'accès à "${data.hotel.name}" a été soumise. L'établissement doit la valider.`
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
        {/* Demandes en attente */}
        {pendingRequests.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Demandes en attente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingRequests.filter(r => r.status === 'pending').map(request => (
                <div 
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="font-medium">{request.hotels?.name || request.hotel_code}</p>
                      <p className="text-xs text-muted-foreground">
                        Demandé le {new Date(request.requested_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                    En attente
                  </Badge>
                </div>
              ))}
              {pendingRequests.filter(r => r.status === 'rejected').map(request => (
                <div 
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="font-medium">{request.hotels?.name || request.hotel_code}</p>
                      <p className="text-xs text-muted-foreground">Demande refusée</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setHotelCodeInput(request.hotel_code);
                      setIsHotelDialogOpen(true);
                    }}
                  >
                    Refaire une demande
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {hotels.length === 0 && pendingRequests.filter(r => r.status === 'pending').length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Aucun hôtel assigné</h2>
              <p className="text-muted-foreground mb-4">
                Demandez l'accès à un hôtel pour commencer
              </p>
              <Button onClick={openHotelAccessDialog}>
                <Building2 className="h-4 w-4 mr-2" />
                Demander l'accès à un hôtel
              </Button>
            </CardContent>
          </Card>
        ) : hotels.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent>
              <Clock className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h2 className="text-lg font-semibold mb-2">Demandes en cours</h2>
              <p className="text-muted-foreground mb-4">
                Vos demandes sont en attente de validation par les établissements.
              </p>
              <Button variant="outline" onClick={openHotelAccessDialog}>
                <Building2 className="h-4 w-4 mr-2" />
                Demander accès à un autre hôtel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
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
              <Button variant="outline" onClick={openHotelAccessDialog}>
                <Building2 className="h-4 w-4 mr-2" />
                Demander accès à un autre hôtel
              </Button>
            </div>
          </>
        )}
      </main>

      {/* Dialog intégré pour le code hôtel */}
      <Dialog open={isHotelDialogOpen} onOpenChange={setIsHotelDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
                onChange={(e) => {
                  setHotelCodeInput(e.target.value.toUpperCase());
                  setHotelCodeError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSubmittingCode) {
                    handleSubmitHotelCode();
                  }
                }}
                className="uppercase"
                autoFocus
              />
              {hotelCodeError && (
                <p className="text-sm text-destructive">{hotelCodeError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsHotelDialogOpen(false)}
              disabled={isSubmittingCode}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmitHotelCode}
              disabled={!hotelCodeInput.trim() || isSubmittingCode}
            >
              {isSubmittingCode ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Valider'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
