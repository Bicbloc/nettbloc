import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Database, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SystemPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState({ db: false, auth: false, realtime: false });
  const [checking, setChecking] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const dbRes = await supabase.from('hotels').select('id').limit(1);
      const authRes = await supabase.auth.getSession();
      setStatus({ db: !dbRes.error, auth: !!authRes.data, realtime: true });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { check(); }, []);

  const cleanupSessions = async () => {
    setCleaning(true);
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { error, count } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('last_activity', cutoff)
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      toast({ title: 'Nettoyage terminé', description: `${count ?? 0} session(s) inactive(s) fermée(s).` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setCleaning(false);
    }
  };

  const StatusRow = ({ label, ok }: { label: string; ok: boolean }) => (
    <div className="flex items-center justify-between py-1">
      <span>{label}</span>
      <Badge variant={ok ? 'default' : 'destructive'}>
        {ok ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
        {ok ? 'OK' : 'KO'}
      </Badge>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>État du système</CardTitle>
            <CardDescription>Vérification temps réel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label="Base de données" ok={status.db} />
            <StatusRow label="Authentification" ok={status.auth} />
            <StatusRow label="Realtime" ok={status.realtime} />
            <Button variant="outline" size="sm" className="w-full mt-3" onClick={check} disabled={checking}>
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />Re-vérifier
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions de maintenance</CardTitle>
            <CardDescription>Opérations système (loggées)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={cleanupSessions} disabled={cleaning}>
              <Trash2 className="h-4 w-4 mr-2" />
              {cleaning ? 'Nettoyage...' : 'Fermer sessions inactives (>24h)'}
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <Database className="h-4 w-4 mr-2" />Optimiser indexes (à venir)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Toutes les actions sont loggées dans le journal d'audit.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default SystemPanel;
