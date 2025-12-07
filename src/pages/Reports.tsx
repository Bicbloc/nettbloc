import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  FileText, 
  Download, 
  Calendar, 
  Search, 
  Filter,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  Clock,
  User
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NotificationBell } from '@/components/NotificationBell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActionLog {
  id?: string;
  action_type: string;
  actor_name?: string;
  actor_type?: string;
  room_number?: string;
  description: string;
  created_at?: string;
  details?: any;
}

interface DailyReport {
  id: string;
  hotel_id: string;
  user_id: string;
  report_date: string;
  created_at: string;
  room_data: any;
  housekeeper_assignments: any;
  housekeeper_names: any;
  action_log: ActionLog[];
}

const Reports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('summary');

  useEffect(() => {
    loadReports();
  }, [user]);

  useEffect(() => {
    filterReports();
  }, [reports, searchTerm]);

  const loadReports = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Charger les rapports depuis daily_reports
      const { data: reportsData, error } = await supabase
        .from('daily_reports')
        .select('*')
        .order('report_date', { ascending: false });
      
      if (error) throw error;

      // Charger aussi les logs archivés
      const { data: archivedLogs } = await supabase
        .from('archived_daily_logs')
        .select('*')
        .order('archive_date', { ascending: false });

      // Créer un map des logs archivés par date
      const logsMap = new Map<string, any[]>();
      (archivedLogs || []).forEach(log => {
        const dateKey = log.archive_date;
        const existingLogs = logsMap.get(dateKey) || [];
        const logData = Array.isArray(log.logs_data) ? log.logs_data : [];
        logsMap.set(dateKey, [...existingLogs, ...logData]);
      });
      
      // Transformer les données pour correspondre à l'interface
      const transformedReports: DailyReport[] = (reportsData || []).map(report => {
        const summaryActionLog = (report.summary as any)?.action_log || (report.summary as any)?.remarks || [];
        const archivedActionLog = logsMap.get(report.report_date) || [];
        
        return {
          id: report.id,
          hotel_id: report.hotel_id || '',
          user_id: report.housekeeper_id || '',
          report_date: report.report_date,
          created_at: report.created_at || report.report_date,
          room_data: Array.isArray(report.room_data) ? report.room_data : [],
          housekeeper_assignments: (report.summary as any)?.assignments || {},
          housekeeper_names: (report.summary as any)?.housekeepers || [],
          action_log: archivedActionLog.length > 0 ? archivedActionLog : summaryActionLog
        };
      });
      
      setReports(transformedReports);
      console.log(`✅ ${transformedReports.length} rapports chargés`);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les rapports"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterReports = () => {
    if (!searchTerm.trim()) {
      setFilteredReports(reports);
      return;
    }

    const filtered = reports.filter(report => {
      const reportDate = format(parseISO(report.report_date), 'PPP', { locale: fr });
      const searchLower = searchTerm.toLowerCase();
      
      return (
        reportDate.toLowerCase().includes(searchLower) ||
        report.housekeeper_names.some((name: string) => 
          name.toLowerCase().includes(searchLower)
        ) ||
        report.room_data.some((room: any) => 
          room.number?.toString().includes(searchTerm)
        )
      );
    });

    setFilteredReports(filtered);
  };

  const handleViewReport = (report: DailyReport) => {
    setSelectedReport(report);
    setSelectedTab('summary');
    setIsReportDialogOpen(true);
  };

  const handleDownloadReport = async (report: DailyReport) => {
    try {
      const dateStr = format(parseISO(report.report_date), 'PPP', { locale: fr });
      
      // Créer le contenu HTML pour le PDF
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            📋 Rapport du ${dateStr}
          </h1>
          
          <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h2 style="margin-top: 0;">📊 Résumé</h2>
            <p><strong>Chambres:</strong> ${report.room_data?.length || 0}</p>
            <p><strong>Femmes de chambre:</strong> ${report.housekeeper_names?.join(', ') || 'N/A'}</p>
            <p><strong>Nettoyées:</strong> ${report.room_data?.filter((r: any) => r.status === 'clean').length || 0}</p>
          </div>
          
          ${report.housekeeper_names?.length > 0 ? `
          <div style="margin: 20px 0;">
            <h2>👥 Assignations par femme de chambre</h2>
            ${Object.entries(report.housekeeper_assignments || {}).map(([name, rooms]: [string, any]) => `
              <div style="margin: 10px 0; padding: 10px; background: #e9ecef; border-radius: 4px;">
                <strong>${name}:</strong> ${Array.isArray(rooms) ? rooms.map((r: any) => r.room_number || r.number || r).join(', ') : 'N/A'}
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${report.room_data?.length > 0 ? `
          <div style="margin: 20px 0;">
            <h2>🛏️ Détail des chambres nettoyées</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #28a745; color: white;">
                  <th style="padding: 8px; text-align: left;">Chambre</th>
                  <th style="padding: 8px; text-align: left;">Type</th>
                  <th style="padding: 8px; text-align: left;">Statut</th>
                  <th style="padding: 8px; text-align: left;">Nettoyée par</th>
                </tr>
              </thead>
              <tbody>
                ${report.room_data.map((room: any) => `
                  <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px; font-weight: bold;">${room.number || room.room_number || '-'}</td>
                    <td style="padding: 8px;">${room.cleaning_type || room.cleaningType || '-'}</td>
                    <td style="padding: 8px;">${room.status === 'clean' ? '✅ Propre' : room.status === 'in_progress' ? '🔄 En cours' : '⏳ En attente'}</td>
                    <td style="padding: 8px;">${room.cleaned_by || room.assignedTo || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          ${report.action_log?.length > 0 ? `
          <div style="margin: 20px 0;">
            <h2>📝 Journal des actions</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #007bff; color: white;">
                  <th style="padding: 8px; text-align: left;">Heure</th>
                  <th style="padding: 8px; text-align: left;">Action</th>
                  <th style="padding: 8px; text-align: left;">Chambre</th>
                  <th style="padding: 8px; text-align: left;">Par</th>
                </tr>
              </thead>
              <tbody>
                ${report.action_log.map((log: any) => `
                  <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;">${log.created_at ? format(parseISO(log.created_at), 'HH:mm', { locale: fr }) : '-'}</td>
                    <td style="padding: 8px;">${log.description || log.action_type || '-'}</td>
                    <td style="padding: 8px;">${log.room_number || '-'}</td>
                    <td style="padding: 8px;">${log.actor_name || log.housekeeper_name || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Généré le ${format(new Date(), 'PPPp', { locale: fr })}</p>
          </div>
        </div>
      `;
      
      // Créer un élément temporaire
      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      document.body.appendChild(container);
      
      // Générer le PDF avec html2pdf
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: 10,
          filename: `rapport-${report.report_date}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(container)
        .save();
      
      document.body.removeChild(container);

      toast({
        title: "PDF téléchargé",
        description: `Le rapport a été téléchargé en PDF`
      });
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le PDF"
      });
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('daily_reports')
        .delete()
        .eq('id', reportId);

      if (error) {
        console.error('Erreur suppression rapport:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de supprimer le rapport"
        });
        return;
      }

      setReports(prev => prev.filter(r => r.id !== reportId));
      toast({
        title: "Rapport supprimé",
        description: "Le rapport a été supprimé définitivement"
      });
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const getTotalRooms = (roomData: any[]) => {
    return roomData?.length || 0;
  };

  const getCompletedRooms = (roomData: any[]) => {
    return roomData?.filter(room => room.status === 'clean' || room.status === 'completed')?.length || 0;
  };

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'cleaning_start': '🔄 Début nettoyage',
      'cleaning_end': '✅ Fin nettoyage',
      'assignment': '📋 Assignation',
      'unassignment': '🔓 Désassignation',
      'incident': '⚠️ Incident',
      'comment': '💬 Remarque',
      'status_change': '🔄 Changement statut'
    };
    return labels[actionType] || actionType;
  };

  const getActionTypeColor = (actionType: string) => {
    const colors: Record<string, string> = {
      'cleaning_start': 'bg-blue-100 text-blue-800',
      'cleaning_end': 'bg-green-100 text-green-800',
      'assignment': 'bg-purple-100 text-purple-800',
      'unassignment': 'bg-orange-100 text-orange-800',
      'incident': 'bg-red-100 text-red-800',
      'comment': 'bg-yellow-100 text-yellow-800',
      'status_change': 'bg-gray-100 text-gray-800'
    };
    return colors[actionType] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => window.history.back()}
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Rapports Archivés</h1>
              <p className="text-muted-foreground">
                Consultez et téléchargez vos rapports quotidiens
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              onClick={loadReports}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Filtres et recherche */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search" className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4" />
                  Rechercher
                </Label>
                <Input
                  id="search"
                  placeholder="Rechercher par date, femme de chambre ou numéro de chambre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtrer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des rapports */}
        {filteredReports.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Rapports ({filteredReports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date du rapport</TableHead>
                      <TableHead>Femmes de chambre</TableHead>
                      <TableHead>Chambres</TableHead>
                      <TableHead>Actions journal</TableHead>
                      <TableHead>Progrès</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => {
                      const totalRooms = getTotalRooms(report.room_data);
                      const completedRooms = getCompletedRooms(report.room_data);
                      const progressPercentage = totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;

                      return (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(parseISO(report.report_date), 'PPP', { locale: fr })}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {report.housekeeper_names.slice(0, 2).map((name: string, index: number) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                              {report.housekeeper_names.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{report.housekeeper_names.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <span className="text-sm">
                              {totalRooms} chambre{totalRooms > 1 ? 's' : ''}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              <ClipboardList className="h-3 w-3 mr-1" />
                              {report.action_log?.length || 0} actions
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{progressPercentage}%</span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewReport(report)}
                                className="flex items-center gap-1"
                                title="Voir le rapport"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadReport(report)}
                                className="flex items-center gap-1"
                                title="Télécharger PDF"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteReport(report.id)}
                                className="flex items-center gap-1 text-destructive hover:text-destructive"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              {reports.length === 0 ? (
                <>
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun rapport trouvé</h3>
                  <p className="text-muted-foreground mb-4">
                    Les rapports quotidiens générés apparaîtront ici
                  </p>
                  <Alert className="max-w-md mx-auto">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Générez votre premier rapport depuis la page principale pour le voir apparaître ici.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun résultat</h3>
                  <p className="text-muted-foreground">
                    Aucun rapport ne correspond à votre recherche "{searchTerm}"
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dialog pour visualiser un rapport */}
        <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Rapport du {selectedReport && format(parseISO(selectedReport.report_date), 'PPP', { locale: fr })}
              </DialogTitle>
            </DialogHeader>
            
            {selectedReport && (
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="summary">Résumé</TabsTrigger>
                  <TabsTrigger value="rooms">
                    Chambres ({getTotalRooms(selectedReport.room_data)})
                  </TabsTrigger>
                  <TabsTrigger value="journal">
                    Journal ({selectedReport.action_log?.length || 0})
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-4">
                  <TabsContent value="summary" className="m-0 space-y-6">
                    {/* Informations générales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {selectedReport.housekeeper_names.length}
                            </div>
                            <p className="text-sm text-muted-foreground">Femmes de chambre</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {getTotalRooms(selectedReport.room_data)}
                            </div>
                            <p className="text-sm text-muted-foreground">Chambres totales</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {getCompletedRooms(selectedReport.room_data)}
                            </div>
                            <p className="text-sm text-muted-foreground">Chambres terminées</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Détail des assignments */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Répartition des chambres</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {Object.entries(selectedReport.housekeeper_assignments).length > 0 ? (
                            Object.entries(selectedReport.housekeeper_assignments).map(([housekeeper, rooms]: [string, any]) => (
                              <div key={housekeeper} className="border rounded p-3">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  {housekeeper}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {Array.isArray(rooms) ? rooms.map((room: any, index: number) => (
                                    <Badge key={index} variant="outline">
                                      {room.room_number || room.number || room}
                                    </Badge>
                                  )) : (
                                    <span className="text-muted-foreground">Aucune chambre assignée</span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted-foreground text-center py-4">Aucune assignation enregistrée</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="rooms" className="m-0">
                    <Card>
                      <CardHeader>
                        <CardTitle>Détail des chambres nettoyées</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedReport.room_data?.length > 0 ? (
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Chambre</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Statut</TableHead>
                                  <TableHead>Nettoyée par</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedReport.room_data.map((room: any, index: number) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">
                                      {room.number || room.room_number || '-'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={room.cleaning_type === 'checkout' ? 'default' : 'secondary'}>
                                        {room.cleaning_type === 'checkout' ? 'À blanc' : 'Recouche'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {room.status === 'clean' ? (
                                        <Badge className="bg-green-100 text-green-800">✅ Propre</Badge>
                                      ) : room.status === 'in_progress' ? (
                                        <Badge className="bg-blue-100 text-blue-800">🔄 En cours</Badge>
                                      ) : (
                                        <Badge variant="outline">⏳ En attente</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {room.cleaned_by || room.assignedTo || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">Aucune donnée de chambre</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="journal" className="m-0">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5" />
                          Journal des actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedReport.action_log?.length > 0 ? (
                          <div className="space-y-3">
                            {selectedReport.action_log.map((log: ActionLog, index: number) => (
                              <div key={log.id || index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                                <div className="flex-shrink-0">
                                  <Badge className={getActionTypeColor(log.action_type)}>
                                    {getActionTypeLabel(log.action_type)}
                                  </Badge>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm">{log.description}</p>
                                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                    {log.created_at && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {format(parseISO(log.created_at), 'HH:mm', { locale: fr })}
                                      </span>
                                    )}
                                    {log.actor_name && (
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {log.actor_name}
                                      </span>
                                    )}
                                    {log.room_number && (
                                      <span className="font-medium">CH {log.room_number}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Aucune action enregistrée pour ce jour</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Reports;
