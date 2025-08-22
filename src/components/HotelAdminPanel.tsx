import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HousekeeperTeamManager } from './HousekeeperTeamManager';
import { HousekeeperStatusDashboard } from './HousekeeperStatusDashboard';
import { HousekeeperAccessRequests } from './HousekeeperAccessRequests';
import { AccessCodeQRDisplay } from './AccessCodeQRDisplay';
import { GeneralAccessCodes } from './GeneralAccessCodes';
import { NotificationBell } from './NotificationBell';
import { Hotel, Users } from 'lucide-react';

export const HotelAdminPanel: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hotel, setHotel] = useState<any>(null);
  const [accessCodes, setAccessCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadHotelData();
    }
  }, [user]);

  const loadHotelData = async () => {
    try {
      const { data: hotelData, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading hotel:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les données de l'hôtel",
          variant: "destructive"
        });
        return;
      }

      setHotel(hotelData);

      // Load access codes for QR display
      if (hotelData) {
        const { data: codesData } = await supabase
          .from('housekeeper_access_codes')
          .select('*')
          .eq('hotel_id', hotelData.id)
          .eq('is_active', true);
        
        setAccessCodes(codesData || []);
      }
    } catch (error) {
      console.error('Error in loadHotelData:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5" />
              Configuration de l'hôtel requise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Aucun hôtel configuré. Veuillez contacter l'administrateur.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration de l'hôtel</h1>
          <p className="text-muted-foreground">
            {hotel.name} ({hotel.hotel_code})
          </p>
        </div>
        <NotificationBell hotelId={hotel.id} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Access Codes Display */}
        <AccessCodeQRDisplay 
          hotelCode={hotel.hotel_code || ''}
          accessCodes={accessCodes}
          hotelName={hotel.name}
        />
        
        {/* General Access Codes */}
        <GeneralAccessCodes />
        
        <HousekeeperTeamManager hotelId={hotel.id} />
        <HousekeeperStatusDashboard hotelId={hotel.id} />
        <HousekeeperAccessRequests />
      </div>
    </div>
  );
};