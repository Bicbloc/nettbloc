import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wrench, LogOut, Building2, AlertTriangle, Home, 
  CheckCircle, Clock, AlertCircle, Calendar, RefreshCw,
  MessageSquare, Filter, ArrowLeft, Package, LayoutGrid
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map as MapIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { storageService } from '@/services/storageService';
import { IncidentReportWizard } from '@/components/incident/IncidentReportWizard';
import { UserTypeGuard } from '@/hooks/use-user-type-guard';
import { TechnicianSpacesView } from '@/components/technician/TechnicianSpacesView';
import { TechnicianIncidentActions } from '@/components/technician/TechnicianIncidentActions';
import { ReadOnlyFloorPlan } from '@/components/registry/ReadOnlyFloorPlan';
import { cn } from '@/lib/utils';

interface Incident {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  location_type: string | null;
  location_reference: string | null;
  created_at: string;
  due_date: string | null;
  resolved_at: string | null;
  incident_types?: { name: string; color: string; severity: string } | null;
  incident_categories?: { name: string; icon: string } | null;
  incident_items?: { name: string } | null;
  incident_comments?: Array<{
    id: string;
    comment: string;
    user_name: string;
    user_type: string;
    created_at: string;
  }>;
  incident_images?: Array<{
    id: string;
    image_url: string;
    uploaded_at: string;
  }>;
}

interface Room {
  id: string;
  room_number: string;
  status: string;
  cleaning_type?: string;
  notes?: string;
}

function TechnicianWorkContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<any>(null);
  const [hotel, setHotel] = useState<any>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'incidents' | 'spaces' | 'report' | 'plan'>('incidents');
  
  // Comment dialog
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  
  // Due date dialog
  const [showDueDateDialog, setShowDueDateDialog] = useState(false);
  const [selectedDueDate, setSelectedDueDate] = useState('');

  // Contact / coordonnées dialog
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', first_name: '', phone: '' });

  const openContactDialog = () => {
    setContactForm({
      name: profile?.name || '',
      first_name: profile?.first_name || '',
      phone: profile?.phone || ''
    });
    setShowContactDialog(true);
  };

  const handleSaveContact = async () => {
    if (!profile) return;
    if (!contactForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Nom requis', description: 'Veuillez entrer votre nom' });
      return;
    }
    setIsSavingContact(true);
    try {
      const { error } = await supabase
        .from('technician_profiles')
        .update({
          name: contactForm.name.trim(),
          first_name: contactForm.first_name.trim() || null,
          phone: contactForm.phone.trim() || null,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', profile.id);
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, name: contactForm.name, first_name: contactForm.first_name, phone: contactForm.phone }));
      toast({ title: 'Coordonnées mises à jour ✅', description: 'Vos informations sont visibles par l\'établissement' });
      setShowContactDialog(false);
    } catch (e) {
      console.error('Error saving contact:', e);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer' });
    } finally {
      setIsSavingContact(false);
    }
  };

  // Load profile and hotel
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/technician/login');
          return;
        }

        // Load technician profile
        const { data: profileData } = await supabase
          .from('technician_profiles')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();

        if (!profileData) {
          navigate('/technician/signup');
          return;
        }

        setProfile(profileData);

        // Get hotel from storage
        const hotelId = storageService.getHotelId();
        const hotelName = localStorage.getItem('lastSelectedHotelName');
        
        if (!hotelId) {
          navigate('/technician/hotels');
          return;
        }

        setHotel({ id: hotelId, name: hotelName });
        
        await loadData(hotelId);
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [navigate]);

  const loadData = async (hotelId: string) => {
    await Promise.all([
      loadIncidents(hotelId),
      loadRooms(hotelId)
    ]);
  };

  const loadIncidents = async (hotelId: string) => {
    try {
      let query = supabase
        .from('incidents')
        .select(`
          *,
          incident_types(name, color, severity),
          incident_categories(name, icon),
          incident_items(name),
          incident_comments(
            id,
            comment,
            user_name,
            user_type,
            created_at
          ),
          incident_images(
            id,
            image_url,
            uploaded_at
          )
        `)
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error('Error loading incidents:', error);
    }
  };

  const loadRooms = async (hotelId: string) => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_number, status, cleaning_type, notes')
        .eq('hotel_id', hotelId)
        .order('room_number');

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const handleRefresh = async () => {
    if (!hotel?.id) return;
    setIsRefreshing(true);
    await loadData(hotel.id);
    setIsRefreshing(false);
    toast({ title: "Données actualisées" });
  };

  const handleStatusChange = async (incidentId: string, newStatus: string) => {
    try {
      const updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = profile?.id;
      }

      const { error } = await supabase
        .from('incidents')
        .update(updateData)
        .eq('id', incidentId);

      if (error) throw error;

      setIncidents(prev => prev.map(inc => 
        inc.id === incidentId 
          ? { ...inc, status: newStatus, resolved_at: updateData.resolved_at }
          : inc
      ));

      toast({ title: "Statut mis à jour" });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ variant: "destructive", title: "Erreur lors de la mise à jour" });
    }
  };

  const handleAddComment = async () => {
    if (!selectedIncidentId || !newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('incident_comments')
        .insert({
          incident_id: selectedIncidentId,
          comment: newComment,
          user_id: profile?.id || '',
          user_name: profile?.name || 'Technicien',
          user_type: 'technician'
        });

      if (error) throw error;

      setShowCommentDialog(false);
      setNewComment('');
      setSelectedIncidentId(null);
      
      if (hotel?.id) {
        await loadIncidents(hotel.id);
      }

      toast({ title: "Commentaire ajouté" });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ variant: "destructive", title: "Erreur lors de l'ajout" });
    }
  };

  const handleUpdateDueDate = async () => {
    if (!selectedIncidentId || !selectedDueDate) return;

    try {
      const { error } = await supabase
        .from('incidents')
        .update({ due_date: selectedDueDate })
        .eq('id', selectedIncidentId);

      if (error) throw error;

      setShowDueDateDialog(false);
      setSelectedDueDate('');
      setSelectedIncidentId(null);
      
      if (hotel?.id) {
        await loadIncidents(hotel.id);
      }

      toast({ title: "Date de suivi mise à jour" });
    } catch (error) {
      console.error('Error updating due date:', error);
      toast({ variant: "destructive", title: "Erreur lors de la mise à jour" });
    }
  };

  const openCommentDialog = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setShowCommentDialog(true);
  };

  const openDueDateDialog = (incidentId: string, currentDueDate?: string | null) => {
    setSelectedIncidentId(incidentId);
    setSelectedDueDate(currentDueDate ? currentDueDate.split('T')[0] : '');
    setShowDueDateDialog(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    storageService.clearHotel();
    // Ne nettoyer que les clés du technicien (ne pas effacer les autres portails)
    localStorage.removeItem('technicianProfile');
    localStorage.removeItem('lastSelectedHotelId');
    localStorage.removeItem('lastSelectedHotelName');
    navigate('/technician/login');
  };

  // Filter incidents
  const filteredIncidents = incidents.filter(incident => {
    if (statusFilter !== 'all' && incident.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && incident.priority !== priorityFilter) return false;
    return true;
  });

  // Count by status (including new technician-specific statuses)
  const countByStatus = {
    new: incidents.filter(i => i.status === 'new').length,
    in_progress: incidents.filter(i => i.status === 'in_progress').length,
    postponed: incidents.filter(i => i.status === 'postponed').length,
    parts_ordered: incidents.filter(i => i.status === 'parts_ordered').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  };

  // Count by priority
  const countByPriority = {
    urgent: incidents.filter(i => i.priority === 'urgent').length,
    high: incidents.filter(i => i.priority === 'high').length,
    medium: incidents.filter(i => i.priority === 'medium').length,
    low: incidents.filter(i => i.priority === 'low').length,
  };

  // Room status counts
  const roomCounts = {
    stayover: rooms.filter(r => r.cleaning_type === 'recouche' || r.cleaning_type === 'occupied' || r.cleaning_type === 'quick').length,
    checkout: rooms.filter(r => r.status === 'checkout' || r.status === 'ready_to_clean').length,
    cleaning: rooms.filter(r => r.status === 'cleaning' || r.status === 'in_progress').length,
    clean: rooms.filter(r => r.status === 'clean').length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/technician/hotels')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="bg-blue-100 p-2 rounded-full">
                  <Wrench className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">{profile?.name}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {hotel?.name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-red-100">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus.new}</p>
                <p className="text-xs text-muted-foreground">Nouveaux</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-amber-100">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus.in_progress}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-100">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus.resolved}</p>
                <p className="text-xs text-muted-foreground">Résolus</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-purple-100">
                <AlertTriangle className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByPriority.urgent + countByPriority.high}</p>
                <p className="text-xs text-muted-foreground">Urgents</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="incidents" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Incidents</span>
              {countByStatus.new + countByStatus.in_progress + countByStatus.postponed + countByStatus.parts_ordered > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                  {countByStatus.new + countByStatus.in_progress + countByStatus.postponed + countByStatus.parts_ordered}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="spaces" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Espaces</span>
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-2">
              <MapIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Plan</span>
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Signaler</span>
            </TabsTrigger>
          </TabsList>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="space-y-4">
            {/* Filters */}
            <Card className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="new">📌 Nouveau</SelectItem>
                      <SelectItem value="in_progress">⏳ En cours</SelectItem>
                      <SelectItem value="postponed">📅 Reporté</SelectItem>
                      <SelectItem value="parts_ordered">📦 Pièce commandée</SelectItem>
                      <SelectItem value="resolved">✅ Résolu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Priorité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes priorités</SelectItem>
                    <SelectItem value="urgent">🔴 Urgent</SelectItem>
                    <SelectItem value="high">🟠 Élevé</SelectItem>
                    <SelectItem value="medium">🟡 Moyen</SelectItem>
                    <SelectItem value="low">🔵 Faible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Priority Summary */}
            {countByPriority.urgent > 0 && (
              <Card className="p-3 border-destructive/50 bg-destructive/5">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">
                    {countByPriority.urgent} incident{countByPriority.urgent > 1 ? 's' : ''} urgent{countByPriority.urgent > 1 ? 's' : ''} à traiter
                  </span>
                </div>
              </Card>
            )}

            {/* Incidents List */}
            <div className="space-y-3">
              {filteredIncidents.length === 0 ? (
                <Card className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Aucun incident</h3>
                  <p className="text-muted-foreground">
                    {statusFilter === 'all' && priorityFilter === 'all'
                      ? "Pas d'incident enregistré"
                      : "Aucun incident ne correspond aux filtres"}
                  </p>
                </Card>
              ) : (
                filteredIncidents.map((incident) => (
                  <TechnicianIncidentCard
                    key={incident.id}
                    incident={incident}
                    onStatusChange={handleStatusChange}
                    onAddComment={() => openCommentDialog(incident.id)}
                    onUpdateDueDate={() => openDueDateDialog(incident.id, incident.due_date)}
                    profileName={profile?.name || 'Technicien'}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* Spaces Tab */}
          <TabsContent value="spaces" className="space-y-4">
            {hotel?.id && (
              <TechnicianSpacesView 
                hotelId={hotel.id} 
              />
            )}
          </TabsContent>

          {/* Plan Tab */}
          <TabsContent value="plan">
            {hotel?.id && <ReadOnlyFloorPlan hotelId={hotel.id} />}
          </TabsContent>

          {/* Report Tab */}
          <TabsContent value="report">
            <Card className="p-4">
              <CardHeader className="px-0 pt-0">
                <CardTitle>Signaler un incident</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0 flex justify-center">
                {hotel?.id && (
                  <IncidentReportWizard 
                    hotelId={hotel.id} 
                    userType="technician"
                    userName={profile?.name || 'Technicien'}
                    userId={profile?.id}
                    onSuccess={() => {
                      loadIncidents(hotel.id);
                      setActiveTab('incidents');
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Comment Dialog */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un commentaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Votre commentaire..."
              rows={4}
            />
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="w-full"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Ajouter le commentaire
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Due Date Dialog */}
      <Dialog open={showDueDateDialog} onOpenChange={setShowDueDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planifier le suivi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date de suivi</Label>
              <Input
                type="date"
                value={selectedDueDate}
                onChange={(e) => setSelectedDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <Button
              onClick={handleUpdateDueDate}
              disabled={!selectedDueDate}
              className="w-full"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Définir la date de suivi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Technician-specific incident card component with enhanced actions
function TechnicianIncidentCard({ 
  incident, 
  onStatusChange, 
  onAddComment, 
  onUpdateDueDate,
  profileName 
}: { 
  incident: Incident; 
  onStatusChange: (id: string, status: string) => void;
  onAddComment: () => void;
  onUpdateDueDate: () => void;
  profileName: string;
}) {
  const priorityConfig: Record<string, { color: string; emoji: string }> = {
    urgent: { color: 'bg-destructive text-destructive-foreground', emoji: '🔴' },
    high: { color: 'bg-orange-500 text-white', emoji: '🟠' },
    medium: { color: 'bg-yellow-500 text-white', emoji: '🟡' },
    low: { color: 'bg-blue-500 text-white', emoji: '🔵' },
  };

  const statusConfig: Record<string, { color: string; label: string; emoji: string }> = {
    new: { color: 'border-destructive/50 bg-destructive/10 text-destructive', label: 'Nouveau', emoji: '📌' },
    in_progress: { color: 'border-amber-500/50 bg-amber-100 text-amber-700', label: 'En cours', emoji: '⏳' },
    pending_validation: { color: 'border-purple-500/50 bg-purple-100 text-purple-700', label: 'À valider par l\'établissement', emoji: '🕓' },
    resolved: { color: 'border-green-500/50 bg-green-100 text-green-700', label: 'Validé / Résolu', emoji: '✅' },
    postponed: { color: 'border-purple-500/50 bg-purple-100 text-purple-700', label: 'Reporté', emoji: '📅' },
    parts_ordered: { color: 'border-blue-500/50 bg-blue-100 text-blue-700', label: 'Pièce commandée', emoji: '📦' },
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const priority = priorityConfig[incident.priority || 'medium'] || priorityConfig.medium;
  const status = statusConfig[incident.status || 'new'] || statusConfig.new;

  return (
    <Card className={cn(
      "p-4",
      incident.priority === 'urgent' && "border-destructive/50 bg-destructive/5"
    )}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={priority.color}>
                {priority.emoji} {incident.priority || 'medium'}
              </Badge>
              <Badge variant="outline" className={status.color}>
                {status.emoji} {status.label}
              </Badge>
            </div>
            <h4 className="font-semibold">{incident.title}</h4>
            {incident.description && (
              <p className="text-sm text-muted-foreground mt-1">{incident.description}</p>
            )}
          </div>
        </div>

        {/* Location & Date */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {incident.location_reference && (
            <span className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              {incident.location_type === 'room' ? 'Chambre' : ''} {incident.location_reference}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatDate(incident.created_at)}
          </span>
          {incident.due_date && (
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" />
              Suivi: {new Date(incident.due_date).toLocaleDateString('fr-FR')}
            </Badge>
          )}
        </div>

        {/* Category & Item */}
        {(incident.incident_categories || incident.incident_items) && (
          <div className="flex flex-wrap gap-2">
            {incident.incident_categories && (
              <Badge variant="secondary">
                {incident.incident_categories.icon} {incident.incident_categories.name}
              </Badge>
            )}
            {incident.incident_items && (
              <Badge variant="outline">{incident.incident_items.name}</Badge>
            )}
          </div>
        )}

        {/* Comments */}
        {incident.incident_comments && incident.incident_comments.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {incident.incident_comments.length} commentaire{incident.incident_comments.length > 1 ? 's' : ''}
            </p>
            {incident.incident_comments.slice(0, 2).map((comment) => (
              <div key={comment.id} className="text-sm">
                <span className="font-medium">{comment.user_name}:</span>{' '}
                <span className="text-muted-foreground">{comment.comment}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t">
          <Button
            variant={incident.status === 'pending_validation' || incident.status === 'resolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusChange(incident.id, 'pending_validation')}
            disabled={incident.status === 'resolved'}
            className={cn(
              "gap-1",
              (incident.status === 'pending_validation' || incident.status === 'resolved') && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            <CheckCircle className="h-4 w-4" />
            {incident.status === 'resolved' ? 'Validé' : incident.status === 'pending_validation' ? 'À valider' : 'Terminé'}
          </Button>

          <Button
            variant={incident.status === 'postponed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusChange(incident.id, 'postponed')}
            className={cn(
              "gap-1",
              incident.status === 'postponed' && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            <Calendar className="h-4 w-4" />
            Reporter
          </Button>

          <Button
            variant={incident.status === 'parts_ordered' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusChange(incident.id, 'parts_ordered')}
            className={cn(
              "gap-1",
              incident.status === 'parts_ordered' && "bg-blue-600 hover:bg-blue-700"
            )}
          >
            <Package className="h-4 w-4" />
            Pièce
          </Button>

          <Button
            variant={incident.status === 'in_progress' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusChange(incident.id, 'in_progress')}
            className={cn(
              "gap-1",
              incident.status === 'in_progress' && "bg-amber-600 hover:bg-amber-700"
            )}
          >
            <Clock className="h-4 w-4" />
            En cours
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onAddComment}
            className="gap-1"
          >
            <MessageSquare className="h-4 w-4" />
            Commenter
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onUpdateDueDate}
            className="gap-1"
          >
            <Calendar className="h-4 w-4" />
            Planifier
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Room status card component
function RoomStatusCard({ room }: { room: Room }) {
  const getStatusStyle = () => {
    const status = room.status?.toLowerCase();
    const cleaningType = room.cleaning_type?.toLowerCase();

    if (status === 'clean') {
      return 'bg-green-100 border-green-300 text-green-700';
    }
    if (status === 'cleaning' || status === 'in_progress') {
      return 'bg-blue-100 border-blue-300 text-blue-700';
    }
    if (status === 'checkout' || status === 'ready_to_clean') {
      return 'bg-red-100 border-red-300 text-red-700';
    }
    if (cleaningType === 'recouche' || cleaningType === 'occupied' || cleaningType === 'quick') {
      return 'bg-amber-100 border-amber-300 text-amber-700';
    }
    return 'bg-gray-100 border-gray-300 text-gray-700';
  };

  const getStatusLabel = () => {
    const status = room.status?.toLowerCase();
    const cleaningType = room.cleaning_type?.toLowerCase();

    if (status === 'clean') return '✅';
    if (status === 'cleaning' || status === 'in_progress') return '🧹';
    if (status === 'checkout' || status === 'ready_to_clean') return '🚪';
    if (cleaningType === 'recouche' || cleaningType === 'occupied' || cleaningType === 'quick') return '🛏️';
    return '•';
  };

  return (
    <div className={`p-2 rounded-lg border text-center ${getStatusStyle()}`}>
      <p className="font-bold text-sm">{room.room_number}</p>
      <p className="text-xs">{getStatusLabel()}</p>
    </div>
  );
}

export default function TechnicianWork() {
  return (
    <UserTypeGuard expectedType="technician">
      <TechnicianWorkContent />
    </UserTypeGuard>
  );
}
