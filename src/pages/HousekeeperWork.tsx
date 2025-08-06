import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousekeeperAuth } from '@/contexts/HousekeeperAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  LogOut, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Home,
  User,
  Building2
} from 'lucide-react';

export default function HousekeeperWork() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    profile, 
    currentHotelSession, 
    disconnectFromHotel,
    isAuthenticated,
    isConnectedToHotel 
  } = useHousekeeperAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/housekeeper/auth');
      return;
    }

    if (!isConnectedToHotel || !currentHotelSession) {
      navigate('/housekeeper/dashboard');
      return;
    }
  }, [isAuthenticated, isConnectedToHotel, currentHotelSession, navigate]);

  const handleDisconnect = async () => {
    try {
      await disconnectFromHotel();
      toast({
        title: "Déconnecté",
        description: "Vous avez été déconnecté de l'hôtel avec succès"
      });
      navigate('/housekeeper/dashboard');
    } catch (error) {
      console.error('Disconnection error:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la déconnexion"
      });
    }
  };

  if (!profile || !currentHotelSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <div className="animate-pulse">Chargement...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {currentHotelSession.hotel?.name}
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {currentHotelSession.hotel?.address || 'Adresse non spécifiée'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/housekeeper/profile')}
            >
              <User className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/housekeeper/dashboard')}
            >
              <Home className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDisconnect}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Session Info */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium text-blue-800">Connecté en tant que</p>
                <p className="text-sm text-blue-600">{profile.name}</p>
              </div>
              <div>
                <p className="font-medium text-blue-800">Code d'accès</p>
                <p className="text-sm font-mono text-blue-600">{currentHotelSession.access_code}</p>
              </div>
              <div>
                <p className="font-medium text-blue-800">Session expire</p>
                <p className="text-sm text-blue-600">
                  {new Date(currentHotelSession.expires_at).toLocaleString()}
                </p>
              </div>
            </div>
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 mr-1" />
              Connecté
            </Badge>
          </div>
        </Card>
      </div>

      {/* Work Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">
            {currentHotelSession.rooms_cleaned_today}
          </div>
          <div className="text-sm text-gray-600">Chambres nettoyées aujourd'hui</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">
            {profile.total_rooms_cleaned}
          </div>
          <div className="text-sm text-gray-600">Total chambres nettoyées</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">
            {profile.average_rating ? profile.average_rating.toFixed(1) : 'N/A'}
          </div>
          <div className="text-sm text-gray-600">Note moyenne</div>
        </Card>
      </div>

      {/* Room Assignment Section */}
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            En attente d'assignation de chambres
          </h2>
          <p className="text-gray-600 mb-4">
            L'administrateur de l'hôtel va bientôt vous assigner des chambres à nettoyer.
          </p>
          <p className="text-sm text-gray-500">
            Vous recevrez une notification dès que vos chambres seront prêtes.
          </p>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Actions rapides</h3>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Clock className="h-4 w-4 mr-2" />
              Marquer une pause
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <AlertCircle className="h-4 w-4 mr-2" />
              Signaler un problème
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Informations</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Restez connecté pendant votre service</p>
            <p>• Les chambres vous seront assignées automatiquement</p>
            <p>• Votre progression est suivie en temps réel</p>
          </div>
        </Card>
      </div>
    </div>
  );
}