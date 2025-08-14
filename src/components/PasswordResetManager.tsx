import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Search, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PasswordResetLog {
  id: string;
  email: string;
  user_id?: string;
  request_ip?: string | null;
  requested_at: string;
  status: 'pending' | 'completed' | 'expired';
  completed_at?: string | null;
  user_agent?: string | null;
}

const PasswordResetManager = () => {
  const [logs, setLogs] = useState<PasswordResetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadPasswordResetLogs();
  }, []);

  const loadPasswordResetLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('password_reset_logs')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      setLogs((data || []) as PasswordResetLog[]);
    } catch (error: any) {
      console.error('Error loading password reset logs:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les logs de réinitialisation."
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsCompleted = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('password_reset_logs')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', logId);

      if (error) {
        throw error;
      }

      await loadPasswordResetLogs();
      toast({
        title: "Succès",
        description: "Log marqué comme complété."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour le log."
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Complété</Badge>;
      case 'expired':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expiré</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
  };

  const filteredLogs = logs.filter(log => 
    log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.request_ip?.includes(searchTerm)
  );

  const stats = {
    total: logs.length,
    pending: logs.filter(l => l.status === 'pending').length,
    completed: logs.filter(l => l.status === 'completed').length,
    last24h: logs.filter(l => new Date(l.requested_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Demandes totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Non traitées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Complétées</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Réussies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last24h}</div>
            <p className="text-xs text-muted-foreground">Dernières 24h</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Réinitialisation de Mot de Passe</CardTitle>
          <CardDescription>
            Historique des demandes de réinitialisation de mot de passe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par email, IP ou ID utilisateur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={loadPasswordResetLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date demande</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>User Agent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                    </TableRow>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun log trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.email}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        {format(new Date(log.requested_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.request_ip || '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs" title={log.user_agent}>
                        {log.user_agent ? log.user_agent.substring(0, 50) + '...' : '-'}
                      </TableCell>
                      <TableCell>
                        {log.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsCompleted(log.id)}
                          >
                            Marquer complété
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordResetManager;