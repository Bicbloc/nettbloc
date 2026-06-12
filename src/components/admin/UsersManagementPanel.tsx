import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { supabase } from '@/integrations/supabase/client';
import { PASSWORD_RESET_URL } from '@/constants/appUrl';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  User, Shield, Trash2, UserPlus, Ban, CheckCircle, CreditCard, 
  Calendar, Search, RefreshCw, Crown, Star, Zap, Eye, Mail, Building,
  ArrowUpDown, Filter, Download, MoreHorizontal, Hotel, Wrench, UserCheck,
  KeyRound, Users, Sparkles, LogIn
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface AllUser {
  id: string;
  email: string;
  name?: string | null;
  user_type: string;
  is_suspended?: boolean | null;
  subscription_type?: string | null;
  trial_end_date?: string | null;
  created_at: string;
  linked_hotel_id?: string | null;
  linked_hotel_name?: string | null;
  role?: string | null;
  ai_features_enabled?: boolean | null;
}

interface HotelInfo {
  id: string;
  name: string;
  hotel_code: string;
}

const PLAN_CONFIGS = {
  free: { label: 'Gratuit', color: 'bg-gray-100 text-gray-700', icon: null },
  decouverte: { label: 'Découverte', color: 'bg-gray-100 text-gray-700', icon: null },
  essentiel: { label: 'Essentiel', color: 'bg-blue-100 text-blue-700', icon: Zap },
  confort: { label: 'Confort', color: 'bg-blue-200 text-blue-800', icon: Zap },
  business: { label: 'Business', color: 'bg-amber-100 text-amber-700', icon: Star },
  entreprise: { label: 'Entreprise', color: 'bg-purple-100 text-purple-700', icon: Crown },
};

