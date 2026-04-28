import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, FileText, ClipboardList, Users, Package, Loader2, Archive, ChevronDown, Home, AlertTriangle, MessageSquare, Sparkles, BedDouble, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArchivesTabProps {
  currentHotelId: string | null;
}

interface DailyReport {
  id: string;
  report_date: string;
  total_rooms_cleaned: number | null;
  total_hours_worked: number | null;
  notes: string | null;
  summary: any;
  room_data: any;
  created_at: string;
}

interface ArchivedLog {
  id: string;
  archive_date: string;
  logs_data: any;
  summary: any;
  created_at: string;
}

export const ArchivesTab: React.FC<ArchivesTabProps> = ({ currentHotelId }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [archivedLogs, setArchivedLogs] = useState<ArchivedLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'logs'>('reports');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [selectedLog, setSelectedLog] = useState<ArchivedLog | null>(null);

  // Charger les dates disponibles
  useEffect(() => {
    const loadAvailableDates = async () => {
      if (!currentHotelId) return;

      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);

      const [reportsRes, logsRes] = await Promise.all([
        supabase
          .from('daily_reports')
          .select('report_date')
          .eq('hotel_id', currentHotelId)
          .gte('report_date', format(start, 'yyyy-MM-dd'))
          .lte('report_date', format(end, 'yyyy-MM-dd')),
        supabase
          .from('archived_daily_logs')
          .select('archive_date')
          .eq('hotel_id', currentHotelId)
          .gte('archive_date', format(start, 'yyyy-MM-dd'))
          .lte('archive_date', format(end, 'yyyy-MM-dd'))
      ]);

      const dates = new Set<string>();
      (reportsRes.data || []).forEach((r: any) => dates.add(r.report_date));
      (logsRes.data || []).forEach((l: any) => dates.add(l.archive_date));

      setAvailableDates(Array.from(dates).map(d => parseISO(d)));
    };

    loadAvailableDates();
  }, [currentHotelId, selectedDate]);

  // Charger les données pour la date sélectionnée
  useEffect(() => {
    const loadArchiveData = async () => {
      if (!currentHotelId) return;

      setIsLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      try {
        const [reportsRes, logsRes] = await Promise.all([
          supabase
            .from('daily_reports')
            .select('*')
            .eq('hotel_id', currentHotelId)
            .eq('report_date', dateStr)
            .order('created_at', { ascending: false }),
          supabase
            .from('archived_daily_logs')
            .select('*')
            .eq('hotel_id', currentHotelId)
            .eq('archive_date', dateStr)
            .order('created_at', { ascending: false })
        ]);

        setDailyReports(reportsRes.data || []);
        setArchivedLogs(logsRes.data || []);

        // Sélectionner automatiquement le premier rapport
        if (reportsRes.data && reportsRes.data.length > 0) {
          setSelectedReport(reportsRes.data[0]);
        } else {
          setSelectedReport(null);
        }

        if (logsRes.data && logsRes.data.length > 0) {
          setSelectedLog(logsRes.data[0]);
        } else {
          setSelectedLog(null);
        }
      } catch (error) {
        console.error('Erreur chargement archives:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadArchiveData();
  }, [currentHotelId, selectedDate]);

  const hasDataForDate = (date: Date) => {
    return availableDates.some(d => isSameDay(d, date));
  };

  const getRoomStatus = (room: any) => {
    const status = room.status || room.cleaningStatus || '';
    const cleaned = status === 'clean' || status === 'cleaned' || status === 'done' || status === 'completed' || room.isCleaned === true;
    const notDone = status === 'dirty' || status === 'pending' || status === 'not_started' || status === 'assigned' || room.isCleaned === false;
    return { cleaned, notDone };
  };

  const getRoomBadgeClasses = (room: any) => {
    const { cleaned, notDone } = getRoomStatus(room);
    if (cleaned) return 'bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700';
    if (notDone) return 'bg-red-500/15 text-red-700 border-red-300 dark:text-red-400 dark:border-red-700';
    return 'bg-muted text-muted-foreground border-border';
  };

  const renderHousekeeperSummary = (summary: any) => {
    if (!summary) return null;

    const housekeepers = summary.housekeepers || summary.housekeeperSummary || [];
    if (!Array.isArray(housekeepers) || housekeepers.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Femmes de chambre
        </h4>
        <div className="grid gap-3">
          {housekeepers.map((hk: any, index: number) => {
            const rooms = hk.rooms || [];
            const totalRooms = rooms.length || hk.totalRooms || hk.roomsCleaned || hk.completed || 0;
            const cleanedCount = rooms.filter((r: any) => getRoomStatus(r).cleaned).length || hk.roomsCleaned || hk.completed || 0;
            const notDoneCount = rooms.filter((r: any) => getRoomStatus(r).notDone).length || 0;
            const progressPercent = totalRooms > 0 ? Math.round((cleanedCount / totalRooms) * 100) : 0;

            return (
              <Card key={index} className="p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{hk.name || hk.housekeeperName}</span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
                      ✓ {cleanedCount}
                    </Badge>
                    {notDoneCount > 0 && (
                      <Badge className="bg-red-500/15 text-red-700 border-red-300 dark:text-red-400 dark:border-red-700">
                        ✗ {notDoneCount}
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2 mb-2">
                  <div 
                    className={cn(
                      "h-2 rounded-full transition-all",
                      progressPercent === 100 ? "bg-emerald-500" : progressPercent > 0 ? "bg-amber-500" : "bg-red-400"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Progression : {cleanedCount}/{totalRooms} ({progressPercent}%)
                </p>
                {rooms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rooms.map((room: any, idx: number) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className={cn("text-xs", getRoomBadgeClasses(room))}
                      >
                        {room.number || room.room_number || room}
                      </Badge>
                    ))}
                  </div>
                )}
                {hk.remarks && hk.remarks.length > 0 && (
                  <Badge variant="secondary" className="mt-2">{hk.remarks.length} remarques</Badge>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRoomData = (roomData: any) => {
    if (!roomData) return null;

    const rooms = Array.isArray(roomData) ? roomData : roomData.rooms || [];
    if (rooms.length === 0) return null;

    const cleanedRooms = rooms.filter((r: any) => getRoomStatus(r).cleaned);
    const notDoneRooms = rooms.filter((r: any) => getRoomStatus(r).notDone);
    const otherRooms = rooms.filter((r: any) => !getRoomStatus(r).cleaned && !getRoomStatus(r).notDone);

    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Home className="h-4 w-4" />
          Chambres ({rooms.length})
        </h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-1 text-xs">
            <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-400" />
            Nettoyées ({cleanedRooms.length})
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="w-3 h-3 rounded bg-red-500/30 border border-red-400" />
            Non effectuées ({notDoneRooms.length})
          </div>
          {otherRooms.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="w-3 h-3 rounded bg-muted border border-border" />
              Autre ({otherRooms.length})
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {rooms.map((room: any, index: number) => (
            <Badge 
              key={index} 
              variant="outline"
              className={cn("justify-center py-1.5", getRoomBadgeClasses(room))}
            >
              {room.number || room.room_number}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const renderLinenInventory = (summary: any) => {
    const linen = summary?.linen_inventory || summary?.linenInventory;
    if (!linen) return null;

    const items = linen.items || linen;
    if (!Array.isArray(items) || items.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Package className="h-4 w-4" />
          Inventaire Linge
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {items.map((item: any, index: number) => (
            <Card key={index} className="p-2 bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="text-sm">{item.type || item.name}</span>
                <Badge variant="outline">{item.count || item.quantity || 0}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderActionLogs = (logsData: any) => {
    const logs = Array.isArray(logsData) ? logsData : logsData?.logs || [];
    if (logs.length === 0) {
      return <p className="text-muted-foreground text-center py-4">Aucune action enregistrée</p>;
    }

    return (
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {logs.map((log: any, index: number) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {log.action_type || log.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {log.created_at ? format(parseISO(log.created_at), 'HH:mm', { locale: fr }) : ''}
                  </span>
                </div>
                <p className="text-sm">{log.description || log.message}</p>
                {log.actor_name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Par: {log.actor_name} ({log.actor_type})
                  </p>
                )}
                {log.room_number && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Chambre {log.room_number}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  if (!currentHotelId) {
    return (
      <Card className="p-8 text-center">
        <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sélectionnez un hôtel pour voir les archives</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec sélection de date */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Archives
              </CardTitle>
              <CardDescription>
                Consultez les rapports et journaux d'actions des jours précédents
              </CardDescription>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full md:w-auto justify-start gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                  <ChevronDown className="h-4 w-4 ml-auto" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={fr}
                  modifiers={{
                    hasData: availableDates
                  }}
                  modifiersStyles={{
                    hasData: { 
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                      fontWeight: 'bold'
                    }
                  }}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Chargement des archives...</p>
        </Card>
      ) : dailyReports.length === 0 && archivedLogs.length === 0 ? (
        <Card className="p-8 text-center">
          <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Aucune archive pour cette date</h3>
          <p className="text-muted-foreground">
            Les archives sont créées lorsque vous clôturez la journée
          </p>
        </Card>
      ) : (
        <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              Rapports ({dailyReports.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Journal d'actions ({archivedLogs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-4 space-y-4">
            {dailyReports.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun rapport pour cette date</p>
              </Card>
            ) : (
              <>
                {/* Résumé global */}
                {selectedReport && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Rapport du {format(parseISO(selectedReport.report_date), 'd MMMM yyyy', { locale: fr })}
                      </CardTitle>
                      <div className="flex gap-4 mt-2">
                        <Badge variant="default" className="gap-1">
                          <Home className="h-3 w-3" />
                          {selectedReport.total_rooms_cleaned || 0} chambres nettoyées
                        </Badge>
                        {selectedReport.total_hours_worked && (
                          <Badge variant="secondary">
                            {selectedReport.total_hours_worked}h travaillées
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {renderHousekeeperSummary(selectedReport.summary)}
                      {renderRoomData(selectedReport.room_data)}
                      {renderLinenInventory(selectedReport.summary)}

                      {selectedReport.notes && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Notes</h4>
                          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                            {selectedReport.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-4 space-y-4">
            {archivedLogs.length === 0 ? (
              <Card className="p-8 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun journal d'actions pour cette date</p>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Journal d'actions du {format(selectedDate, 'd MMMM yyyy', { locale: fr })}
                  </CardTitle>
                  {selectedLog?.summary && (
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">
                        {selectedLog.summary.totalActions || 
                         (Array.isArray(selectedLog.logs_data) ? selectedLog.logs_data.length : 0)} actions
                      </Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedLog && renderActionLogs(selectedLog.logs_data)}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
