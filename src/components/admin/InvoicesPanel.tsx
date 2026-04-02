import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Search, Building2, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { downloadInvoicePdf } from '@/utils/invoiceDownload';

interface AdminInvoice {
  id: string;
  user_id: string;
  hotel_id: string | null;
  invoice_number: string;
  invoice_date: string;
  amount_ht: number;
  tva_rate: number;
  tva_amount: number;
  amount_ttc: number;
  plan_name: string;
  status: string;
  pdf_url: string | null;
  customer_email: string | null;
  customer_company_name: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  period_start: string | null;
  period_end: string | null;
  seller_name: string | null;
  created_at: string;
  hotel_name?: string;
  hotel_email?: string;
}

interface Hotel {
  id: string;
  name: string;
  email: string;
}

export const InvoicesPanel = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hotelFilter, setHotelFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invoicesRes, hotelsRes] = await Promise.all([
        supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
        supabase.from('hotels').select('id, name, email').order('name'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (hotelsRes.error) throw hotelsRes.error;

      const hotelsList = hotelsRes.data || [];
      setHotels(hotelsList);

      // Build a hotel lookup map
      const hotelMap = new Map<string, Hotel>();
      hotelsList.forEach(h => hotelMap.set(h.id, h));

      // For invoices without hotel_id, try to resolve via user_id → hotels.user_id
      const userIdToHotel = new Map<string, Hotel>();
      hotelsList.forEach(h => {
        // hotels have user_id but we can't access it from this select; skip
      });

      const enrichedInvoices = ((invoicesRes.data as any[]) || []).map(inv => {
        const hotel = inv.hotel_id ? hotelMap.get(inv.hotel_id) : undefined;
        return {
          ...inv,
          hotel_name: hotel?.name || undefined,
          hotel_email: hotel?.email || undefined,
        };
      });

      // For invoices missing hotel info, try to fetch via user_id
      const missingUserIds = enrichedInvoices
        .filter(inv => !inv.hotel_name && inv.user_id)
        .map(inv => inv.user_id);

      const uniqueUserIds = [...new Set(missingUserIds)];
      if (uniqueUserIds.length > 0) {
        const { data: userHotels } = await supabase
          .from('hotels')
          .select('id, name, email, user_id')
          .in('user_id', uniqueUserIds);

        if (userHotels) {
          const userHotelMap = new Map<string, { name: string; email: string }>();
          userHotels.forEach(h => {
            userHotelMap.set(h.user_id!, { name: h.name, email: h.email });
          });

          enrichedInvoices.forEach(inv => {
            if (!inv.hotel_name && inv.user_id && userHotelMap.has(inv.user_id)) {
              const h = userHotelMap.get(inv.user_id)!;
              inv.hotel_name = h.name;
              inv.hotel_email = h.email;
            }
          });
        }
      }

      setInvoices(enrichedInvoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les factures', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (cents: number) => {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-600/90 text-primary-foreground">Payée</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulée</Badge>;
      case 'overdue':
        return <Badge className="bg-orange-500/90 text-primary-foreground">En retard</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return '-';
    if (method === 'gocardless_direct_debit') return 'Prélèvement GoCardless';
    if (method === 'card') return 'Carte bancaire';
    return method;
  };

  const handleDownload = async (invoice: AdminInvoice) => {
    setDownloadingId(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoice_number);
      await loadData();
    } catch (error: any) {
      console.error('Download error:', error);
      toast({ title: 'Erreur', description: error.message || 'Impossible de télécharger la facture', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (hotelFilter !== 'all') {
      if (inv.hotel_id !== hotelFilter) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(term) ||
        inv.customer_email?.toLowerCase().includes(term) ||
        inv.customer_company_name?.toLowerCase().includes(term) ||
        inv.plan_name?.toLowerCase().includes(term) ||
        inv.hotel_name?.toLowerCase().includes(term) ||
        inv.hotel_email?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalRevenue = filteredInvoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount_ttc, 0);

  const totalPending = filteredInvoices
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + i.amount_ttc, 0);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total factures</p>
            <p className="text-2xl font-bold">{filteredInvoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Revenus encaissés</p>
            <p className="text-2xl font-bold text-green-600">{formatAmount(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">En attente</p>
            <p className="text-2xl font-bold text-orange-500">{formatAmount(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Établissements facturés</p>
            <p className="text-2xl font-bold">{new Set(filteredInvoices.map(i => i.hotel_id || i.user_id).filter(Boolean)).size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factures ({filteredInvoices.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par n° facture, email, établissement..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="paid">Payées</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="overdue">En retard</SelectItem>
                <SelectItem value="cancelled">Annulées</SelectItem>
              </SelectContent>
            </Select>
            <Select value={hotelFilter} onValueChange={setHotelFilter}>
              <SelectTrigger className="w-[200px]">
                <Building2 className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Établissement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les établissements</SelectItem>
                {hotels.map((hotel) => (
                  <SelectItem key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucune facture trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Facture</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Établissement</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead className="text-right">TTC</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{invoice.hotel_name || '-'}</div>
                        {invoice.hotel_email && (
                          <div className="text-muted-foreground text-xs">{invoice.hotel_email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{invoice.customer_company_name || '-'}</div>
                        <div className="text-muted-foreground text-xs">{invoice.customer_email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{invoice.plan_name}</TableCell>
                      <TableCell className="text-sm">{getPaymentMethodLabel(invoice.payment_method)}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {formatAmount(invoice.amount_ttc)}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(invoice)}
                          disabled={downloadingId === invoice.id}
                        >
                          {downloadingId === invoice.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
