import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Save,
  Loader2,
  Award,
  Building2,
  Star,
  Calendar,
  Clock
} from "lucide-react";
import { useHousekeeperAuth } from "@/contexts/HousekeeperAuthContext";
import { supabase } from "@/integrations/supabase/client";

interface HotelHistory {
  id: string;
  hotel_id: string;
  started_at: string;
  ended_at?: string;
  rooms_cleaned: number;
  total_work_hours?: number;
  rating?: number;
  notes?: string;
  is_favorite: boolean;
  hotels: {
    name: string;
    hotel_code: string;
    address?: string;
  };
}

export default function HousekeeperProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, updateProfile, isAuthenticated } = useHousekeeperAuth();

  const [formData, setFormData] = useState({
    name: "",
    phone: ""
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [hotelHistory, setHotelHistory] = useState<HotelHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/housekeeper/auth');
      return;
    }

    if (profile) {
      setFormData({
        name: profile.name,
        phone: profile.phone || ""
      });
      loadFullHistory();
    }
  }, [isAuthenticated, profile, navigate]);

  const loadFullHistory = async () => {
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
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Error loading hotel history:', error);
      } else {
        setHotelHistory(data || []);
      }
    } catch (error) {
      console.error('Error in loadFullHistory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Nom requis",
        description: "Veuillez saisir votre nom"
      });
      return;
    }

    setIsUpdating(true);
    
    try {
      const { error } = await updateProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined
      });
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de mettre à jour le profil"
        });
      } else {
        toast({
          title: "Profil mis à jour",
          description: "Vos informations ont été sauvegardées"
        });
      }
    } catch (error) {
      console.error('Update profile error:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur inattendue est survenue"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else {
      return `${diffHours}h`;
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
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/housekeeper/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Mon Profil</h1>
            <p className="text-gray-600">Gérez vos informations personnelles</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations personnelles
            </CardTitle>
            <CardDescription>
              Modifiez vos informations de profil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  L'email ne peut pas être modifié
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nom complet *
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Téléphone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="06 12 34 56 78"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Mise à jour...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Sauvegarder
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Statistiques
            </CardTitle>
            <CardDescription>
              Votre performance globale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {profile.total_rooms_cleaned}
                </div>
                <div className="text-sm text-gray-600">Chambres nettoyées</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {profile.total_hotels_worked}
                </div>
                <div className="text-sm text-gray-600">Hôtels différents</div>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {profile.average_rating ? profile.average_rating.toFixed(1) : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Note moyenne</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {hotelHistory.filter(h => h.is_favorite).length}
                </div>
                <div className="text-sm text-gray-600">Hôtels favoris</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hotel History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historique complet
          </CardTitle>
          <CardDescription>
            Toutes vos missions de nettoyage
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
            </div>
          ) : (
            <div className="space-y-4">
              {hotelHistory.map((history) => (
                <div
                  key={history.id}
                  className="p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        {history.hotels.name}
                        {history.is_favorite && (
                          <Star className="h-4 w-4 text-yellow-500" />
                        )}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Code: {history.hotels.hotel_code}
                      </p>
                      {history.hotels.address && (
                        <p className="text-sm text-gray-500">
                          {history.hotels.address}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        {new Date(history.started_at).toLocaleDateString('fr-FR')}
                      </div>
                      {history.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm">{history.rating}/5</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Award className="h-4 w-4" />
                      <span>{history.rooms_cleaned} chambres</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(history.started_at, history.ended_at)}</span>
                    </div>
                    {history.total_work_hours && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>{history.total_work_hours}h travaillées</span>
                      </div>
                    )}
                  </div>
                  
                  {history.notes && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                      <strong>Notes:</strong> {history.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}