import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, Building, Bell, Shield, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface HotelData {
  id: string;
  name: string;
  email: string;
  address: string | null;
  hotel_code: string | null;
  created_at: string;
  updated_at: string;
}

interface SettingsData {
  notifications: {
    email: boolean;
    desktop: boolean;
    roomUpdates: boolean;
    reportGenerated: boolean;
  };
  hotel: HotelData | null;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsData>({
    notifications: {
      email: true,
      desktop: false,
      roomUpdates: true,
      reportGenerated: true
    },
    hotel: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedHotelData, setEditedHotelData] = useState({
    name: '',
    address: ''
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      // Charger les données de l'hôtel
      const { data: hotelData, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (hotelError && hotelError.code !== 'PGRST116') {
        console.error('Erreur chargement hôtel:', hotelError);
      } else if (hotelData) {
        setSettings(prev => ({ ...prev, hotel: hotelData }));
        setEditedHotelData({
          name: hotelData.name,
          address: hotelData.address || ''
        });
      }

      // Charger les préférences de notifications (localStorage pour l'instant)
      const savedNotifications = localStorage.getItem('notificationSettings');
      if (savedNotifications) {
        const notifications = JSON.parse(savedNotifications);
        setSettings(prev => ({ ...prev, notifications }));
      }

    } catch (error) {
      console.error('Erreur chargement paramètres:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveHotel = async () => {
    if (!user || !settings.hotel) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('hotels')
        .update({
          name: editedHotelData.name.trim(),
          address: editedHotelData.address.trim() || null
        })
        .eq('id', settings.hotel.id);

      if (error) {
        console.error('Erreur mise à jour hôtel:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de mettre à jour l'hôtel"
        });
        return;
      }

      setSettings(prev => ({
        ...prev,
        hotel: prev.hotel ? {
          ...prev.hotel,
          name: editedHotelData.name.trim(),
          address: editedHotelData.address.trim() || null,
          updated_at: new Date().toISOString()
        } : null
      }));

      toast({
        title: "Hôtel mis à jour",
        description: "Les informations de l'établissement ont été sauvegardées"
      });

    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('notificationSettings', JSON.stringify(settings.notifications));
    toast({
      title: "Paramètres sauvegardés",
      description: "Vos préférences de notifications ont été mises à jour"
    });
  };

  const updateNotificationSetting = (key: keyof typeof settings.notifications, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">
            Configurez votre établissement et vos préférences
          </p>
        </div>

        <Tabs defaultValue="hotel" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hotel" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Établissement
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Sécurité
            </TabsTrigger>
          </TabsList>

          {/* Onglet Établissement */}
          <TabsContent value="hotel" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Informations de l'établissement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {settings.hotel ? (
                  <>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="hotel-name">Nom de l'établissement *</Label>
                          <Input
                            id="hotel-name"
                            value={editedHotelData.name}
                            onChange={(e) => setEditedHotelData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Nom de votre hôtel"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="hotel-code">Code de l'établissement</Label>
                          <Input
                            id="hotel-code"
                            value={settings.hotel.hotel_code || 'Non défini'}
                            disabled
                            className="bg-muted"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Code généré automatiquement
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="hotel-address">Adresse</Label>
                        <Input
                          id="hotel-address"
                          value={editedHotelData.address}
                          onChange={(e) => setEditedHotelData(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Adresse complète de l'établissement"
                        />
                      </div>

                      <div>
                        <Label htmlFor="hotel-email">Email de contact</Label>
                        <Input
                          id="hotel-email"
                          value={settings.hotel.email}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Email lié au compte propriétaire
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveHotel}
                        disabled={isSaving || !editedHotelData.name.trim()}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Aucun établissement configuré. Veuillez configurer un hôtel depuis la page principale.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Préférences de notification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notifications par email</Label>
                      <p className="text-sm text-muted-foreground">
                        Recevoir les notifications importantes par email
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.email}
                      onCheckedChange={(checked) => updateNotificationSetting('email', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notifications bureau</Label>
                      <p className="text-sm text-muted-foreground">
                        Afficher les notifications du navigateur
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.desktop}
                      onCheckedChange={(checked) => updateNotificationSetting('desktop', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Mises à jour des chambres</Label>
                      <p className="text-sm text-muted-foreground">
                        Être notifié des changements de statut des chambres
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.roomUpdates}
                      onCheckedChange={(checked) => updateNotificationSetting('roomUpdates', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Rapports générés</Label>
                      <p className="text-sm text-muted-foreground">
                        Être notifié quand un rapport est généré
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.reportGenerated}
                      onCheckedChange={(checked) => updateNotificationSetting('reportGenerated', checked)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveNotifications}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Sauvegarder les préférences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Sécurité */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Sécurité et confidentialité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Les paramètres de sécurité avancés seront disponibles dans une future mise à jour.
                    Actuellement, votre compte est sécurisé par l'authentification Supabase.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label>Authentification à deux facteurs</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Ajouter une couche de sécurité supplémentaire
                    </p>
                    <Button variant="outline" disabled>
                      Bientôt disponible
                    </Button>
                  </div>

                  <div>
                    <Label>Sessions actives</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Gérer les appareils connectés à votre compte
                    </p>
                    <Button variant="outline" disabled>
                      Bientôt disponible
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;