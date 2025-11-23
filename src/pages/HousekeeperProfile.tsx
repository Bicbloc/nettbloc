import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Home, 
  Star, 
  TrendingUp,
  Award,
  CheckCircle2,
  Building2
} from 'lucide-react';

interface Assignment {
  id: string;
  completed_at: string;
  started_at: string;
  actual_duration: number;
  rooms: {
    room_number: string;
    room_type: string;
  };
}

interface Stats {
  totalRoomsCleaned: number;
  totalHotelsWorked: number;
  averageTimePerRoom: number;
  recentAssignments: Assignment[];
  performanceByDay: { date: string; count: number }[];
}

export default function HousekeeperProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalRoomsCleaned: 0,
    totalHotelsWorked: 0,
    averageTimePerRoom: 0,
    recentAssignments: [],
    performanceByDay: []
  });

  const housekeeperData = localStorage.getItem('housekeeper') 
    ? JSON.parse(localStorage.getItem('housekeeper')!) 
    : null;
  const hotelId = localStorage.getItem('selectedHotelId');

  useEffect(() => {
    if (!housekeeperData || !hotelId) {
      toast({
        title: "Non connecté",
        description: "Veuillez vous connecter pour voir votre profil",
        variant: "destructive"
      });
      navigate('/housekeeper/login');
      return;
    }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Charger toutes les assignations complétées
      const { data: assignments, error } = await supabase
        .from('assignments')
        .select(`
          id,
          completed_at,
          started_at,
          actual_duration,
          rooms (
            room_number,
            room_type
          )
        `)
        .eq('hotel_id', hotelId)
        .eq('housekeeper_id', housekeeperData.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erreur chargement stats:', error);
        return;
      }

      const completedAssignments = assignments || [];
      
      // Calculer les statistiques
      const totalRooms = completedAssignments.length;
      
      // Temps moyen par chambre
      const totalDuration = completedAssignments.reduce((sum, a) => {
        return sum + (a.actual_duration || 0);
      }, 0);
      const avgTime = totalRooms > 0 ? Math.round(totalDuration / totalRooms) : 0;

      // Performance par jour (derniers 7 jours)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const performanceByDay = last7Days.map(date => {
        const count = completedAssignments.filter(a => 
          a.completed_at?.startsWith(date)
        ).length;
        return { date, count };
      });

      setStats({
        totalRoomsCleaned: totalRooms,
        totalHotelsWorked: 1, // Pour l'instant, on compte juste l'hôtel actuel
        averageTimePerRoom: avgTime,
        recentAssignments: completedAssignments.slice(0, 10) as Assignment[],
        performanceByDay
      });

    } catch (error) {
      console.error('Erreur chargement profil:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? mins : ''}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-6">
          <div className="animate-pulse text-center">Chargement du profil...</div>
        </Card>
      </div>
    );
  }

  const maxCount = Math.max(...stats.performanceByDay.map(d => d.count), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/housekeeper/work')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour au travail
        </Button>

        <Card className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {housekeeperData.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">{housekeeperData.name}</h1>
              <p className="text-blue-100">Code: {housekeeperData.accessCode}</p>
            </div>
            <Award className="h-16 w-16 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Chambres nettoyées</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalRoomsCleaned}</p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hôtels travaillés</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.totalHotelsWorked}</p>
              </div>
              <Building2 className="h-12 w-12 text-indigo-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Temps moyen</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatDuration(stats.averageTimePerRoom)}
                </p>
              </div>
              <Clock className="h-12 w-12 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance des 7 derniers jours */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance des 7 derniers jours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.performanceByDay.map((day, index) => {
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
              const percentage = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
              
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{dayName}</span>
                    <Badge variant={day.count > 0 ? "default" : "outline"}>
                      {day.count} {day.count === 1 ? 'chambre' : 'chambres'}
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Historique récent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historique récent ({stats.recentAssignments.length} dernières chambres)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentAssignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Home className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Aucune chambre nettoyée pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        Chambre {assignment.rooms?.room_number || 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(assignment.completed_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(assignment.actual_duration || 0)}
                    </Badge>
                    {assignment.rooms?.room_type && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {assignment.rooms.room_type}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badge de performance */}
      {stats.totalRoomsCleaned >= 10 && (
        <Card className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                <Star className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-orange-900">
                  🎉 Travailleur(se) assidu(e) !
                </h3>
                <p className="text-sm text-orange-700">
                  Vous avez nettoyé plus de {stats.totalRoomsCleaned} chambres. Continuez comme ça !
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}