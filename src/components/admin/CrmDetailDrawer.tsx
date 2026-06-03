import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  User, Euro, FileText, Clock, Mail, Phone, Building2,
  Pencil, Save, X, CreditCard, CalendarPlus, Ban, ShieldCheck, ArrowUpDown, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Props {
  hotelId: string | null;
  userId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const fmtEur = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

const PLANS = [
  { value: 'free', label: 'Gratuit' },
  { value: 'decouverte', label: 'Découverte' },
  { value: 'essentiel', label: 'Essentiel' },
  { value: 'confort', label: 'Confort' },
  { value: 'business', label: 'Business' },
  { value: 'entreprise', label: 'Entreprise' },
];

const PAYMENT_LABELS: Record<string, string> = {
  card: 'Carte bancaire',
  sepa: 'Prélèvement SEPA',
  gocardless: 'Prélèvement (GoCardless)',
  bank_transfer: 'Virement bancaire',
  transfer: 'Virement bancaire',
  cash: 'Espèces',
  check: 'Chèque',
  manual: 'Manuel',
};
const fmtPayment = (m?: string | null) => (m ? PAYMENT_LABELS[m] || m : '—');

export function CrmDetailDrawer({ hotelId, userId, onClose, onUpdated }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hotel, setHotel] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [firstLogin, setFirstLogin] = useState<string | null>(null);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [subAccounts, setSubAccounts] = useState<any[]>([]);
  const [uidState, setUidState] = useState<string | null>(null);

  // Management states
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [trialDays, setTrialDays] = useState('30');
  const [busy, setBusy] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const load = async () => {
    if (!hotelId) return;
    setLoading(true);
    const hotelRes = await supabase.from('hotels').select('*').eq('id', hotelId).maybeSingle();
    const uid = userId || hotelRes.data?.user_id;
    const profRes = uid
      ? await supabase.from('profiles')
          .select('id, email, company_name, billing_contact_name, billing_contact_email, billing_company_name, subscription_type, plan, trial_end_date, is_suspended, suspension_reason, created_at')
          .eq('id', uid).maybeSingle()
      : { data: null };
    const invRes = await supabase.from('invoices')
      .select('id, invoice_number, invoice_date, amount_ttc, plan_name, status, payment_method, payment_reference, pdf_url')
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
    setUidState(uid || null);
    setEditName((profRes.data as any)?.billing_contact_name || '');
    setInvoices((invRes.data as any[]) || []);
    setFirstLogin((firstRes.data as any)?.login_time || null);
    setLastLogin((lastRes.data as any)?.last_activity || null);
    setSubAccounts((subRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    setEditingName(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, userId]);

  const totalSpent = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount_ttc || 0), 0);
  const logAction = (action: string, details: any) =>
    uidState && supabase.rpc('log_admin_action', { p_action: action, p_target_user_id: uidState, p_details: details });

  const saveName = async () => {
    if (!uidState) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ billing_contact_name: editName.trim() }).eq('id', uidState);
    setSavingName(false);
    if (error) { toast({ variant: 'destructive', title: 'Erreur', description: error.message }); return; }
    await logAction('update_contact_name', { name: editName.trim() });
    toast({ title: 'Contact mis à jour' });
    setEditingName(false);
    load(); onUpdated?.();
  };

  const changePlan = async (newPlan: string) => {
    if (!uidState) return;
    setBusy('plan');
    const { error } = await supabase.from('profiles').update({ subscription_type: newPlan, plan: newPlan }).eq('id', uidState);
    setBusy(null);
    if (error) { toast({ variant: 'destructive', title: 'Erreur', description: error.message }); return; }
    await logAction('change_subscription', { new_plan: newPlan });
    toast({ title: 'Abonnement mis à jour', description: `Plan : ${newPlan}` });
    load(); onUpdated?.();
  };

  const extendTrial = async () => {
    if (!uidState) return;
    const days = parseInt(trialDays, 10);
    if (!days || days <= 0) { toast({ variant: 'destructive', title: 'Nombre de jours invalide' }); return; }
    setBusy('trial');
    const base = profile?.trial_end_date && new Date(profile.trial_end_date) > new Date()
      ? new Date(profile.trial_end_date) : new Date();
    base.setDate(base.getDate() + days);
    const { error } = await supabase.from('profiles').update({ trial_end_date: base.toISOString() }).eq('id', uidState);
    setBusy(null);
    if (error) { toast({ variant: 'destructive', title: 'Erreur', description: error.message }); return; }
    await logAction('extend_trial', { days_extended: days });
    toast({ title: 'Essai prolongé', description: `+${days} jours` });
    load(); onUpdated?.();
  };

  const toggleSuspend = async () => {
    if (!uidState) return;
    const suspend = !profile?.is_suspended;
    setBusy('suspend');
    const { error } = await supabase.from('profiles')
      .update({ is_suspended: suspend, suspension_reason: suspend ? (suspendReason.trim() || null) : null })
      .eq('id', uidState);
    setBusy(null);
    if (error) { toast({ variant: 'destructive', title: 'Erreur', description: error.message }); return; }
    await logAction(suspend ? 'suspend_user' : 'unsuspend_user', suspend ? { reason: suspendReason.trim() } : {});
    toast({ title: suspend ? 'Compte suspendu' : 'Compte réactivé' });
    setSuspendReason('');
    load(); onUpdated?.();
  };

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
                {profile?.is_suspended && <Badge variant="destructive">Suspendu</Badge>}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              {/* Contact */}
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Contact</CardTitle>
                  {!editingName ? (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingName(true)} disabled={!uidState}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Modifier
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7" onClick={saveName} disabled={savingName}>
                        <Save className="h-3.5 w-3.5 mr-1" />Enregistrer
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingName(false); setEditName(profile?.billing_contact_name || ''); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {editingName ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Nom & prénom du contact</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Marie Dupont" />
                    </div>
                  ) : (
                    <div><span className="text-muted-foreground">Nom & prénom :</span> {profile?.billing_contact_name || '—'}</div>
                  )}
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
                {profile?.trial_end_date && <> · Essai jusqu'au {format(new Date(profile.trial_end_date), 'dd/MM/yyyy', { locale: fr })}</>}
              </div>

              {/* Account management */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Gestion du compte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Plan */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><ArrowUpDown className="h-3.5 w-3.5" />Abonnement (upgrade / downgrade)</Label>
                    <Select value={profile?.subscription_type || undefined} onValueChange={changePlan} disabled={!uidState || busy === 'plan'}>
                      <SelectTrigger><SelectValue placeholder="Choisir un plan" /></SelectTrigger>
                      <SelectContent>
                        {PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Trial extension */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><CalendarPlus className="h-3.5 w-3.5" />Prolonger la période d'essai</Label>
                    <div className="flex gap-2">
                      <Input type="number" min={1} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="w-24" />
                      <span className="self-center text-sm text-muted-foreground">jours</span>
                      <Button variant="outline" size="sm" onClick={extendTrial} disabled={!uidState || busy === 'trial'}>
                        Prolonger
                      </Button>
                    </div>
                  </div>

                  {/* Suspend */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" />Suspension du compte / abonnement</Label>
                    {!profile?.is_suspended && (
                      <Textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Motif (optionnel)" rows={2} className="text-sm" />
                    )}
                    {profile?.is_suspended && profile?.suspension_reason && (
                      <p className="text-xs text-muted-foreground">Motif : {profile.suspension_reason}</p>
                    )}
                    <Button
                      variant={profile?.is_suspended ? 'outline' : 'destructive'}
                      size="sm"
                      onClick={toggleSuspend}
                      disabled={!uidState || busy === 'suspend'}
                    >
                      {profile?.is_suspended ? 'Réactiver le compte' : 'Suspendre le compte'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Invoices */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Factures ({invoices.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-80 overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>N°</TableHead><TableHead>Date</TableHead><TableHead>Plan</TableHead>
                        <TableHead className="text-right">TTC</TableHead>
                        <TableHead>Règlement</TableHead><TableHead>Statut</TableHead><TableHead></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {invoices.map(i => (
                          <TableRow key={i.id}>
                            <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                            <TableCell className="text-xs">{i.invoice_date && format(new Date(i.invoice_date), 'dd/MM/yy', { locale: fr })}</TableCell>
                            <TableCell className="text-xs">{i.plan_name}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{fmtEur(i.amount_ttc || 0)}</TableCell>
                            <TableCell className="text-xs">
                              <span className="flex items-center gap-1"><CreditCard className="h-3 w-3 text-muted-foreground" />{fmtPayment(i.payment_method)}</span>
                              {i.payment_reference && <span className="block text-[10px] text-muted-foreground font-mono">{i.payment_reference}</span>}
                            </TableCell>
                            <TableCell><Badge variant={i.status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">{i.status}</Badge></TableCell>
                            <TableCell>
                              {i.pdf_url && (
                                <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                                  <a href={i.pdf_url} target="_blank" rel="noopener noreferrer" title="Voir la facture">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {invoices.length === 0 && (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Aucune facture</TableCell></TableRow>
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
