import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageCircle, Clock, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface SupportTicket {
  id: string;
  user_id: string;
  hotel_id: string | null;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
}

export function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const { toast } = useToast();

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user emails
      const ticketsWithEmails = await Promise.all(
        (data || []).map(async (ticket) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', ticket.user_id)
            .single();
          return { ...ticket, user_email: profile?.email };
        })
      );

      setTickets(ticketsWithEmails as SupportTicket[]);
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les tickets."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const updateTicketStatus = async (ticketId: string, status: SupportTicket['status']) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { ...t, status } : t
      ));

      toast({
        title: "Statut mis à jour",
        description: `Le ticket a été marqué comme ${status}.`
      });
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour le ticket."
      });
    }
  };

  const saveAdminNotes = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          admin_notes: adminNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { ...t, admin_notes: adminNotes } : t
      ));

      toast({
        title: "Notes sauvegardées",
        description: "Les notes administrateur ont été mises à jour."
      });
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder les notes."
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    const labels: Record<string, string> = {
      low: 'Basse',
      normal: 'Normale',
      high: 'Haute',
      urgent: 'Urgente'
    };
    return <Badge className={colors[priority]}>{labels[priority]}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      open: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" />, label: 'Ouvert' },
      in_progress: { color: 'bg-blue-100 text-blue-800', icon: <RefreshCw className="h-3 w-3" />, label: 'En cours' },
      resolved: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" />, label: 'Résolu' },
      closed: { color: 'bg-gray-100 text-gray-800', icon: <CheckCircle className="h-3 w-3" />, label: 'Fermé' }
    };
    const { color, icon, label } = config[status] || config.open;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        {icon}
        {label}
      </Badge>
    );
  };

  if (loading) {
    return <div className="animate-pulse">Chargement des tickets...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Tickets de support ({tickets.length})
        </h2>
        <Button variant="outline" size="sm" onClick={loadTickets}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-4">
        {tickets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun ticket de support pour le moment.
            </CardContent>
          </Card>
        ) : (
          tickets.map(ticket => (
            <Card key={ticket.id} className={selectedTicket?.id === ticket.id ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {ticket.user_email} • {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(ticket.priority)}
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
                </div>

                {selectedTicket?.id === ticket.id ? (
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex gap-2">
                      <Select 
                        value={ticket.status} 
                        onValueChange={(v) => updateTicketStatus(ticket.id, v as SupportTicket['status'])}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Ouvert</SelectItem>
                          <SelectItem value="in_progress">En cours</SelectItem>
                          <SelectItem value="resolved">Résolu</SelectItem>
                          <SelectItem value="closed">Fermé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      placeholder="Notes administrateur..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveAdminNotes(ticket.id)}>
                        Sauvegarder notes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedTicket(null)}>
                        Fermer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    {ticket.admin_notes && (
                      <p className="text-sm text-muted-foreground italic">
                        Notes: {ticket.admin_notes.substring(0, 50)}...
                      </p>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setAdminNotes(ticket.admin_notes || '');
                      }}
                    >
                      Gérer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
