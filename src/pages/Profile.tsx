import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Building, Calendar, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BackButton } from '@/components/BackButton';

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
        {/* Header avec bouton retour */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-3xl font-bold">Mon Profil</h1>
              <p className="text-muted-foreground">
                Gérez vos informations personnelles et votre compte
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {profile.subscription_type === 'premium' ? 'Premium' : 'Gratuit'}
          </Badge>
        </div>

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
                Adresse email
              </Label>
              <div className="md:col-span-2">
                <Input
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  L'email ne peut pas être modifié
                </p>
              </div>
            </div>

            {/* Nom de l'entreprise */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Nom de l'établissement
              </Label>
              <div className="md:col-span-2">
                {isEditing ? (
                  <div className="space-y-3">
                      <Input
                        value={editedCompanyName}
                        onChange={(e) => setEditedCompanyName(e.target.value)}
                        placeholder="Nom de votre établissement (hôtel, résidence, etc.)"
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ce nom sera utilisé pour identifier votre établissement
                      </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1"
                      >
                        <Save className="h-3 w-3" />
                        {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
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
                      className="flex items-center gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
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
                  Date de création
                </Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(profile.created_at), 'PPP', { locale: fr })}
                </p>
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  Dernière mise à jour
                </Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(profile.updated_at), 'PPP', { locale: fr })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <Card>
          <CardHeader>
            <CardTitle>Statistiques du compte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {profile.subscription_type === 'premium' ? '∞' : '1'}
                </div>
                <p className="text-sm text-muted-foreground">Hôtels autorisés</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {profile.subscription_type === 'premium' ? '∞' : '50'}
                </div>
                <p className="text-sm text-muted-foreground">Chambres max</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {profile.subscription_type === 'premium' ? '∞' : '10'}
                </div>
                <p className="text-sm text-muted-foreground">Femmes de chambre max</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;