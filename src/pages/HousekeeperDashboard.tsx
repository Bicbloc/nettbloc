import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Building2, 
  Calendar, 
  Award, 
  Settings,
  LogOut,
  Plus,
  Clock,
  MapPin,
  Star,
  Loader2,
  KeyRound,
  ArrowRight
} from "lucide-react";
import { useHousekeeperAuth } from "@/contexts/HousekeeperAuthContext";
import { supabase } from "@/integrations/supabase/client";

interface HotelHistory {
  id: string;
  hotel_id: string;
  started_at: string;
  ended_at?: string;
  rooms_cleaned: number;
  is_favorite: boolean;
  hotels: {
    name: string;
    hotel_code: string;
    address?: string;
  };
}

export default function HousekeeperDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    profile, 
    currentHotelSession, 
    signOut, 
    connectToHotel,
    isAuthenticated,
    isConnectedToHotel 
  } = useHousekeeperAuth();

  const [accessCode, setAccessCode] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [hotelHistory, setHotelHistory] = useState<HotelHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/housekeeper/auth');
      return;
    }

    loadHotelHistory();
  }, [isAuthenticated, navigate, profile]);

  useEffect(() => {
    if (isConnectedToHotel && currentHotelSession) {
      // Redirect to work interface when connected
      navigate('/housekeeper/work');
    }
  }, [isConnectedToHotel, currentHotelSession, navigate]);

  const loadHotelHistory = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('housekeeper_hotel_history')
        .select(`
          *,
          hotels:hotel_id (
            name,
            hotel_code,
            address
          )
        `)
        .eq('housekeeper_profile_id', profile.id)
        .order('started_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error loading hotel history:', error);
      } else {
        setHotelHistory(data || []);
      }
    } catch (error) {
      console.error('Error in loadHotelHistory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectToHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessCode.trim()) {
      toast({
        variant: "destructive",
        title: "Code requis",
        description: "Veuillez saisir votre code d'accès"
      });
      return;
    }

    setIsConnecting(true);
    
    try {
      const result = await connectToHotel(accessCode);
      
      if (result.success) {
        toast({
          title: "Connexion réussie",
          description: `Connecté à ${result.session?.hotel?.name}`
        });
        // Navigation will be handled by useEffect
      } else {
        toast({
          variant: "destructive",
          title: "Connexion échouée",
          description: result.error || "Code d'accès invalide"
        });
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de la connexion"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/housekeeper/auth');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Chargement de votre profil...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Bonjour {profile.name} ! 👋
            </h1>
            <p className="text-gray-600">Votre espace personnel de travail</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/housekeeper/profile')}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Award className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {profile.total_rooms_cleaned}
              </div>
              <div className="text-sm text-gray-600">Chambres nettoyées</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {profile.total_hotels_worked}
              </div>
              <div className="text-sm text-gray-600">Hôtels différents</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Star className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {profile.average_rating ? profile.average_rating.toFixed(1) : 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Note moyenne</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hotel Connection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Se connecter à un hôtel
          </CardTitle>
          <CardDescription>
            Saisissez le code d'accès fourni par l'hôtel pour commencer votre service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnectToHotel} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-code">Code d'accès hôtel</Label>
              <Input
                id="access-code"
                type="text"
                placeholder="HTL002-MARIE-1234"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="text-center font-mono text-lg"
                autoFocus
                disabled={isConnecting}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connexion...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Se connecter
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Hotels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hôtels récents
          </CardTitle>
          <CardDescription>
            Vos dernières missions de nettoyage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Chargement de l'historique...</p>
            </div>
          ) : hotelHistory.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Aucun historique pour le moment</p>
              <p className="text-sm text-gray-500">
                Connectez-vous à votre premier hôtel pour commencer !
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {hotelHistory.map((history) => (
                <div
                  key={history.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">
                        {history.hotels.name}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <span>Code: {history.hotels.hotel_code}</span>
                        <span>•</span>
                        <span>{history.rooms_cleaned} chambres</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      {new Date(history.started_at).toLocaleDateString('fr-FR')}
                    </div>
                    {history.is_favorite && (
                      <Star className="h-4 w-4 text-yellow-500 ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}