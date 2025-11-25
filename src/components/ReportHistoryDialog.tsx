import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Calendar, FileText, AlertTriangle, Eye, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SessionPersistenceService } from '@/services/sessionPersistenceService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface DailyReport {
  id: string;
  report_date: string;
  room_data: any[];
  summary: {
    total_rooms: number;
    completed_rooms: number;
    housekeeper_assignments: Record<string, string>;
    uploaded_reports?: any[];
    incidents?: any[];
    archived_at?: string;
  };
  notes?: string;
}

interface ReportHistoryDialogProps {
  hotelId: string;
  onRestore?: () => void;
}

export function ReportHistoryDialog({ hotelId, onRestore }: ReportHistoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadReports();
    }
  }, [isOpen, hotelId]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('report_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des rapports:', error);
      toast.error('Impossible de charger l\'historique');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreReport = async () => {
    if (!selectedReport) return;
    
    setIsRestoring(true);
    try {
      const success = await SessionPersistenceService.restoreFromArchive(selectedReport.id);
      
      if (success) {
        toast.success('Rapport restauré avec succès !');
        setShowRestoreDialog(false);
        setIsOpen(false);
        
        if (onRestore) {
          onRestore();
        }
        
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error('Impossible de restaurer le rapport');
      }
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      toast.error('Erreur lors de la restauration');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <History className="h-4 w-4" />
            Historique
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Historique des rapports journaliers</DialogTitle>
            <DialogDescription>
              Consultez et restaurez les rapports archivés des journées précédentes
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucun rapport archivé pour le moment</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {reports.map((report) => (
                  <Card key={report.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(report.report_date), 'EEEE d MMMM yyyy', { locale: fr })}
                          </CardTitle>
                          {report.summary.archived_at && (
                            <CardDescription>
                              Archivé le {format(new Date(report.summary.archived_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Détails
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedReport(report);
                              setShowRestoreDialog(true);
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Restaurer
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Chambres totales</p>
                          <p className="text-2xl font-bold">{report.summary.total_rooms || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Chambres terminées</p>
                          <p className="text-2xl font-bold text-green-600">
                            {report.summary.completed_rooms || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Rapports uploadés</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {report.summary.uploaded_reports?.length || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Incidents</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {report.summary.incidents?.length || 0}
                          </p>
                        </div>
                      </div>

                      {report.notes && (
                        <>
                          <Separator className="my-3" />
                          <p className="text-sm text-muted-foreground">{report.notes}</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}

          {selectedReport && !showRestoreDialog && (
            <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    Détails du {format(new Date(selectedReport.report_date), 'd MMMM yyyy', { locale: fr })}
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {/* Affectations des femmes de chambre */}
                    {Object.keys(selectedReport.summary.housekeeper_assignments).length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Affectations des femmes de chambre</h3>
                        <div className="space-y-1">
                          {Object.entries(selectedReport.summary.housekeeper_assignments).map(([name, rooms]) => (
                            <div key={name} className="flex justify-between text-sm">
                              <span>{name}</span>
                              <Badge variant="secondary">{rooms}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rapports uploadés */}
                    {selectedReport.summary.uploaded_reports && selectedReport.summary.uploaded_reports.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Rapports uploadés ({selectedReport.summary.uploaded_reports.length})
                        </h3>
                        <div className="space-y-2">
                          {selectedReport.summary.uploaded_reports.map((report: any, idx: number) => (
                            <Card key={idx}>
                              <CardContent className="p-3">
                                <p className="text-sm font-medium">{report.name || `Rapport ${idx + 1}`}</p>
                                <p className="text-xs text-muted-foreground">
                                  {report.uploaded_at && format(new Date(report.uploaded_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Incidents */}
                    {selectedReport.summary.incidents && selectedReport.summary.incidents.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Incidents ({selectedReport.summary.incidents.length})
                        </h3>
                        <div className="space-y-2">
                          {selectedReport.summary.incidents.map((incident: any, idx: number) => (
                            <Card key={idx}>
                              <CardContent className="p-3">
                                <p className="text-sm font-medium">{incident.title || 'Incident'}</p>
                                <p className="text-xs text-muted-foreground">{incident.description}</p>
                                {incident.created_at && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(incident.created_at), 'dd/MM/yyyy HH:mm')}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Données des chambres */}
                    {selectedReport.room_data && selectedReport.room_data.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Chambres ({selectedReport.room_data.length})</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {selectedReport.room_data.map((room: any, idx: number) => (
                            <Badge key={idx} variant={room.status === 'completed' ? 'default' : 'secondary'}>
                              {room.room_number || `Chambre ${idx + 1}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de restauration */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer ce rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va :
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remplacer les données actuelles par celles du rapport archivé</li>
                <li>Restaurer les chambres, affectations, rapports et incidents</li>
                <li>Créer une nouvelle session avec ces données</li>
              </ul>
              <p className="mt-4 font-semibold text-destructive">
                Les données actuelles non sauvegardées seront perdues.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreReport} disabled={isRestoring}>
              {isRestoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restauration...
                </>
              ) : (
                'Confirmer la restauration'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
