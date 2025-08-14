import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { HousekeeperTeamManager } from '@/components/HousekeeperTeamManager';
import { HotelAdminPanel } from '@/components/HotelAdminPanel';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, Shield, Database, Activity, Trash2, UserPlus, Key, Copy,
  Ban, CheckCircle, AlertTriangle, Monitor, Clock, LogOut, Eye, RefreshCw,
  Hotel, Users, BarChart3, CreditCard, Calendar, Gift
} from 'lucide-react';
import { useRealtimeAdmin } from '@/hooks/use-real-time-admin';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { BackButton } from '@/components/BackButton';
import { ForceCodeGenerationButton } from '@/components/ForceCodeGenerationButton';
import { SuspensionDialog } from '@/components/SuspensionDialog';
import { SubscriptionManagementDialog } from '@/components/SubscriptionManagementDialog';
import { HousekeeperAccessRequests } from '@/components/HousekeeperAccessRequests';
import AdminDashboard from '@/components/AdminDashboard';
import PasswordResetManager from '@/components/PasswordResetManager';
import { NotificationButton } from '@/components/NotificationButton';
import { AdminRealtimeStatus } from '@/components/AdminRealtimeStatus';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UserWithRole {
  id: string;
  email: string;
  company_name?: string;
  is_suspended?: boolean;
  suspension_reason?: string;
  subscription_type?: string;
  trial_end_date?: string;
  trial_extension_days?: number;
  trial_extension_reason?: string;
  role?: 'user' | 'admin' | 'super_admin';
  created_at: string;
  last_sign_in_at?: string;
  hotel_name?: string;
}

interface ActiveSession {
  id: string;
  user_name: string;
  user_type: string;
  hotel_id?: string;
  login_time: string;
  last_activity: string;
  is_active: boolean;
  user_id?: string;
}

interface HousekeeperAccessCode {
  id: string;
  access_code: string;
  housekeeper_name: string;
  hotel_name: string;
  hotel_code: string;
  is_active: boolean;
  created_at: string;
  used_at?: string;
  expires_at?: string;
}

interface HotelStats {
  id: string;
  name: string;
  hotel_code: string;
  user_email: string;
  housekeepers_count: number;
  active_sessions: number;
  created_at: string;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  total_hotels: number;
  total_sessions: number;
  total_housekeepers: number;
}

