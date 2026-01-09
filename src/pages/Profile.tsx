import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Mail, Building, Calendar, Edit2, Save, X, Settings, Bell, LogOut, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import BackButton from '@/components/BackButton';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { useSubscription } from '@/hooks/useSubscription';
import { NotificationBell } from '@/components/NotificationBell';
import { PremiumLimitGuard } from '@/components/PremiumLimitGuard';

interface UserProfile {
  id: string;
  email: string;
  company_name: string | null;
  subscription_type: string | null;
  created_at: string;
  updated_at: string;
}

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { plan, subscribed, canAccessFeature, isInTrial, trialDaysRemaining } = useSubscription();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCompanyName, setEditedCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erreur chargement profil:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger le profil"
        });
        return;
      }

      setProfile(data);
      setEditedCompanyName(data.company_name || '');
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          company_name: editedCompanyName.trim() || null 
        })
        .eq('id', user.id);

      if (error) {
        console.error('Erreur mise à jour profil:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de mettre à jour le profil"
        });
        return;
      }

      setProfile(prev => prev ? {
        ...prev,
        company_name: editedCompanyName.trim() || null,
        updated_at: new Date().toISOString()
      } : null);

      setIsEditing(false);
      
      toast({
        title: "Profil mis à jour",
        description: "Les modifications ont été sauvegardées"
      });
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedCompanyName(profile?.company_name || '');
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="text-center py-8">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Profil introuvable</h3>
            <p className="text-muted-foreground">
              Impossible de charger les informations du profil
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-3xl font-bold">Mon Compte</h1>
              <p className="text-muted-foreground">
                Profil et paramètres
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <SubscriptionBadge 
              plan={plan}
              subscribed={subscribed}
              trialDaysRemaining={trialDaysRemaining}
              size="lg"
            />
          </div>
        </div>

        {/* Onglets */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Paramètres
            </TabsTrigger>
          </TabsList>

          {/* Onglet Profil */}
          <TabsContent value="profile" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Colonne principale */}
              <div className="lg:col-span-2 space-y-6">
                {/* Informations principales */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informations générales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Email */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <Label className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </Label>
                      <div className="md:col-span-2">
                        <Input
                          value={profile.email}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Non modifiable
                        </p>
                      </div>
                    </div>

                    {/* Nom établissement */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <Label className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Établissement
                      </Label>
                      <div className="md:col-span-2">
                        {isEditing ? (
                          <div className="space-y-3">
                            <Input
                              value={editedCompanyName}
                              onChange={(e) => setEditedCompanyName(e.target.value)}
                              placeholder="Nom de votre établissement"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isSaving}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="flex-1">
                              {profile.company_name || 'Non défini'}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditing(true)}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Modifier
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4" />
                          Créé le
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(profile.created_at), 'PPP', { locale: fr })}
                        </p>
                      </div>
                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4" />
                          Mis à jour
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(profile.updated_at), 'PPP', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Limites */}
                <Card>
                  <CardHeader>
                    <CardTitle>Limites du plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted/30 rounded-lg">
                        <div className={`text-2xl font-bold ${subscribed && plan === 'premium' ? 'text-premium' : 'text-primary'}`}>
                          {subscribed && plan === 'premium' ? '∞' : '1'}
                        </div>
                        <p className="text-sm text-muted-foreground">Hôtels</p>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-lg">
                        <div className={`text-2xl font-bold ${subscribed && plan === 'premium' ? 'text-premium' : 'text-primary'}`}>
                          {subscribed && plan === 'premium' ? '∞' : '50'}
                        </div>
                        <p className="text-sm text-muted-foreground">Chambres</p>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-lg">
                        <div className={`text-2xl font-bold ${subscribed && plan === 'premium' ? 'text-premium' : 'text-primary'}`}>
                          {subscribed && plan === 'premium' ? '∞' : '10'}
                        </div>
                        <p className="text-sm text-muted-foreground">Personnel</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Colonne latérale */}
              <div className="space-y-6">
                <SubscriptionCard />
              </div>
            </div>
          </TabsContent>

          {/* Onglet Facturation */}
          <TabsContent value="billing" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Facturation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Gérez vos informations de facturation et consultez vos factures.
                </p>
                <Button onClick={() => navigate('/invoices')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Voir mes factures
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Paramètres */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Gérez vos préférences de notifications pour rester informé de l'activité de votre établissement.
                </p>
                <div className="pt-2">
                  <NotificationBell />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Préférences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Les paramètres avancés sont accessibles depuis le tableau de bord principal.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <LogOut className="h-5 w-5" />
                  Déconnexion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Vous serez redirigé vers la page de connexion.
                </p>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = '/auth';
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Se déconnecter
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;