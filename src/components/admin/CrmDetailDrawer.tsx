import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Euro, FileText, Clock, Mail, Phone, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  hotelId: string | null;
  userId: string | null;
  onClose: () => void;
}

const fmtEur = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

export function CrmDetailDrawer({ hotelId, userId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [hotel, setHotel] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [firstLogin, setFirstLogin] = useState<string | null>(null);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [subAccounts, setSubAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (!hotelId) return;
    setLoading(true);
    (async () => {
      const hotelRes = await supabase.from('hotels').select('*').eq('id', hotelId).maybeSingle();
      const uid = userId || hotelRes.data?.user_id;
      const profRes = uid
        ? await supabase.from('profiles')
            .select('email, company_name, billing_contact_name, billing_contact_email, billing_company_name, subscription_type, trial_end_date, created_at')
            .eq('id', uid).maybeSingle()
        : { data: null };
      const invRes = await supabase.from('invoices')
        .select('id, invoice_number, invoice_date, amount_ttc, plan_name, status')
        .or(`hotel_id.eq.${hotelId}${uid ? `,user_id.eq.${uid}` : ''}`)
        .order('invoice_date', { ascending: false });
      const firstRes = await supabase.from('user_sessions')
        .select('login_time').eq('hotel_id', hotelId).order('login_time', { ascending: true }).limit(1).maybeSingle();
      const lastRes = await supabase.from('user_sessions')
        .select('last_activity').eq('hotel_id', hotelId).order('last_activity', { ascending: false }).limit(1).maybeSingle();
      const subRes = await supabase.from('sub_accounts')
        .select('first_name, last_name, email, role_name, is_active, last_login_at').eq('hotel_id', hotelId);

      setHotel(hotelRes.data);
      setProfile(profRes.data);
      setInvoices((invRes.data as any[]) || []);
      setFirstLogin((firstRes.data as any)?.login_time || null);
      setLastLogin((lastRes.data as any)?.last_activity || null);
      setSubAccounts((subRes.data as any[]) || []);
      setLoading(false);
    })();
  }, [hotelId, userId]);

  const totalSpent = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount_ttc || 0), 0);

  return (
    <Sheet open={!!hotelId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading ? (
          <div className="space-y-4 py-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {hotel?.name || 'Client'}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">Code {hotel?.hotel_code || '—'}</Badge>
                <Badge variant="secondary">{profile?.subscription_type || 'trial'}</Badge>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              {/* Contact */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Contact</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Nom & prénom :</span> {profile?.billing_contact_name || '—'}</div>
                  <div><span className="text-muted-foreground">Société :</span> {profile?.billing_company_name || profile?.company_name || '—'}</div>
                  <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" />{profile?.billing_contact_email || profile?.email || '—'}</div>
                  <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{hotel?.phone || '—'}</div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatCard icon={Euro} label="Total dépensé" value={fmtEur(totalSpent)} />
                <StatCard icon={FileText} label="Factures" value={String(invoices.length)} />
                <StatCard icon={Clock} label="1ère connexion" value={firstLogin ? format(new Date(firstLogin), 'dd/MM/yy', { locale: fr }) : '—'} />
              </div>
              <div className="text-xs text-muted-foreground">
                Dernière activité : {lastLogin ? format(new Date(lastLogin), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                {profile?.created_at && <> · Compte créé le {format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: fr })}</>}
              </div>

              {/* Invoices */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Factures ({invoices.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-72 overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>N°</TableHead><TableHead>Date</TableHead><TableHead>Plan</TableHead>
                        <TableHead className="text-right">TTC</TableHead><TableHead>Statut</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {invoices.map(i => (
                          <TableRow key={i.id}>
                            <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                            <TableCell className="text-xs">{i.invoice_date && format(new Date(i.invoice_date), 'dd/MM/yy', { locale: fr })}</TableCell>
                            <TableCell className="text-xs">{i.plan_name}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{fmtEur(i.amount_ttc || 0)}</TableCell>
                            <TableCell><Badge variant={i.status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">{i.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                        {invoices.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Aucune facture</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Sub accounts / staff contacts */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Comptes liés ({subAccounts.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-60 overflow-auto divide-y">
                    {subAccounts.map((s, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-sm">
                        <div>
                          <div>{[s.first_name, s.last_name].filter(Boolean).join(' ') || '—'}</div>
                          <div className="text-xs text-muted-foreground">{s.email} · {s.role_name}</div>
                        </div>
                        <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">{s.is_active ? 'Actif' : 'Inactif'}</Badge>
                      </div>
                    ))}
                    {subAccounts.length === 0 && (
                      <div className="text-center text-muted-foreground py-4 text-sm">Aucun compte lié</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="border rounded-lg p-2 text-center">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

export default CrmDetailDrawer;
