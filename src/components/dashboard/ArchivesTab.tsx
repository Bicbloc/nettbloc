import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, FileText, ClipboardList, Users, Package, Loader2, Archive, ChevronDown, Home, AlertTriangle, MessageSquare, Sparkles, BedDouble, XCircle, Download, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const [incidents, setIncidents] = useState<any[]>([]);
  const [breakfastLogs, setBreakfastLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'logs'>('reports');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [selectedLog, setSelectedLog] = useState<ArchivedLog | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `archive-${dateStr}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(exportRef.current)
        .save();
      toast.success('PDF téléchargé');
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Charger les dates disponibles
  useEffect(() => {
    const loadAvailableDates = async () => {
      if (!currentHotelId) return;

      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);

      const [reportsRes, logsRes, breakfastRes] = await Promise.all([
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
          .lte('archive_date', format(end, 'yyyy-MM-dd')),
        supabase
          .from('breakfast_logs')
          .select('log_date')
          .eq('hotel_id', currentHotelId)
          .gte('log_date', format(start, 'yyyy-MM-dd'))
          .lte('log_date', format(end, 'yyyy-MM-dd'))
      ]);

      const dates = new Set<string>();
      (reportsRes.data || []).forEach((r: any) => dates.add(r.report_date));
      (logsRes.data || []).forEach((l: any) => dates.add(l.archive_date));
      (breakfastRes.data || []).forEach((b: any) => dates.add(b.log_date));

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
        const [reportsRes, logsRes, incidentsRes, breakfastRes] = await Promise.all([
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
            .order('created_at', { ascending: false }),
          supabase
            .from('incidents')
            .select('*')
            .eq('hotel_id', currentHotelId)
            .gte('created_at', dateStr + 'T00:00:00')
            .lte('created_at', dateStr + 'T23:59:59')
            .order('created_at', { ascending: false }),
          supabase
            .from('breakfast_logs')
            .select('*')
            .eq('hotel_id', currentHotelId)
            .eq('log_date', dateStr)
            .order('room_number', { ascending: true })
        ]);

        setDailyReports(reportsRes.data || []);
        setArchivedLogs(logsRes.data || []);
        setIncidents(incidentsRes.data || []);
        setBreakfastLogs(breakfastRes.data || []);

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

  // Détermine le type de nettoyage d'une chambre
  const getCleaningType = (room: any): 'a_blanc' | 'recouche' | 'none' | 'unknown' => {
    const t = (room.cleaning_type || room.cleaningType || '').toLowerCase();
    if (t === 'a_blanc' || t === 'full' || t === 'checkout') return 'a_blanc';
    if (t === 'recouche' || t === 'quick' || t === 'stayover') return 'recouche';
    if (t === 'none') return 'none';
    return 'unknown';
  };

  const cleaningTypeLabel = (t: string) => {
    if (t === 'a_blanc') return 'À blanc';
    if (t === 'recouche') return 'Recouche';
    if (t === 'none') return 'Sans nettoyage';
    return 'Autre';
  };

  const cleaningTypeBadgeClasses = (t: string) => {
    if (t === 'a_blanc') return 'bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-400 dark:border-blue-700';
    if (t === 'recouche') return 'bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700';
    if (t === 'none') return 'bg-muted text-muted-foreground border-border';
    return 'bg-muted text-muted-foreground border-border';
  };

  // Reconstruit la liste des femmes de chambre depuis summary.assignments + room_data
  const buildHousekeepersFromSummary = (report: DailyReport | null) => {
    if (!report) return [] as any[];
    const summary = report.summary || {};
    const roomData = Array.isArray(report.room_data) ? report.room_data : (report.room_data?.rooms || []);
    const roomById: Record<string, any> = {};
    const roomByNumber: Record<string, any> = {};
    roomData.forEach((r: any) => {
      if (r.id) roomById[r.id] = r;
      const num = r.room_number || r.number;
      if (num) roomByNumber[String(num)] = r;
    });

    // Format moderne: summary.assignments = { housekeeperName: [{room_number, room_id, status, ...}] }
    const assignments = summary.assignments;
    if (assignments && typeof assignments === 'object' && !Array.isArray(assignments)) {
      return Object.entries(assignments).map(([name, list]: [string, any]) => ({
        name,
        rooms: (Array.isArray(list) ? list : []).map((a: any) => {
          const fullRoom = (a.room_id && roomById[a.room_id]) || roomByNumber[String(a.room_number)] || {};
          return {
            ...fullRoom,
            room_number: a.room_number || fullRoom.room_number,
            status: a.status || fullRoom.status,
            cleaning_type: fullRoom.cleaning_type || a.cleaning_type,
          };
        }),
      }));
    }

    // Fallback ancien format
    const housekeepers = summary.housekeepers || summary.housekeeperSummary || [];
    return Array.isArray(housekeepers) ? housekeepers : [];
  };

  const renderHousekeeperSummary = (report: DailyReport | null) => {
    const housekeepers = buildHousekeepersFromSummary(report);
    if (housekeepers.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Femmes de chambre
        </h4>
        <div className="grid gap-3">
          {housekeepers.map((hk: any, index: number) => {
            const rooms = hk.rooms || [];
            const totalRooms = rooms.length;
            const cleanedCount = rooms.filter((r: any) => getRoomStatus(r).cleaned).length;
            const notDoneCount = rooms.filter((r: any) => getRoomStatus(r).notDone).length;
            const aBlanc = rooms.filter((r: any) => getCleaningType(r) === 'a_blanc');
            const recouche = rooms.filter((r: any) => getCleaningType(r) === 'recouche');
            const progressPercent = totalRooms > 0 ? Math.round((cleanedCount / totalRooms) * 100) : 0;

            return (
              <Card key={index} className="p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="font-medium">{hk.name || hk.housekeeperName}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cleaningTypeBadgeClasses('a_blanc')}>
                      <Sparkles className="h-3 w-3 mr-1" />À blanc : {aBlanc.length}
                    </Badge>
                    <Badge className={cleaningTypeBadgeClasses('recouche')}>
                      <BedDouble className="h-3 w-3 mr-1" />Recouche : {recouche.length}
                    </Badge>
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
                    {rooms.map((room: any, idx: number) => {
                      const ct = getCleaningType(room);
                      const { cleaned, notDone } = getRoomStatus(room);
                      return (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={cn(
                            "text-xs",
                            cleaned ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700'
                            : notDone ? 'bg-red-500/15 text-red-700 border-red-300 dark:text-red-400 dark:border-red-700'
                            : cleaningTypeBadgeClasses(ct)
                          )}
                          title={cleaningTypeLabel(ct)}
                        >
                          {room.room_number || room.number}
                          {ct === 'a_blanc' && ' ⚪'}
                          {ct === 'recouche' && ' 🔄'}
                        </Badge>
                      );
                    })}
                  </div>
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

    // Groupes par type de nettoyage + statut "non nettoyé"
    const aBlancRooms = rooms.filter((r: any) => getCleaningType(r) === 'a_blanc');
    const recoucheRooms = rooms.filter((r: any) => getCleaningType(r) === 'recouche');
    const notDoneRooms = rooms.filter((r: any) => getRoomStatus(r).notDone);
    const aBlancCleaned = aBlancRooms.filter((r: any) => getRoomStatus(r).cleaned);
    const recoucheCleaned = recoucheRooms.filter((r: any) => getRoomStatus(r).cleaned);

    const Section = ({ title, icon, rooms: list, color, accent, borderColor, bgColor }: any) => {
      if (list.length === 0) return null;
      return (
        <Card className={cn("p-4 border-l-4", borderColor, bgColor)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              {icon}
              {title}
            </div>
            <Badge className={cn("text-base px-3 py-1", accent)}>{list.length}</Badge>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {list.map((room: any, idx: number) => (
              <Badge
                key={idx}
                variant="outline"
                className={cn("justify-center py-1.5 font-medium", color)}
              >
                {room.room_number || room.number}
              </Badge>
            ))}
          </div>
        </Card>
      );
    };

    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Home className="h-4 w-4" />
          Chambres ({rooms.length})
        </h4>
        <div className="grid gap-3">
          <Section
            title={`À blanc — Nettoyées (${aBlancCleaned.length}/${aBlancRooms.length})`}
            icon={<Sparkles className="h-5 w-5 text-blue-600" />}
            rooms={aBlancRooms}
            color={cleaningTypeBadgeClasses('a_blanc')}
            accent="bg-blue-600 text-white border-blue-700"
            borderColor="border-l-blue-500"
            bgColor="bg-blue-50/50 dark:bg-blue-950/20"
          />
          <Section
            title={`Recouches (${recoucheCleaned.length}/${recoucheRooms.length})`}
            icon={<BedDouble className="h-5 w-5 text-amber-600" />}
            rooms={recoucheRooms}
            color={cleaningTypeBadgeClasses('recouche')}
            accent="bg-amber-600 text-white border-amber-700"
            borderColor="border-l-amber-500"
            bgColor="bg-amber-50/50 dark:bg-amber-950/20"
          />
          <Section
            title={`Non nettoyées (${notDoneRooms.length})`}
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            rooms={notDoneRooms}
            color="bg-red-500/15 text-red-700 border-red-300 dark:text-red-400 dark:border-red-700"
            accent="bg-red-600 text-white border-red-700"
            borderColor="border-l-red-500"
            bgColor="bg-red-50/50 dark:bg-red-950/20"
          />
        </div>
      </div>
    );
  };

  const priorityColor = (p: string) => {
    if (p === 'urgent' || p === 'critical') return 'bg-red-500/15 text-red-700 border-red-300 dark:text-red-400 dark:border-red-700';
    if (p === 'high') return 'bg-orange-500/15 text-orange-700 border-orange-300 dark:text-orange-400 dark:border-orange-700';
    if (p === 'medium' || p === 'normal') return 'bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700';
    return 'bg-muted text-muted-foreground border-border';
  };

  const renderIncidents = () => {
    if (!incidents || incidents.length === 0) return null;
    // Tri par priorité
    const order: Record<string, number> = { urgent: 0, critical: 0, high: 1, medium: 2, normal: 2, low: 3 };
    const sorted = [...incidents].sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          Incidents signalés ({incidents.length})
        </h4>
        <div className="space-y-2">
          {sorted.map((inc) => (
            <Card key={inc.id} className="p-3 bg-muted/30">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={priorityColor(inc.priority)}>{inc.priority || 'normal'}</Badge>
                    <Badge variant="outline" className="text-xs">{inc.status}</Badge>
                    {inc.location_reference && (
                      <Badge variant="secondary" className="text-xs">
                        {inc.location_type === 'room' ? `Chambre ${inc.location_reference}` : inc.location_reference}
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm">{inc.title}</p>
                  {inc.description && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{inc.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {inc.reported_by_name && `Signalé par ${inc.reported_by_name} • `}
                    {format(parseISO(inc.created_at), 'HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderComments = (summary: any) => {
    if (!summary) return null;
    const remarks = summary.remarks || summary.notifications || [];
    // Combiner remarks et notifications type "remark"/"comment"
    const all: any[] = [];
    (summary.remarks || []).forEach((r: any) => all.push({ ...r, _kind: 'remark' }));
    (summary.notifications || []).forEach((n: any) => {
      if (n.type === 'remark' || n.type === 'comment' || n.type === 'note') {
        // Éviter doublon si déjà dans remarks
        const exists = (summary.remarks || []).some((r: any) =>
          r.description === n.description && r.created_at === n.created_at
        );
        if (!exists) all.push({ ...n, _kind: 'notification' });
      }
    });

    if (all.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          Commentaires ({all.length})
        </h4>
        <div className="space-y-2">
          {all.map((c, idx) => (
            <Card key={idx} className="p-3 bg-muted/30">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {c.room_number && (
                  <Badge variant="secondary" className="text-xs">Chambre {c.room_number}</Badge>
                )}
                {c.housekeeper_name && (
                  <Badge variant="outline" className="text-xs">{c.housekeeper_name}</Badge>
                )}
                {c.created_at && (
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(c.created_at), 'HH:mm', { locale: fr })}
                  </span>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.description || c.title}</p>
            </Card>
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

  const renderBreakfast = () => {
    if (!breakfastLogs || breakfastLogs.length === 0) return null;
    const billable = breakfastLogs.filter((b) => !b.included);
    const totalPeople = breakfastLogs.reduce((sum, b) => sum + (b.people_count || 0), 0);
    const totalAmount = billable.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          Petits-déjeuners ({breakfastLogs.length})
        </h4>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary">{totalPeople} couverts</Badge>
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
            {totalAmount.toFixed(2)} € facturés
          </Badge>
        </div>
        <div className="space-y-2">
          {breakfastLogs.map((b) => (
            <Card key={b.id} className="p-3 bg-muted/30">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {b.room_number && (
                    <Badge variant="secondary" className="text-xs">Chambre {b.room_number}</Badge>
                  )}
                  <span className="text-sm font-medium">{b.people_count || 0} pers.</span>
                  {b.breakfast_type && (
                    <Badge variant="outline" className="text-xs">{b.breakfast_type}</Badge>
                  )}
                  {b.included ? (
                    <Badge variant="outline" className="text-xs">Inclus</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 text-xs">
                      {Number(b.total_amount || 0).toFixed(2)} €
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {b.source || ''}{b.created_at ? ` • ${format(parseISO(b.created_at), 'HH:mm', { locale: fr })}` : ''}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
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

            <Button
              variant="default"
              className="gap-2"
              onClick={handleExportPdf}
              disabled={isExporting || (dailyReports.length === 0 && incidents.length === 0 && breakfastLogs.length === 0)}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Télécharger PDF
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Chargement des archives...</p>
        </Card>
      ) : dailyReports.length === 0 && archivedLogs.length === 0 && incidents.length === 0 && breakfastLogs.length === 0 ? (
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
            <div ref={exportRef} className="space-y-4 bg-background p-2">
            {dailyReports.length === 0 ? (
              <>
                <Card className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucun rapport pour cette date</p>
                </Card>
                {incidents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Incidents du jour</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderIncidents()}
                    </CardContent>
                  </Card>
                )}
                {breakfastLogs.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Petits-déjeuners du jour</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderBreakfast()}
                    </CardContent>
                  </Card>
                )}
              </>
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
                      {renderRoomData(selectedReport.room_data)}
                      {renderHousekeeperSummary(selectedReport)}
                      {renderIncidents()}
                      {renderComments(selectedReport.summary)}
                      {renderLinenInventory(selectedReport.summary)}
                      {renderBreakfast()}

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
            </div>
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
