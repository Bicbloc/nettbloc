import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { HousekeeperTeamManager } from '@/components/HousekeeperTeamManager';

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
  Hotel, Users, BarChart3, CreditCard, Calendar, Gift, Bell, FileText, Smartphone
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import BackButton from '@/components/BackButton';
import { NotificationBell } from '@/components/NotificationBell';
import { ForceCodeGenerationButton } from '@/components/ForceCodeGenerationButton';
import { SuspensionDialog } from '@/components/SuspensionDialog';
import { SubscriptionManagementDialog } from '@/components/SubscriptionManagementDialog';
import { HousekeeperAccessRequests } from '@/components/HousekeeperAccessRequests';
import { SessionsManagementPanel } from '@/components/SessionsManagementPanel';
import AdminBannersPanel from '@/components/admin/AdminBannersPanel';
import { AuditLogPanel } from '@/components/AuditLogPanel';
import { EnhancedAuditLogPanel } from '@/components/admin/EnhancedAuditLogPanel';
import { UsersManagementPanel } from '@/components/admin/UsersManagementPanel';
import { ReportTrainingPanel } from '@/components/ReportTrainingPanel';
import { IncidentList } from '@/components/incident/IncidentList';
import { StaffManagement } from '@/components/incident/StaffManagement';
import { IncidentInventoryManager } from '@/components/incident/IncidentInventoryManager';
import { IncidentReportDialog } from '@/components/incident/IncidentReportDialog';
import { RolePermissionsManager } from '@/components/incident/RolePermissionsManager';
import { SupportTicketsPanel } from '@/components/admin/SupportTicketsPanel';
import { PromoCodesPanel } from '@/components/admin/PromoCodesPanel';
import { PricingPlansPanel } from '@/components/admin/PricingPlansPanel';
import { LegalPagesPanel } from '@/components/admin/LegalPagesPanel';
import { PhoneOrdersPanel } from '@/components/admin/PhoneOrdersPanel';
import { InvoicesPanel } from '@/components/admin/InvoicesPanel';
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
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [accessCodes, setAccessCodes] = useState<HousekeeperAccessCode[]>([]);
  const [hotels, setHotels] = useState<HotelStats[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    active_users: 0,
    suspended_users: 0,
    total_hotels: 0,
    total_sessions: 0,
    total_housekeepers: 0
  });
  const [loadingData, setLoadingData] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [selectedHotelId, setSelectedHotelId] = useState('new');
  const [selectedTrainingHotelId, setSelectedTrainingHotelId] = useState<string>('');
  const [suspensionDialog, setSuspensionDialog] = useState<{
    open: boolean;
    userId: string;
    userEmail: string;
    isSuspended: boolean;
  }>({ open: false, userId: '', userEmail: '', isSuspended: false });
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Initialiser l'hôtel de training quand les hotels sont chargés
  useEffect(() => {
    if (hotels.length > 0 && !selectedTrainingHotelId) {
      setSelectedTrainingHotelId(hotels[0].id);
    }
  }, [hotels, selectedTrainingHotelId]);
  
  
  // Vérifier les permissions super admin
  useEffect(() => {
    let isActive = true;

    const resetPermissionState = (isLoading: boolean) => {
      if (!isActive) return;
      setIsSuperAdmin(false);
      setCheckedUserId(null);
      setLoadingData(isLoading);
    };

    const checkSuperAdminRole = async () => {
      if (!user) {
        resetPermissionState(false);
        return;
      }

      resetPermissionState(true);

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .maybeSingle();

        if (!isActive) {
          return;
        }

        const hasSuperAdminRole = !error && !!data;
        setIsSuperAdmin(hasSuperAdminRole);
        setCheckedUserId(user.id);

        if (hasSuperAdminRole) {
          setLoadingData(false); // Afficher l'UI immédiatement
          // Charger les données en arrière-plan de façon optimisée
          loadAdminDataOptimized();
        } else {
          setLoadingData(false);
        }
      } catch (error) {
        console.error('Erreur vérification role:', error);
        if (!isActive) {
          return;
        }
        setIsSuperAdmin(false);
        setCheckedUserId(user.id);
        setLoadingData(false);
      }
    };

    if (loading) {
      resetPermissionState(true);
      return () => {
        isActive = false;
      };
    }

    checkSuperAdminRole();

    return () => {
      isActive = false;
    };
  }, [user?.id, loading]);

  // Chargement optimisé: hôtels d'abord (pour l'entraînement IA), puis le reste
  const loadAdminDataOptimized = async () => {
    try {
      
      // 1. Charger les hôtels en PREMIER (critique pour l'entraînement IA)
      const { data: hotelsData, error: hotelsError } = await supabase
        .from('hotels')
        .select('id, name, hotel_code, created_at, user_id');

      if (!hotelsError && hotelsData) {
        // Afficher les hôtels immédiatement sans attendre les stats
        const basicHotels = hotelsData.map(hotel => ({
          id: hotel.id,
          name: hotel.name,
          hotel_code: hotel.hotel_code || '',
          user_email: 'Chargement...',
          housekeepers_count: 0,
          active_sessions: 0,
          created_at: hotel.created_at
        }));
        setHotels(basicHotels);
      }

      // 2. Charger le reste des données en parallèle
      loadAdminData();
    } catch (error) {
      console.error('Erreur chargement optimisé:', error);
      // Fallback au chargement complet
      loadAdminData();
    }
  };

  const loadAdminData = async () => {
    try {
      
      // Vérifier d'abord si l'utilisateur a vraiment les permissions super_admin
      const { data: currentUserRoles, error: roleCheckError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      if (roleCheckError) {
        console.error('❌ Erreur vérification permissions:', roleCheckError);
        throw new Error('Impossible de vérifier les permissions');
      }

      const hasSupeAdminRole = currentUserRoles?.some(r => r.role === 'super_admin');
      if (!hasSupeAdminRole) {
        console.error('❌ Utilisateur sans permissions super_admin');
        throw new Error('Permissions insuffisantes');
      }


      // Charger les utilisateurs avec leurs rôles et profils
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          company_name,
          is_suspended,
          suspension_reason,
          subscription_type,
          trial_end_date,
          created_at
        `);

      if (usersError) {
        console.error('❌ Erreur chargement profils:', usersError);
        throw usersError;
      }

      // Charger les rôles des utilisateurs
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Charger les hôtels assignés aux utilisateurs
      const { data: hotelUsersData, error: hotelUsersError } = await supabase
        .from('hotel_users')
        .select(`
          user_id,
          role,
          hotels!inner(name)
        `);

      if (hotelUsersError) throw hotelUsersError;

      // Combiner les données et trier par date d'inscription (plus récent d'abord)
      const usersWithRoles = usersData?.map(user => ({
        ...user,
        role: rolesData?.find(role => role.user_id === user.id)?.role || 'user',
        hotel_name: hotelUsersData?.find(hu => hu.user_id === user.id)?.hotels?.name || 'Aucun'
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];

      setUsers(usersWithRoles);

      // Charger les sessions actives
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);

      // Charger les codes d'accès des femmes de chambre (sans jointures problématiques)
      const { data: accessCodesData, error: accessCodesError } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          id,
          access_code,
          is_active,
          created_at,
          used_at,
          expires_at,
          hotel_id,
          housekeeper_id
        `)
        .order('created_at', { ascending: false });

      if (accessCodesError) throw accessCodesError;

      // Enrichir les codes d'accès avec les noms (requêtes séparées pour éviter les problèmes de jointures)
      const enrichedAccessCodes = await Promise.all(
        (accessCodesData || []).map(async (code) => {
          // Récupérer le nom de l'hôtel
          const { data: hotelData } = await supabase
            .from('hotels')
            .select('name, hotel_code')
            .eq('id', code.hotel_id)
            .single();

          // Récupérer le nom de la femme de chambre si assignée
          let housekeeperName = 'Non assigné';
          if (code.housekeeper_id) {
            const { data: housekeeperData } = await supabase
              .from('housekeepers')
              .select('name')
              .eq('id', code.housekeeper_id)
              .single();
            
            if (housekeeperData) {
              housekeeperName = housekeeperData.name;
            }
          }

          return {
            id: code.id,
            access_code: code.access_code,
            housekeeper_name: housekeeperName,
            hotel_name: hotelData?.name || 'Inconnu',
            hotel_code: hotelData?.hotel_code || '',
            is_active: code.is_active,
            created_at: code.created_at,
            used_at: code.used_at,
            expires_at: code.expires_at
          };
        })
      );

      setAccessCodes(enrichedAccessCodes);

      // Charger les statistiques des hôtels
      const { data: hotelsData, error: hotelsError } = await supabase
        .from('hotels')
        .select(`
          id,
          name,
          hotel_code,
          created_at,
          user_id
        `);

      if (hotelsError) throw hotelsError;

      // Calculer les statistiques pour chaque hôtel avec l'email du propriétaire
      const hotelsWithStats = await Promise.all(
        (hotelsData || []).map(async (hotel) => {
          // Récupérer l'email du propriétaire
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', hotel.user_id)
            .single();

          const { data: housekeepersCount } = await supabase
            .from('housekeepers')
            .select('id', { count: 'exact' })
            .eq('hotel_id', hotel.id)
            .eq('is_active', true);

          const { data: activeSessionsCount } = await supabase
            .from('user_sessions')
            .select('id', { count: 'exact' })
            .eq('hotel_id', hotel.id)
            .eq('is_active', true);

          return {
            id: hotel.id,
            name: hotel.name,
            hotel_code: hotel.hotel_code || '',
            user_email: ownerProfile?.email || 'Email inconnu',
            housekeepers_count: housekeepersCount?.length || 0,
            active_sessions: activeSessionsCount?.length || 0,
            created_at: hotel.created_at
          };
        })
      );

      setHotels(hotelsWithStats);

      // Calculer les statistiques globales
      const newStats: AdminStats = {
        total_users: usersWithRoles.length,
        active_users: usersWithRoles.filter(u => !u.is_suspended).length,
        suspended_users: usersWithRoles.filter(u => u.is_suspended).length,
        total_hotels: hotelsWithStats.length,
        total_sessions: sessionsData?.length || 0,
        total_housekeepers: enrichedAccessCodes.length
      };

      setStats(newStats);

    } catch (error) {
      console.error('Erreur chargement données admin:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les données d'administration."
      });
    }
  };

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
      await loadAdminData();

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

      await loadAdminData();
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

      await loadAdminData();
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

      await loadAdminData();
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

      await loadAdminData();
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

      await loadAdminData();
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

      await loadAdminData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible d'étendre la période d'essai: ${error.message}`
      });
    }
  };

  const isPermissionCheckPending = !!user && checkedUserId !== user.id;

  if (loading || loadingData || isPermissionCheckPending) {
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
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Seuls les super administrateurs peuvent accéder à cette page.</p>
        </CardContent>
      </Card>
    );
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
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button onClick={loadAdminData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Tableau de bord principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs totaux</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_users}</div>
            <p className="text-xs text-muted-foreground">
              {stats.suspended_users} suspendus
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hôtels actifs</CardTitle>
            <Hotel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_hotels}</div>
            <p className="text-xs text-muted-foreground">
              Établissements enregistrés
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions actives</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_sessions}</div>
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
            <div className="text-2xl font-bold">{stats.total_housekeepers}</div>
            <p className="text-xs text-muted-foreground">
              Codes générés
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        {/* Navigation par catégories */}
        <div className="space-y-3">
          {/* Catégorie: Utilisateurs & Accès */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Utilisateurs & Accès</p>
            <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
              <TabsTrigger value="users" className="gap-2">
                <User className="h-4 w-4" />
                Utilisateurs
              </TabsTrigger>
              <TabsTrigger value="sessions" className="gap-2">
                <Monitor className="h-4 w-4" />
                Sessions
              </TabsTrigger>
              <TabsTrigger value="access-codes" className="gap-2">
                <Key className="h-4 w-4" />
                Codes d'accès
              </TabsTrigger>
              <TabsTrigger value="housekeeper-requests" className="gap-2 relative">
                <Users className="h-4 w-4" />
                Demandes
                <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">!</Badge>
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Catégorie: Établissements */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Établissements</p>
            <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
              <TabsTrigger value="hotels" className="gap-2">
                <Hotel className="h-4 w-4" />
                Hôtels
              </TabsTrigger>
              <TabsTrigger value="incidents" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incidents
              </TabsTrigger>
              <TabsTrigger value="training" className="gap-2">
                <Database className="h-4 w-4" />
                IA Training
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Catégorie: Abonnements & Facturation */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Abonnements & Facturation</p>
            <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
              <TabsTrigger value="plans" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Plans & Tarifs
              </TabsTrigger>
              <TabsTrigger value="promos" className="gap-2">
                <Gift className="h-4 w-4" />
                Codes promo
              </TabsTrigger>
              <TabsTrigger value="phone-orders" className="gap-2">
                <Smartphone className="h-4 w-4" />
                Téléphones
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2">
                <FileText className="h-4 w-4" />
                Factures
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Catégorie: Support & Système */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Support & Système</p>
            <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
              <TabsTrigger value="tickets" className="gap-2">
                <Bell className="h-4 w-4" />
                Tickets
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <Activity className="h-4 w-4" />
                Journal d'audit
              </TabsTrigger>
              <TabsTrigger value="legal" className="gap-2">
                <FileText className="h-4 w-4" />
                Pages légales
              </TabsTrigger>
              <TabsTrigger value="banners" className="gap-2">
                <Megaphone className="h-4 w-4" />
                Bannières
              </TabsTrigger>
              <TabsTrigger value="system" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Système
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="users" className="space-y-4">
          <UsersManagementPanel />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <SessionsManagementPanel />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <EnhancedAuditLogPanel />
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
                <ForceCodeGenerationButton onRefresh={loadAdminData} />
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
                  {accessCodes.map((code) => (
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
              
              {accessCodes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun code d'accès trouvé</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="housekeeper-requests" className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <Bell className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Comment ça marche ?</strong> Les femmes de chambre créent un compte et soumettent une demande avec votre code d'hôtel. 
              Vous recevez une notification et pouvez <strong>valider</strong> ou <strong>suspendre</strong> leur accès.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 gap-6">
            <HousekeeperAccessRequests />
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Gestion des incidents</h2>
              <p className="text-muted-foreground">Gérer les incidents, le personnel et l'inventaire</p>
            </div>
            {hotels.length > 0 && (
              <IncidentReportDialog hotelId={hotels[0].id} userType="admin" />
            )}
          </div>

          <Tabs defaultValue="incidents" className="space-y-4">
            <TabsList>
              <TabsTrigger value="incidents">Liste des incidents</TabsTrigger>
              <TabsTrigger value="staff">Personnel</TabsTrigger>
              <TabsTrigger value="inventory">Inventaire</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
            </TabsList>

            <TabsContent value="incidents" className="space-y-4">
              {hotels.length > 0 ? (
                <IncidentList hotelId={hotels[0].id} />
              ) : (
                <Alert>
                  <AlertDescription>Aucun hôtel disponible pour gérer les incidents</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="staff" className="space-y-4">
              {hotels.length > 0 ? (
                <StaffManagement hotelId={hotels[0].id} />
              ) : (
                <Alert>
                  <AlertDescription>Aucun hôtel disponible pour gérer le personnel</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              {hotels.length > 0 ? (
                <IncidentInventoryManager hotelId={hotels[0].id} />
              ) : (
                <Alert>
                  <AlertDescription>Aucun hôtel disponible pour gérer l'inventaire</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              {hotels.length > 0 ? (
                <RolePermissionsManager hotelId={hotels[0].id} />
              ) : (
                <Alert>
                  <AlertDescription>Aucun hôtel disponible pour gérer les permissions</AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
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

        <TabsContent value="training" className="space-y-6">
          {hotels.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <Label htmlFor="training-hotel" className="font-medium whitespace-nowrap">
                  Sélectionner l'hôtel :
                </Label>
                <Select value={selectedTrainingHotelId} onValueChange={setSelectedTrainingHotelId}>
                  <SelectTrigger id="training-hotel" className="w-64 bg-background">
                    <SelectValue placeholder="Choisir un hôtel" />
                  </SelectTrigger>
                  <SelectContent>
                    {hotels.map(hotel => (
                      <SelectItem key={hotel.id} value={hotel.id}>
                        {hotel.name} ({hotel.hotel_code || 'Sans code'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTrainingHotelId ? (
                <ReportTrainingPanel hotelId={selectedTrainingHotelId} />
              ) : (
                <Alert>
                  <AlertDescription>Veuillez sélectionner un hôtel pour accéder à l'entraînement IA</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Aucun hôtel disponible pour l'entraînement IA</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <PricingPlansPanel />
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <SupportTicketsPanel />
        </TabsContent>

        <TabsContent value="promos" className="space-y-4">
          <PromoCodesPanel />
        </TabsContent>

        <TabsContent value="phone-orders" className="space-y-4">
          <PhoneOrdersPanel />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <InvoicesPanel />
        </TabsContent>

        <TabsContent value="legal" className="space-y-4">
          <LegalPagesPanel />
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