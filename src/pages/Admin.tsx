import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { User, Shield, Database, Activity, Trash2, UserPlus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface UserWithRole {
  id: string;
  email: string;
  company_name?: string;
  role?: 'user' | 'admin' | 'super_admin';
  created_at: string;
  last_sign_in_at?: string;
}

interface ActiveSession {
  id: string;
  user_name: string;
  user_type: string;
  hotel_id?: string;
  login_time: string;
  last_activity: string;
  is_active: boolean;
}

const Admin = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');

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
          await loadAdminData();
        }
      } catch (error) {
        console.error('Erreur vérification role:', error);
      } finally {
        setLoadingData(false);
      }
    };

    if (!loading) {
      checkSuperAdminRole();
    }
  }, [user, loading]);

  const loadAdminData = async () => {
    try {
      // Charger les utilisateurs avec leurs rôles
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          company_name,
          created_at
        `);

      if (usersError) throw usersError;

      // Charger les rôles des utilisateurs
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combiner les données
      const usersWithRoles = usersData?.map(user => ({
        ...user,
        role: rolesData?.find(role => role.user_id === user.id)?.role || 'user'
      })) || [];

      setUsers(usersWithRoles);

      // Charger les sessions actives
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);

    } catch (error) {
      console.error('Erreur chargement données admin:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les données d'administration."
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Supprimer l'utilisateur via l'API Supabase Admin (nécessite des permissions spéciales)
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) throw error;

      toast({
        title: "Utilisateur supprimé",
        description: "L'utilisateur a été supprimé avec succès."
      });

      await loadAdminData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Impossible de supprimer l'utilisateur: ${error.message}`
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

  if (!user || !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Administration NettoBloc</h1>
          <p className="text-muted-foreground">Gestion des utilisateurs et sessions</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <User className="h-4 w-4 mr-2" />
            Utilisateurs ({users.length})
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Activity className="h-4 w-4 mr-2" />
            Sessions actives ({sessions.length})
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Database className="h-4 w-4 mr-2" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des utilisateurs</CardTitle>
              <CardDescription>
                Gérer les utilisateurs, leurs rôles et permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Rôle</TableHead>
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
                        <Badge variant={userItem.role === 'admin' ? 'default' : 'secondary'}>
                          {userItem.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(userItem.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="space-x-2">
                        {userItem.role !== 'super_admin' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleUserRole(userItem.id, userItem.role || 'user')}
                            >
                              {userItem.role === 'admin' ? 'Retirer admin' : 'Promouvoir admin'}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir supprimer {userItem.email} ? 
                                    Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser(userItem.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
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
              <CardTitle>Sessions actives</CardTitle>
              <CardDescription>
                Surveillance des connexions en temps réel
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
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.user_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{session.user_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(session.login_time).toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        {new Date(session.last_activity).toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.is_active ? 'default' : 'secondary'}>
                          {session.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Utilisateurs totaux</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{users.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Administrateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Sessions actives</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sessions.length}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;