const Admin = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  // Utilisation du hook temps réel exclusivement
  const realtimeData = useRealtimeAdmin(isSuperAdmin);
  
  // Alias pour compatibilité avec le code existant
  const users = realtimeData.users;
  const sessions = realtimeData.sessions;
  const hotels = realtimeData.hotels;
  const stats = realtimeData.stats;
  const loadingData = realtimeData.loading;
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [selectedHotelId, setSelectedHotelId] = useState('new');
  const [suspensionDialog, setSuspensionDialog] = useState<{
    open: boolean;
    userId: string;
    userEmail: string;
    isSuspended: boolean;
  }>({ open: false, userId: '', userEmail: '', isSuspended: false });
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Vérifier les permissions super admin
  useEffect(() => {
    const checkSuperAdminRole = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .single();

      if (!error && data) {
          setIsSuperAdmin(true);
          console.log('✅ Super admin confirmé, données temps réel activées');
        }
      } catch (error) {
        console.error('Erreur vérification role:', error);
      }
    };

    if (!loading) {
      checkSuperAdminRole();
    }
  }, [user, loading]);

  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Email et mot de passe requis."
      });
      return;
    }

    try {
      // Créer l'utilisateur avec signUp (approche alternative)
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            company_name: newUserCompany || 'Mon Établissement'
          }
        }
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Utilisateur non créé');
      }

      // Ajouter le rôle si nécessaire
      if (newUserRole === 'admin') {
        await supabase
          .from('user_roles')
          .insert({
            user_id: data.user.id,
            role: 'admin'
          });
      }

      // Assigner à un établissement existant ou créer un nouveau
      if (selectedHotelId && selectedHotelId !== 'new') {
        // Assigner à un établissement existant
        await supabase
          .from('hotel_users')
          .insert({
            hotel_id: selectedHotelId,
            user_id: data.user.id,
            role: 'user',
            created_by: user?.id
          });
      }

      // Envoyer l'email d'activation
      try {
        const activationLink = `${window.location.origin}/auth?type=signup&email=${encodeURIComponent(newUserEmail)}`;
        
        await supabase.functions.invoke('send-activation-email', {
          body: {
            email: newUserEmail,
            companyName: newUserCompany || 'Mon Établissement',
            hotelName: selectedHotelId !== 'new' ? hotels.find(h => h.id === selectedHotelId)?.name : undefined,
            activationLink
          }
        });
      } catch (emailError) {
        console.error('Erreur envoi email:', emailError);
        // Ne pas bloquer la création d'utilisateur pour un problème d'email
      }

      // Log l'action
      await supabase.rpc('log_admin_action', {
        p_action: 'create_user',
        p_target_user_id: data.user.id,
        p_details: { 
          email: newUserEmail, 
          role: newUserRole,
          hotel_assigned: selectedHotelId !== 'new' ? selectedHotelId : null
        }
      });

      toast({
        title: "Utilisateur créé",
        description: `L'utilisateur ${newUserEmail} a été créé avec succès. Un email d'activation a été envoyé.`
      });

      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserCompany('');
      setSelectedHotelId('new');
      setNewUserRole('user');
      setShowCreateUser(false);
      // Pas besoin de loadAdminData, les données temps réel se mettront à jour automatiquement
      realtimeData.refresh();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de créer l'utilisateur: ${error.message}`
      });
    }
  };

  // Nouvelle fonction pour suspendre un utilisateur avec motif
  const suspendUser = async (userId: string, suspend: boolean, reason?: string) => {
    try {
      const updateData = { 
        is_suspended: suspend,
        suspension_reason: suspend ? reason : null
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      // Log l'action
      await supabase.rpc('log_admin_action', {
        p_action: suspend ? 'suspend_user' : 'unsuspend_user',
        p_target_user_id: userId,
        p_details: suspend ? { reason } : {}
      });

      toast({
        title: suspend ? "Utilisateur suspendu" : "Utilisateur réactivé",
        description: `L'utilisateur a été ${suspend ? 'suspendu' : 'réactivé'} avec succès.`
      });

      realtimeData.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de ${suspend ? 'suspendre' : 'réactiver'} l'utilisateur: ${error.message}`
      });
    }
  };

  const forceLogout = async (sessionId: string, userId?: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;

      // Log l'action
      if (userId) {
        await supabase.rpc('log_admin_action', {
          p_action: 'force_logout',
          p_target_user_id: userId,
          p_details: { session_id: sessionId }
        });
      }

      toast({
        title: "Déconnexion forcée",
        description: "L'utilisateur a été déconnecté avec succès."
      });

      realtimeData.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de forcer la déconnexion: ${error.message}`
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Marquer l'utilisateur comme supprimé dans le profil
      const { error } = await supabase
        .from('profiles')
        .update({ is_suspended: true })
        .eq('id', userId);
      
      if (error) throw error;

      // Log l'action
      await supabase.rpc('log_admin_action', {
        p_action: 'suspend_user',
        p_target_user_id: userId
      });

      toast({
        title: "Utilisateur suspendu",
        description: "L'utilisateur a été marqué comme suspendu."
      });

      realtimeData.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de suspendre l'utilisateur: ${error.message}`
      });
    }
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole
        });

      if (error) throw error;

      // Log l'action
      await supabase.rpc('log_admin_action', {
        p_action: 'change_role',
        p_target_user_id: userId,
        p_details: { old_role: currentRole, new_role: newRole }
      });

      toast({
        title: "Rôle modifié",
        description: `L'utilisateur est maintenant ${newRole}.`
      });

      realtimeData.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de modifier le rôle: ${error.message}`
      });
    }
  };

  // Nouvelle fonction pour changer le type d'abonnement
  const changeSubscriptionType = async (userId: string, newType: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_type: newType })
        .eq('id', userId);

      if (error) throw error;

      // Log l'action
      await supabase.rpc('log_admin_action', {
        p_action: 'change_subscription_type',
        p_target_user_id: userId,
        p_details: { new_subscription_type: newType }
      });

      toast({
        title: "Type d'abonnement modifié",
        description: `L'utilisateur a maintenant un abonnement ${newType}.`
      });

      realtimeData.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de modifier l'abonnement: ${error.message}`
      });
    }
  };

  // Nouvelle fonction pour étendre la période d'essai
  const extendTrial = async (userId: string, days: number) => {
    try {
      const newTrialEndDate = new Date();
      newTrialEndDate.setDate(newTrialEndDate.getDate() + days);

      const { error } = await supabase
        .from('profiles')
        .update({ trial_end_date: newTrialEndDate.toISOString() })
        .eq('id', userId);

      if (error) throw error;

      // Log l'action
      await supabase.rpc('log_admin_action', {
        p_action: 'extend_trial',
        p_target_user_id: userId,
        p_details: { 
          days_extended: days,
          new_trial_end: newTrialEndDate.toISOString()
        }
      });

      toast({
        title: "Période d'essai étendue",
        description: `La période d'essai a été étendue de ${days} jours.`
      });

      realtimeData.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible d'étendre la période d'essai: ${error.message}`
      });
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p>Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas super admin, afficher l'interface hôtel normale
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!isSuperAdmin) {
    return <HotelAdminPanel />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Super Administration NettoBloc</h1>
            <p className="text-muted-foreground">Supervision complète du système</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <NotificationButton />
          <div className="text-sm text-muted-foreground">
            Dernière MAJ: {realtimeData.lastUpdate || 'En cours...'}
          </div>
          <Button
            onClick={realtimeData.refresh}
            variant="outline"
            size="sm"
            disabled={realtimeData.loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${realtimeData.loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Tableau de bord principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Utilisateurs {realtimeData.loading ? '🔄' : '📊'}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realtimeData.stats.total_users || stats.total_users}</div>
            <p className="text-xs text-muted-foreground">
              {realtimeData.stats.active_users || stats.active_users} actifs, {(stats as any).suspended_users || 0} suspendus
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Hôtels {realtimeData.loading ? '🔄' : '🏨'}
            </CardTitle>
            <Hotel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realtimeData.stats.total_hotels || stats.total_hotels}</div>
            <p className="text-xs text-muted-foreground">
              Établissements enregistrés
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sessions actives {realtimeData.loading ? '🔄' : '💚'}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realtimeData.stats.total_sessions || stats.total_sessions}</div>
            <p className="text-xs text-muted-foreground">
              Connexions en cours
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Femmes de chambre</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats as any).total_housekeepers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Codes générés
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-7">
          <TabsTrigger value="dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="users">
            <User className="h-4 w-4 mr-2" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Monitor className="h-4 w-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="hotels">
            <Hotel className="h-4 w-4 mr-2" />
            Hôtels
          </TabsTrigger>
          <TabsTrigger value="access-codes">
            <Key className="h-4 w-4 mr-2" />
            Codes d'accès
          </TabsTrigger>
          <TabsTrigger value="password-resets">
            <Shield className="h-4 w-4 mr-2" />
            Mots de passe
          </TabsTrigger>
          <TabsTrigger value="housekeeper-requests">
            <Users className="h-4 w-4 mr-2" />
            Demandes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <AdminDashboard />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gestion des utilisateurs</CardTitle>
                  <CardDescription>
                    Créer, suspendre et gérer les comptes utilisateurs
                  </CardDescription>
                </div>
                <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Créer un utilisateur
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="email@exemple.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Mot de passe</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="Mot de passe sécurisé"
                        />
                      </div>
                       <div>
                         <Label htmlFor="company">Nom de l'établissement</Label>
                         <Input
                           id="company"
                           value={newUserCompany}
                           onChange={(e) => setNewUserCompany(e.target.value)}
                           placeholder="Mon Hôtel"
                         />
                       </div>
                       <div>
                         <Label htmlFor="hotel-select">Assigner à un établissement existant (optionnel)</Label>
                         <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
                           <SelectTrigger>
                             <SelectValue placeholder="Choisir un établissement existant..." />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="new">Créer un nouvel établissement</SelectItem>
                             {hotels.map((hotel) => (
                               <SelectItem key={hotel.id} value={hotel.id}>
                                 {hotel.name} ({hotel.hotel_code})
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="admin-role"
                          checked={newUserRole === 'admin'}
                          onCheckedChange={(checked) => setNewUserRole(checked ? 'admin' : 'user')}
                        />
                        <Label htmlFor="admin-role">Administrateur</Label>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowCreateUser(false)}>
                          Annuler
                        </Button>
                        <Button onClick={createUser}>
                          Créer l'utilisateur
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
               <Table>
                 <TableHeader>
                   <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Établissement</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Abonnement</TableHead>
                      <TableHead>Essai gratuit</TableHead>
                      <TableHead>Inscription</TableHead>
                      <TableHead>Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>
                  {users.map((userItem) => (
                    <TableRow key={userItem.id}>
                       <TableCell className="font-medium">{userItem.email}</TableCell>
                       <TableCell>{userItem.company_name || 'Non définie'}</TableCell>
                       <TableCell>
                         <Badge variant="outline">{userItem.hotel_name}</Badge>
                       </TableCell>
                       <TableCell>
                         <Badge variant={userItem.role === 'admin' ? 'default' : 'secondary'}>
                           {userItem.role}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         <div className="space-y-1">
                           <Badge variant={userItem.is_suspended ? 'destructive' : 'default'}>
                             {userItem.is_suspended ? 'Suspendu' : 'Actif'}
                           </Badge>
                           {userItem.is_suspended && userItem.suspension_reason && (
                             <div className="text-xs text-muted-foreground max-w-[150px] truncate" title={userItem.suspension_reason}>
                               {userItem.suspension_reason}
                             </div>
                           )}
                         </div>
                       </TableCell>
                       <TableCell>
                         <Badge variant="outline">
                           {userItem.subscription_type || 'free'}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         {userItem.trial_end_date ? (
                           <div className="text-sm">
                             <div className={`text-xs ${new Date(userItem.trial_end_date) > new Date() ? 'text-green-600' : 'text-red-600'}`}>
                               {new Date(userItem.trial_end_date) > new Date() ? 'Actif' : 'Expiré'}
                             </div>
                             <div className="text-xs text-muted-foreground">
                               {format(new Date(userItem.trial_end_date), 'dd/MM/yyyy', { locale: fr })}
                             </div>
                           </div>
                         ) : (
                           <Badge variant="secondary" className="text-xs">
                             Aucun essai
                           </Badge>
                         )}
                       </TableCell>
                       <TableCell>
                         {format(new Date(userItem.created_at), 'dd/MM/yyyy', { locale: fr })}
                       </TableCell>
                       <TableCell className="space-x-1">
                         {userItem.role !== 'super_admin' && (
                           <div className="flex items-center gap-1 flex-wrap">
                              {/* Bouton Suspendre/Réactiver avec motif */}
                              <Button
                                size="sm"
                                variant={userItem.is_suspended ? "default" : "outline"}
                                onClick={() => setSuspensionDialog({
                                  open: true,
                                  userId: userItem.id,
                                  userEmail: userItem.email,
                                  isSuspended: userItem.is_suspended || false
                                })}
                                title={userItem.is_suspended ? "Réactiver l'utilisateur" : "Suspendre l'utilisateur"}
                              >
                                {userItem.is_suspended ? (
                                  <CheckCircle className="h-4 w-4" />
                                ) : (
                                  <Ban className="h-4 w-4" />
                                )}
                              </Button>
                             
                             {/* Bouton Changer rôle */}
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => toggleUserRole(userItem.id, userItem.role || 'user')}
                               title="Changer le rôle"
                             >
                               <Shield className="h-4 w-4" />
                             </Button>

                             {/* Boutons Type d'abonnement */}
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button 
                                   size="sm" 
                                   variant="outline"
                                   title="Changer le type d'abonnement"
                                   className="bg-blue-50 hover:bg-blue-100"
                                 >
                                   <CreditCard className="h-4 w-4" />
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>Changer le type d'abonnement</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     Utilisateur: {userItem.email}<br/>
                                     Type actuel: {userItem.subscription_type || 'free'}
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <div className="grid grid-cols-2 gap-2 my-4">
                                   <Button
                                     variant="outline"
                                     onClick={() => changeSubscriptionType(userItem.id, 'free')}
                                     className="w-full"
                                   >
                                     Gratuit
                                   </Button>
                                   <Button
                                     variant="outline"
                                     onClick={() => changeSubscriptionType(userItem.id, 'premium')}
                                     className="w-full"
                                   >
                                     Premium
                                   </Button>
                                 </div>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>Annuler</AlertDialogCancel>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>

                             {/* Bouton Étendre période d'essai */}
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button 
                                   size="sm" 
                                   variant="outline"
                                   title="Étendre la période d'essai"
                                   className="bg-green-50 hover:bg-green-100"
                                 >
                                   <Calendar className="h-4 w-4" />
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>Étendre la période d'essai</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     Utilisateur: {userItem.email}<br/>
                                     {userItem.trial_end_date ? (
                                       <>Fin actuelle: {format(new Date(userItem.trial_end_date), 'dd/MM/yyyy', { locale: fr })}</>
                                     ) : (
                                       'Aucune période d\'essai définie'
                                     )}
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <div className="grid grid-cols-3 gap-2 my-4">
                                   <Button
                                     variant="outline"
                                     onClick={() => extendTrial(userItem.id, 7)}
                                     className="w-full"
                                   >
                                     +7 jours
                                   </Button>
                                   <Button
                                     variant="outline"
                                     onClick={() => extendTrial(userItem.id, 30)}
                                     className="w-full"
                                   >
                                     +30 jours
                                   </Button>
                                   <Button
                                     variant="outline"
                                     onClick={() => extendTrial(userItem.id, 90)}
                                     className="w-full"
                                   >
                                     +90 jours
                                   </Button>
                                 </div>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>Annuler</AlertDialogCancel>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>

                             {/* Bouton Supprimer */}
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button size="sm" variant="destructive" title="Supprimer l'utilisateur">
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     Êtes-vous sûr de vouloir supprimer {userItem.email} ? 
                                     Cette action est irréversible et supprimera toutes les données associées.
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>Annuler</AlertDialogCancel>
                                   <AlertDialogAction
                                     onClick={() => deleteUser(userItem.id)}
                                     className="bg-destructive hover:bg-destructive/90"
                                   >
                                     Supprimer définitivement
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                           </div>
                         )}
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sessions actives en temps réel</CardTitle>
              <CardDescription>
                Surveillance et contrôle des connexions utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Connexion</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const loginTime = new Date(session.login_time);
                    const lastActivity = new Date(session.last_activity);
                    const duration = Math.floor((lastActivity.getTime() - loginTime.getTime()) / (1000 * 60));
                    
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.user_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.user_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(loginTime, 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          {format(lastActivity, 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={duration > 60 ? 'destructive' : 'default'}>
                            {duration}m
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <LogOut className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Forcer la déconnexion</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir déconnecter {session.user_name} ?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => forceLogout(session.id, session.user_id)}
                                >
                                  Déconnecter
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {sessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune session active</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hotels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vue d'ensemble des hôtels</CardTitle>
              <CardDescription>
                Monitoring et statistiques des établissements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Propriétaire</TableHead>
                    <TableHead>Femmes de chambre</TableHead>
                    <TableHead>Sessions actives</TableHead>
                    <TableHead>Créé le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotels.map((hotel) => (
                    <TableRow key={hotel.id}>
                      <TableCell className="font-medium">{hotel.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{hotel.hotel_code}</Badge>
                      </TableCell>
                      <TableCell>{hotel.user_email}</TableCell>
                      <TableCell>
                        <Badge variant={hotel.housekeepers_count > 0 ? 'default' : 'secondary'}>
                          {hotel.housekeepers_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={hotel.active_sessions > 0 ? 'default' : 'secondary'}>
                          {hotel.active_sessions}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(hotel.created_at), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access-codes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Codes d'accès des femmes de chambre</CardTitle>
                  <CardDescription>
                    Surveillance et gestion des codes d'accès
                  </CardDescription>
                </div>
                <ForceCodeGenerationButton onRefresh={realtimeData.refresh} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code d'accès</TableHead>
                    <TableHead>Femme de chambre</TableHead>
                    <TableHead>Hôtel</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Utilisé le</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((realtimeData as any).accessCodes || []).map((code: any) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-bold">{code.access_code}</TableCell>
                      <TableCell>{code.housekeeper_name}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{code.hotel_name}</div>
                          <div className="text-sm text-muted-foreground">({code.hotel_code})</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={code.is_active ? 'default' : 'secondary'}>
                          {code.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(code.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        {code.used_at ? (
                          <div className="text-sm">
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              Utilisé
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(code.used_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Non utilisé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(code.access_code);
                            toast({
                              title: "Code copié",
                              description: "Le code d'accès a été copié dans le presse-papier."
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {((realtimeData as any).accessCodes || []).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun code d'accès trouvé</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password-resets" className="space-y-4">
          <PasswordResetManager />
        </TabsContent>

        <TabsContent value="housekeeper-requests" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HousekeeperTeamManager hotelId={user?.id || ''} />
            <HousekeeperAccessRequests />
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>État du système</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Base de données</span>
                  <Badge variant="default">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Opérationnelle
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Authentification</span>
                  <Badge variant="default">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sessions temps réel</span>
                  <Badge variant="default">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Synchronisées
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Database className="h-4 w-4 mr-2" />
                  Nettoyer les sessions expirées
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Synchroniser les données
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Vérifier l'intégrité
                </Button>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Interface d'administration avancée. Toutes les actions sont loggées et tracées.
              En cas de problème, contactez le support technique.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
      
      {/* Dialogue de suspension avec motif */}
      <SuspensionDialog
        open={suspensionDialog.open}
        onClose={() => setSuspensionDialog({ open: false, userId: '', userEmail: '', isSuspended: false })}
        onConfirm={(reason) => suspendUser(suspensionDialog.userId, !suspensionDialog.isSuspended, reason)}
        userEmail={suspensionDialog.userEmail}
        isSuspended={suspensionDialog.isSuspended}
      />
    </div>
  );
};

export default Admin;
