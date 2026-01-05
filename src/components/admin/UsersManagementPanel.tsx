import { useState, useEffect, useMemo } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  User, Shield, Trash2, UserPlus, Ban, CheckCircle, CreditCard, 
  Calendar, Search, RefreshCw, Crown, Star, Zap, Eye, Mail, Building,
  ArrowUpDown, Filter, Download, MoreHorizontal
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface UserWithRole {
  id: string;
  email: string;
  company_name?: string;
  is_suspended?: boolean;
  suspension_reason?: string;
  subscription_type?: string;
  plan?: string;
  trial_end_date?: string;
  trial_start_date?: string;
  max_rooms?: number;
  role?: 'user' | 'admin' | 'super_admin';
  created_at: string;
  hotel_name?: string;
  hotel_id?: string;
  features_enabled?: any;
}

interface HotelInfo {
  id: string;
  name: string;
  hotel_code: string;
}

const PLAN_CONFIGS = {
  free: { label: 'Gratuit', color: 'bg-gray-100 text-gray-700', icon: null },
  freemium: { label: 'Freemium', color: 'bg-gray-100 text-gray-700', icon: null },
  basic: { label: 'Basic', color: 'bg-blue-100 text-blue-700', icon: Zap },
  basic_plus: { label: 'Basic+', color: 'bg-blue-200 text-blue-800', icon: Zap },
  premium: { label: 'Premium', color: 'bg-amber-100 text-amber-700', icon: Star },
  platinum: { label: 'Platinum', color: 'bg-purple-100 text-purple-700', icon: Crown },
};

export function UsersManagementPanel() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [hotels, setHotels] = useState<HotelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'email' | 'plan'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserPlan, setNewUserPlan] = useState('free');
  const [selectedHotelId, setSelectedHotelId] = useState('new');
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadHotels();
  }, []);

  const loadHotels = async () => {
    const { data } = await supabase
      .from('hotels')
      .select('id, name, hotel_code');
    setHotels(data || []);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Charger les profils
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Charger les rôles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Charger les assignations hôtels
      const { data: hotelUsers } = await supabase
        .from('hotel_users')
        .select('user_id, hotel_id, hotels!inner(name)');

      // Combiner les données
      const enrichedUsers = (profiles || []).map(profile => ({
        ...profile,
        role: roles?.find(r => r.user_id === profile.id)?.role || 'user',
        hotel_name: hotelUsers?.find(hu => hu.user_id === profile.id)?.hotels?.name || 'Aucun',
        hotel_id: hotelUsers?.find(hu => hu.user_id === profile.id)?.hotel_id
      }));

      setUsers(enrichedUsers);
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
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        // Search filter
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          if (!user.email.toLowerCase().includes(search) &&
              !user.company_name?.toLowerCase().includes(search) &&
              !user.hotel_name?.toLowerCase().includes(search)) {
            return false;
          }
        }
        // Plan filter
        if (planFilter !== 'all' && user.subscription_type !== planFilter && user.plan !== planFilter) {
          return false;
        }
        // Status filter
        if (statusFilter === 'active' && user.is_suspended) return false;
        if (statusFilter === 'suspended' && !user.is_suspended) return false;
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'email') {
          comparison = a.email.localeCompare(b.email);
        } else if (sortBy === 'plan') {
          comparison = (a.subscription_type || '').localeCompare(b.subscription_type || '');
        } else {
          comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [users, searchTerm, planFilter, statusFilter, sortBy, sortOrder]);

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

  const getPlanBadge = (user: UserWithRole) => {
    const planKey = (user.subscription_type || user.plan || 'free') as keyof typeof PLAN_CONFIGS;
    const config = PLAN_CONFIGS[planKey] || PLAN_CONFIGS.free;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} gap-1`}>
        {Icon && <Icon className="h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  const getTrialStatus = (user: UserWithRole) => {
    if (!user.trial_end_date) return null;
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
      ['Email', 'Entreprise', 'Plan', 'Statut', 'Date inscription'].join(','),
      ...filteredUsers.map(u => [
        u.email,
        u.company_name || '',
        u.subscription_type || 'free',
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Gestion des Utilisateurs
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
                placeholder="Rechercher par email, entreprise..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="suspended">Suspendus</SelectItem>
            </SelectContent>
          </Select>
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
                <TableHead>Établissement</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSortBy('plan');
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center gap-1">
                    Plan
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Chargement...</TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun utilisateur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className={user.is_suspended ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.company_name || 'Non définie'}</div>
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
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{user.hotel_name}</span>
                      </div>
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
                      {user.role !== 'super_admin' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user);
                              setShowUserDetails(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir détails
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Changer le plan</DropdownMenuLabel>
                            {Object.entries(PLAN_CONFIGS).map(([key, config]) => (
                              <DropdownMenuItem 
                                key={key} 
                                onClick={() => changePlan(user.id, key)}
                                disabled={user.subscription_type === key || user.plan === key}
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
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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
                  <Label className="text-muted-foreground">Entreprise</Label>
                  <div className="font-medium">{selectedUser.company_name || 'Non définie'}</div>
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
                <div>
                  <Label className="text-muted-foreground">Établissement</Label>
                  <div>{selectedUser.hotel_name}</div>
                </div>
                {selectedUser.trial_end_date && (
                  <div>
                    <Label className="text-muted-foreground">Fin essai</Label>
                    <div>{format(new Date(selectedUser.trial_end_date), 'dd MMMM yyyy', { locale: fr })}</div>
                  </div>
                )}
                {selectedUser.max_rooms && (
                  <div>
                    <Label className="text-muted-foreground">Max chambres</Label>
                    <div>{selectedUser.max_rooms}</div>
                  </div>
                )}
              </div>
              
              {selectedUser.suspension_reason && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <Label className="text-destructive">Raison de suspension</Label>
                  <div className="text-sm">{selectedUser.suspension_reason}</div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowUserDetails(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
