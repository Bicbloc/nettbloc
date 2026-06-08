import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Mail, Building, Calendar, Edit2, Save, X, Settings, Bell, LogOut, FileText, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const { refreshHotel } = useHotel();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { plan, subscribed, canAccessFeature, isInTrial, trialDaysRemaining } = useSubscription();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCompanyName, setEditedCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubAccount, setIsSubAccount] = useState(false);
  const [parentEmail, setParentEmail] = useState<string | null>(null);

  useEffect(() => {
    // Vérifier si c'est un sous-compte
    if (user) {
      const isSubAccountFlag = user.user_metadata?.is_sub_account === true;
      setIsSubAccount(isSubAccountFlag);

      if (isSubAccountFlag) {
        // Récupérer l'email de l'admin parent
        supabase
          .from('sub_accounts')
          .select('parent_user_id')
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.parent_user_id) {
              supabase
                .from('profiles')
                .select('email')
                .eq('id', data.parent_user_id)
                .maybeSingle()
                .then(({ data: parentProfile }) => {
                  if (parentProfile?.email) {
                    setParentEmail(parentProfile.email);
                  }
                });
            }
          });
      }
    }
  }, [user]);

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

      // Le nom de l'hôtel (affiché sur la page principale) est la source de vérité.
      // On l'utilise pour aligner l'affichage des paramètres si les deux diffèrent.
      let resolvedName = data.company_name || '';
      const { data: hotelData } = await supabase
        .from('hotels')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (hotelData?.name) {
        resolvedName = hotelData.name;
      }

      setProfile({ ...data, company_name: resolvedName || data.company_name });
      setEditedCompanyName(resolvedName);
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
      const newName = editedCompanyName.trim() || null;
      const { error } = await supabase
        .from('profiles')
        .update({ 
          company_name: newName 
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

      // Garder le nom de l'hôtel synchronisé avec le nom de l'établissement
      if (newName) {
        await supabase
          .from('hotels')
          .update({ name: newName })
          .eq('user_id', user.id);
        // Rafraîchir le contexte pour que le nom se mette à jour partout (page principale, en-têtes…)
        await refreshHotel();
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
                        {isSubAccount ? (
                          <div className="space-y-2">
                            <span className="text-foreground">
                              {profile.company_name || 'Non défini'}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              Seul l'administrateur peut modifier ce champ
                            </p>
                          </div>
                        ) : isEditing ? (
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
                      <div className={`text-2xl font-bold ${subscribed && plan === 'confort' ? 'text-premium' : 'text-primary'}`}>
                          {subscribed && plan === 'confort' ? '∞' : '1'}
                        </div>
                        <p className="text-sm text-muted-foreground">Hôtels</p>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-lg">
                        <div className={`text-2xl font-bold ${subscribed && plan === 'confort' ? 'text-premium' : 'text-primary'}`}>
                          {subscribed && plan === 'confort' ? '∞' : '50'}
                        </div>
                        <p className="text-sm text-muted-foreground">Chambres</p>
                      </div>
                      <div className="text-center p-4 bg-muted/30 rounded-lg">
                        <div className={`text-2xl font-bold ${subscribed && plan === 'confort' ? 'text-premium' : 'text-primary'}`}>
                          {subscribed && plan === 'confort' ? '∞' : '10'}
                        </div>
                        <p className="text-sm text-muted-foreground">Personnel</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Colonne latérale - cachée pour les sous-comptes */}
              {!isSubAccount && (
                <div className="space-y-6">
                  <SubscriptionCard />
                </div>
              )}
            </div>
          </TabsContent>

          {/* Onglet Facturation */}
          <TabsContent value="billing" className="space-y-6 mt-6">
            {isSubAccount ? (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-2">Accès restreint</p>
                  <p className="text-sm mb-3">
                    Vous n'avez pas accès à la facturation en tant que sous-compte.
                    Pour toute question concernant la facturation, contactez l'administrateur de votre compte.
                  </p>
                  {parentEmail && (
                    <a 
                      href={`mailto:${parentEmail}`}
                      className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                    >
                      <Mail className="h-4 w-4" />
                      {parentEmail}
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
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
            )}
          </TabsContent>

          {/* Onglet Paramètres */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Gérez vos préférences de notifications pour rester informé de l'activité de votre établissement.
                </p>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Activer les notifications</Label>
                    <p className="text-xs text-muted-foreground">Notifications dans l'application et push.</p>
                  </div>
                  <Switch
                    checked={preferences.notifications.push}
                    onCheckedChange={(v) => updatePreference('notifications', { push: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Notifications par e-mail</Label>
                    <p className="text-xs text-muted-foreground">Recevoir un e-mail pour les événements importants.</p>
                  </div>
                  <Switch
                    checked={preferences.notifications.email}
                    onCheckedChange={(v) => updatePreference('notifications', { email: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Son des notifications</Label>
                    <p className="text-xs text-muted-foreground">Émettre un son à la réception.</p>
                  </div>
                  <Switch
                    checked={preferences.notifications.sound}
                    onCheckedChange={(v) => updatePreference('notifications', { sound: v })}
                  />
                </div>

                <div className={cn('space-y-2', !preferences.notifications.email && 'opacity-50 pointer-events-none')}>
                  <Label htmlFor="notif-email">Adresse e-mail de réception des notifications</Label>
                  <Input
                    id="notif-email"
                    type="email"
                    placeholder="exemple@hotel.com"
                    value={preferences.notifications.email_address}
                    onChange={(e) => updatePreference('notifications', { email_address: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Laissez vide pour utiliser l'adresse de votre compte.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Types d'e-mails */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Types d'e-mails
                </CardTitle>
              </CardHeader>
              <CardContent className={cn('space-y-4', !preferences.notifications.email && 'opacity-50 pointer-events-none')}>
                <p className="text-sm text-muted-foreground">
                  Choisissez les e-mails que vous souhaitez recevoir.
                </p>
                {([
                  { key: 'closureRecap', label: 'Récapitulatif de clôture', desc: "Résumé envoyé à chaque clôture de journée." },
                  { key: 'dailyReports', label: 'Rapports quotidiens', desc: 'Rapports d\'activité de l\'établissement.' },
                  { key: 'incidents', label: 'Incidents', desc: 'Alerte lors d\'un nouvel incident.' },
                  { key: 'accessRequests', label: "Demandes d'accès du personnel", desc: 'Nouvelle demande de connexion du personnel.' },
                ] as const).map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">{item.label}</Label>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={preferences.emails[item.key]}
                      onCheckedChange={(v) => updatePreference('emails', { [item.key]: v })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Clôture & archives */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Clôture & archives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Définissez l'heure et les jours de clôture automatique, ainsi que l'adresse e-mail
                  qui recevra le récapitulatif d'archivage à chaque clôture.
                </p>
                {hotelId ? (
                  <AutoCloseSettingsDialog hotelId={hotelId} />
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun établissement actif.</p>
                )}
              </CardContent>
            </Card>

            {/* Préférences générales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Préférences générales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Rafraîchissement automatique</Label>
                    <p className="text-xs text-muted-foreground">Mettre à jour les données en temps réel.</p>
                  </div>
                  <Switch
                    checked={preferences.dashboard.autoRefresh}
                    onCheckedChange={(v) => updatePreference('dashboard', { autoRefresh: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Animations</Label>
                    <p className="text-xs text-muted-foreground">Activer les transitions et animations.</p>
                  </div>
                  <Switch
                    checked={preferences.accessibility.animations}
                    onCheckedChange={(v) => updatePreference('accessibility', { animations: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Contraste élevé</Label>
                    <p className="text-xs text-muted-foreground">Améliorer la lisibilité.</p>
                  </div>
                  <Switch
                    checked={preferences.accessibility.highContrast}
                    onCheckedChange={(v) => updatePreference('accessibility', { highContrast: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="font-size">Taille de police</Label>
                  <select
                    id="font-size"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={preferences.accessibility.fontSize}
                    onChange={(e) => updatePreference('accessibility', { fontSize: e.target.value as 'small' | 'medium' | 'large' })}
                  >
                    <option value="small">Petite</option>
                    <option value="medium">Moyenne</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Déconnexion */}
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