const USER_TYPE_CONFIGS = {
  establishment: { label: 'Établissement', icon: Building, color: 'bg-blue-100 text-blue-700' },
  housekeeper: { label: 'Femme de chambre', icon: User, color: 'bg-green-100 text-green-700' },
  technician: { label: 'Technicien', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
  governess: { label: 'Gouvernante', icon: UserCheck, color: 'bg-purple-100 text-purple-700' },
};

const PAGE_SIZE = 50;

interface UsersManagementPanelProps {
  /** Pre-filter and lock the panel to a single user type */
  defaultUserType?: string;
  /** Hide the user-type selector when locked to one role */
  lockUserType?: boolean;
  /** Optional custom heading */
  title?: string;
}

export function UsersManagementPanel({ defaultUserType, lockUserType, title }: UsersManagementPanelProps = {}) {
  const [users, setUsers] = useState<AllUser[]>([]);
  const [hotels, setHotels] = useState<HotelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<string>(defaultUserType ?? 'all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'email' | 'name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<AllUser | null>(null);
  const [selectedUserContact, setSelectedUserContact] = useState<{ phone?: string | null; name?: string | null } | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserPlan, setNewUserPlan] = useState('free');
  const [selectedHotelId, setSelectedHotelId] = useState('new');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadUsers();
    loadHotels();
  }, [currentPage, userTypeFilter, statusFilter]);

  const loadHotels = async () => {
    const { data } = await supabase
      .from('hotels')
      .select('id, name, hotel_code');
    setHotels(data || []);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Use the enriched all_users_view to get all user types in one query
      let query = supabase
        .from('all_users_view')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: sortOrder === 'asc' });

      // Apply filters
      if (userTypeFilter !== 'all') {
        query = query.eq('user_type', userTypeFilter);
      }
      if (statusFilter === 'active') {
        query = query.eq('is_suspended', false);
      } else if (statusFilter === 'suspended') {
        query = query.eq('is_suspended', true);
      }

      // Pagination
      query = query.range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      const { data: usersData, count, error } = await query;

      if (error) throw error;

      setUsers(usersData || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les utilisateurs."
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, userTypeFilter, statusFilter, sortOrder, toast]);

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        // Search filter (debounced)
        if (debouncedSearchTerm) {
          const search = debouncedSearchTerm.toLowerCase();
          if (!user.email.toLowerCase().includes(search) &&
              !user.name?.toLowerCase().includes(search) &&
              !user.linked_hotel_name?.toLowerCase().includes(search)) {
            return false;
          }
        }
        // Plan filter (only for establishments)
        if (planFilter !== 'all' && user.user_type === 'establishment' && user.subscription_type !== planFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'email') {
          comparison = a.email.localeCompare(b.email);
        } else if (sortBy === 'name') {
          comparison = (a.name || '').localeCompare(b.name || '');
        } else {
          comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [users, debouncedSearchTerm, planFilter, sortBy, sortOrder]);

  const changePlan = async (userId: string, newPlan: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_type: newPlan, plan: newPlan })
        .eq('id', userId);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action: 'change_subscription',
        p_target_user_id: userId,
        p_details: { new_plan: newPlan }
      });

      toast({ title: "Plan mis à jour", description: `Plan changé en ${newPlan}` });
      loadUsers();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: PASSWORD_RESET_URL
      });
      if (error) throw error;
      toast({ title: "Email envoyé", description: `Un lien de réinitialisation a été envoyé à ${email}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const [deletingUser, setDeletingUser] = useState<AllUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteUserCompletely = async (user: AllUser) => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Non authentifié');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userId: user.id, email: user.email }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || `Erreur ${response.status}`);
      }

      toast({
        title: "Utilisateur supprimé ✅",
        description: `${user.email} supprimé de : ${result.deleted_from?.join(', ') || 'aucune table'}`,
      });
      setDeletingUser(null);
      loadUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const [resettingUser, setResettingUser] = useState<AllUser | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const resetUserData = async (user: AllUser) => {
    setIsResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Non authentifié');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || `Erreur ${response.status}`);
      }

      toast({
        title: "Compte réinitialisé ✅",
        description: `Données effacées : ${result.cleared_from?.join(', ') || 'aucune donnée'}`,
      });
      setResettingUser(null);
      loadUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } finally {
      setIsResetting(false);
    }
  };

  const toggleSuspend = async (userId: string, suspend: boolean, reason?: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_suspended: suspend,
          suspension_reason: suspend ? reason : null 
        })
        .eq('id', userId);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action: suspend ? 'suspend_user' : 'unsuspend_user',
        p_target_user_id: userId,
        p_details: suspend ? { reason } : {}
      });

      toast({ 
        title: suspend ? "Utilisateur suspendu" : "Utilisateur réactivé" 
      });
      loadUsers();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const extendTrial = async (userId: string, days: number) => {
    try {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + days);

      const { error } = await supabase
        .from('profiles')
        .update({ trial_end_date: newDate.toISOString() })
        .eq('id', userId);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action: 'extend_trial',
        p_target_user_id: userId,
        p_details: { days_extended: days }
      });

      toast({ title: "Essai prolongé", description: `+${days} jours` });
      loadUsers();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const toggleAiFeatures = async (userId: string, enabled: boolean) => {
    try {
      const { error } = await supabase.rpc('admin_set_ai_features_enabled', {
        p_user_id: userId,
        p_enabled: enabled,
      });
      if (error) throw error;
      toast({
        title: enabled ? 'IA activée' : 'IA désactivée',
        description: `Comptage de linge IA et reconnaissance d'image ${enabled ? 'activés' : 'désactivés'} pour ce client`,
      });
      loadUsers();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    }
  };

  const impersonateUser = async (targetUser: AllUser) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Non authentifié');

      // Save current admin session
      const adminAccess = session.access_token;
      const adminRefresh = session.refresh_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-impersonate-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminAccess}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userId: targetUser.id }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Échec impersonation');

      // Use the magic link's hashed_token to create a session for the target user
      const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: result.hashed_token,
      });
      if (verifyErr || !verifyData.session) throw verifyErr || new Error('Session impossible');

      // Persist admin session for restoration
      localStorage.setItem('admin_impersonation', JSON.stringify({
        adminAccessToken: adminAccess,
        adminRefreshToken: adminRefresh,
        targetEmail: result.email,
        startedAt: Date.now(),
      }));

      toast({ title: 'Impersonation réussie', description: `Connecté en tant que ${result.email}` });
      window.location.href = '/';
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur impersonation', description: e.message });
    }
  };

  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({ variant: "destructive", title: "Erreur", description: "Email et mot de passe requis" });
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: { data: { company_name: newUserCompany || 'Mon Établissement' } }
      });

      if (error) throw error;
      if (!data.user) throw new Error('Utilisateur non créé');

      // Mettre à jour le plan
      if (newUserPlan !== 'free') {
        await supabase
          .from('profiles')
          .update({ subscription_type: newUserPlan, plan: newUserPlan })
          .eq('id', data.user.id);
      }

      toast({ title: "Utilisateur créé", description: newUserEmail });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserCompany('');
      setNewUserPlan('free');
      setShowCreateUser(false);
      loadUsers();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const getPlanBadge = (user: AllUser) => {
    if (user.user_type !== 'establishment') {
      return <Badge variant="outline">Staff</Badge>;
    }
    const planKey = (user.subscription_type || 'free') as keyof typeof PLAN_CONFIGS;
    const config = PLAN_CONFIGS[planKey] || PLAN_CONFIGS.free;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} gap-1`}>
        {Icon && <Icon className="h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  const getUserTypeBadge = (userType: string) => {
    const config = USER_TYPE_CONFIGS[userType as keyof typeof USER_TYPE_CONFIGS] || USER_TYPE_CONFIGS.establishment;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTrialStatus = (user: AllUser) => {
    if (!user.trial_end_date || user.user_type !== 'establishment') return null;
    const endDate = new Date(user.trial_end_date);
    const isActive = endDate > new Date();
    
    return (
      <div className={`text-xs ${isActive ? 'text-green-600' : 'text-red-600'}`}>
        {isActive ? 'Actif' : 'Expiré'} • {format(endDate, 'dd/MM/yyyy', { locale: fr })}
      </div>
    );
  };

  const exportUsers = () => {
    const csv = [
      ['Email', 'Nom', 'Type', 'Plan', 'Statut', 'Date inscription'].join(','),
      ...filteredUsers.map(u => [
        u.email,
        u.name || '',
        u.user_type,
        u.subscription_type || '-',
        u.is_suspended ? 'Suspendu' : 'Actif',
        format(new Date(u.created_at), 'yyyy-MM-dd')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const renderSkeletonRows = () => (
    Array.from({ length: 10 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-10 w-40" /></TableCell>
        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
      </TableRow>
    ))
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {title ?? 'Gestion des Utilisateurs'}
            </CardTitle>
            <CardDescription>
              {filteredUsers.length} utilisateur(s) • {users.filter(u => !u.is_suspended).length} actifs
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportUsers} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
            <Button onClick={loadUsers} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Créer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un utilisateur</DialogTitle>
                  <DialogDescription>Ajouter un nouvel utilisateur avec un plan spécifique</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div>
                    <Label>Mot de passe</Label>
                    <Input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Entreprise</Label>
                    <Input
                      value={newUserCompany}
                      onChange={(e) => setNewUserCompany(e.target.value)}
                      placeholder="Mon Hôtel"
                    />
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <Select value={newUserPlan} onValueChange={setNewUserPlan}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PLAN_CONFIGS).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateUser(false)}>Annuler</Button>
                    <Button onClick={createUser}>Créer</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par email, nom, hôtel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          {/* User Type Filter */}
          {!lockUserType && (
            <Select value={userTypeFilter} onValueChange={(v) => { setUserTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {Object.entries(USER_TYPE_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <config.icon className="h-4 w-4" />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Plan Filter (only for establishments) */}
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les plans</SelectItem>
              {Object.entries(PLAN_CONFIGS).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="suspended">Suspendus</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Stats by type */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Object.entries(USER_TYPE_CONFIGS).map(([key, config]) => {
            const count = users.filter(u => u.user_type === key).length;
            const Icon = config.icon;
            return (
              <Card 
                key={key} 
                className={`cursor-pointer transition-all ${userTypeFilter === key ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                onClick={() => setUserTypeFilter(userTypeFilter === key ? 'all' : key)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{config.label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Users Table */}
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSortBy('email');
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center gap-1">
                    Utilisateur
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Essai</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSortBy('created_at');
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center gap-1">
                    Inscription
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? renderSkeletonRows() : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun utilisateur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user, index) => (
                  <TableRow key={`${user.id}-${user.user_type}-${index}`} className={`hover:bg-muted/50 ${user.is_suspended ? 'opacity-60' : ''}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.name || 'Non défini'}</div>
                        </div>
                        {user.role === 'super_admin' && (
                          <Badge variant="destructive" className="text-xs">Super Admin</Badge>
                        )}
                        {user.role === 'admin' && (
                          <Badge variant="secondary" className="text-xs">Admin</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getUserTypeBadge(user.user_type)}
                    </TableCell>
                    <TableCell>{getPlanBadge(user)}</TableCell>
                    <TableCell>{getTrialStatus(user) || <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_suspended ? 'destructive' : 'default'}>
                        {user.is_suspended ? 'Suspendu' : 'Actif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: fr })}
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(user.created_at), { locale: fr, addSuffix: true })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem onClick={async () => {
                            setSelectedUser(user);
                            setSelectedUserContact(null);
                            setShowUserDetails(true);
                            const { data: contact } = await supabase
                              .from('profiles')
                              .select('billing_phone, billing_contact_name')
                              .eq('id', user.id)
                              .maybeSingle();
                            if (contact) {
                              setSelectedUserContact({
                                phone: (contact as any).billing_phone,
                                name: (contact as any).billing_contact_name,
                              });
                            }
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Voir détails
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => resetPassword(user.email)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Réinitialiser le mot de passe
                          </DropdownMenuItem>

                          {user.user_type === 'establishment' && user.role !== 'super_admin' && (
                            <>
                              <DropdownMenuItem onClick={() => impersonateUser(user)}>
                                <LogIn className="h-4 w-4 mr-2" />
                                Se connecter en tant que
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleAiFeatures(user.id, !(user.ai_features_enabled !== false))}
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                {user.ai_features_enabled === false ? 'Activer IA (linge + image)' : 'Désactiver IA (linge + image)'}
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {user.user_type === 'establishment' && user.role !== 'super_admin' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Changer le plan</DropdownMenuLabel>
                              {Object.entries(PLAN_CONFIGS).map(([key, config]) => (
                                <DropdownMenuItem 
                                  key={key} 
                                  onClick={() => changePlan(user.id, key)}
                                  disabled={user.subscription_type === key}
                                >
                                  {config.icon && <config.icon className="h-4 w-4 mr-2" />}
                                  {!config.icon && <CreditCard className="h-4 w-4 mr-2" />}
                                  {config.label}
                                </DropdownMenuItem>
                              ))}
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Période d'essai</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => extendTrial(user.id, 7)}>
                                <Calendar className="h-4 w-4 mr-2" />
                                +7 jours
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => extendTrial(user.id, 30)}>
                                <Calendar className="h-4 w-4 mr-2" />
                                +30 jours
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => extendTrial(user.id, 90)}>
                                <Calendar className="h-4 w-4 mr-2" />
                                +90 jours
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {user.role !== 'super_admin' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => toggleSuspend(user.id, !user.is_suspended)}
                                className={user.is_suspended ? 'text-green-600' : 'text-orange-600'}
                              >
                                {user.is_suspended ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Réactiver
                                  </>
                                ) : (
                                  <>
                                    <Ban className="h-4 w-4 mr-2" />
                                    Suspendre
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.user_type === 'establishment' && (
                                <DropdownMenuItem
                                  onClick={() => setResettingUser(user)}
                                  className="text-orange-600 focus:text-orange-600"
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Réinitialiser le compte
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setDeletingUser(user)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer complètement
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      {/* User Details Dialog */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de l'utilisateur</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="font-medium">{selectedUser.email}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nom</Label>
                  <div className="font-medium">{selectedUser.name || 'Non défini'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <div>{getUserTypeBadge(selectedUser.user_type)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Plan</Label>
                  <div>{getPlanBadge(selectedUser)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Statut</Label>
                  <Badge variant={selectedUser.is_suspended ? 'destructive' : 'default'}>
                    {selectedUser.is_suspended ? 'Suspendu' : 'Actif'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Inscription</Label>
                  <div>{format(new Date(selectedUser.created_at), 'dd MMMM yyyy', { locale: fr })}</div>
                </div>
                {selectedUser.trial_end_date && (
                  <div>
                    <Label className="text-muted-foreground">Fin essai</Label>
                    <div>{format(new Date(selectedUser.trial_end_date), 'dd MMMM yyyy', { locale: fr })}</div>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Contact de référence</Label>
                  <div className="font-medium">{selectedUserContact?.name || 'Non défini'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Téléphone</Label>
                  <div className="font-medium">
                    {selectedUserContact?.phone ? (
                      <a href={`tel:${selectedUserContact.phone}`} className="text-primary hover:underline">
                        {selectedUserContact.phone}
                      </a>
                    ) : 'Non défini'}
                  </div>
                </div>
              </div>


              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowUserDetails(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Suppression complète</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Vous êtes sur le point de supprimer <strong>{deletingUser?.email}</strong> ({deletingUser?.user_type}).</p>
              <p>Cela supprimera :</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Le compte d'authentification</li>
                <li>Le profil utilisateur</li>
                <li>Les hôtels associés (si établissement)</li>
                <li>Les profils staff (femme de chambre, gouvernante, technicien)</li>
                <li>Les sessions et données liées</li>
              </ul>
              <p className="font-semibold text-destructive">Cette action est irréversible !</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteUserCompletely(deletingUser)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Account Confirmation Dialog */}
      <AlertDialog open={!!resettingUser} onOpenChange={(open) => !open && setResettingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-600">⚠️ Réinitialisation du compte</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Vous êtes sur le point de réinitialiser le compte de <strong>{resettingUser?.email}</strong>.</p>
              <p>Le compte et les hôtels seront conservés, mais toutes les données suivantes seront <strong>définitivement effacées</strong> :</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Chambres, affectations et registre des chambres</li>
                <li>Données PMS (en attente, file de synchro, prévisions)</li>
                <li>Journaux, rapports et instructions quotidiennes</li>
                <li>Tâches, incidents, objets trouvés et notifications</li>
                <li>Inventaires et livraisons de linge</li>
              </ul>
              <p className="font-semibold text-orange-600">Attention : cette action est irréversible !</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resettingUser && resetUserData(resettingUser)}
              disabled={isResetting}
              className="bg-orange-600 text-white hover:bg-orange-600/90"
            >
              {isResetting ? 'Réinitialisation...' : 'Réinitialiser'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
