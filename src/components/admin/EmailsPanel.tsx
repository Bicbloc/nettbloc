import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, RefreshCw, Send, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  subject: string | null;
  status: string;
  error_message: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

interface SubAccount {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_name: string;
  invitation_status: string | null;
  parent_user_id: string;
  created_at: string;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'sent':
      return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15"><CheckCircle2 className="h-3 w-3 mr-1" />Envoyé</Badge>;
    case 'validated':
      return <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Validé</Badge>;
    case 'failed':
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Échec</Badge>;
    default:
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }
};

const invStatusBadge = (status: string | null) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">Inscrit</Badge>;
    case 'invited':
      return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">Invité</Badge>;
    default:
      return <Badge variant="secondary">{status || 'En attente'}</Badge>;
  }
};

export function EmailsPanel() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [logsRes, accRes] = await Promise.all([
      supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('sub_accounts')
        .select('id,email,first_name,last_name,role_name,invitation_status,parent_user_id,created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    if (logsRes.data) setLogs(logsRes.data as EmailLog[]);
    if (accRes.data) setAccounts(accRes.data as SubAccount[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resendInvitation = async (account: SubAccount) => {
    try {
      setSendingId(account.id);
      const { data: hotelData } = await supabase
        .from('hotels')
        .select('name')
        .eq('user_id', account.parent_user_id)
        .maybeSingle();

      const { error } = await supabase.functions.invoke('send-subaccount-invitation', {
        body: {
          subAccountId: account.id,
          email: account.email,
          firstName: account.first_name || '',
          lastName: account.last_name || '',
          roleName: account.role_name,
          hotelName: hotelData?.name || 'NettBloc',
        },
      });
      if (error) throw error;
      toast({ title: '📨 Invitation renvoyée', description: `Email envoyé à ${account.email}.` });
      loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message || "Échec de l'envoi." });
    } finally {
      setSendingId(null);
    }
  };

  const filteredLogs = logs.filter((l) => {
    const matchSearch = !search ||
      l.recipient_email.toLowerCase().includes(search.toLowerCase()) ||
      (l.subject || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: logs.length,
    sent: logs.filter((l) => l.status === 'sent' || l.status === 'validated').length,
    failed: logs.filter((l) => l.status === 'failed').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total emails</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{counts.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Envoyés / validés</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{counts.sent}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Échecs</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{counts.failed}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs"><Mail className="h-4 w-4 mr-2" />Journal des emails</TabsTrigger>
          <TabsTrigger value="invitations"><Send className="h-4 w-4 mr-2" />Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par email ou sujet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
                <SelectItem value="validated">Validé</SelectItem>
                <SelectItem value="failed">Échec</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun email</TableCell></TableRow>
                  ) : filteredLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(l.created_at).toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-sm">{l.email_type}</TableCell>
                      <TableCell className="text-sm">{l.recipient_email}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={l.subject || ''}>{l.subject}</TableCell>
                      <TableCell>
                        {statusBadge(l.status)}
                        {l.error_message && <p className="text-xs text-destructive mt-1 max-w-xs truncate" title={l.error_message}>{l.error_message}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun compte</TableCell></TableRow>
                  ) : accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell className="text-sm">{a.email}</TableCell>
                      <TableCell className="text-sm">{a.role_name}</TableCell>
                      <TableCell>{invStatusBadge(a.invitation_status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resendInvitation(a)}
                          disabled={sendingId === a.id}
                        >
                          {sendingId === a.id
                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                            : <><Send className="h-4 w-4 mr-1" />Renvoyer</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EmailsPanel;
