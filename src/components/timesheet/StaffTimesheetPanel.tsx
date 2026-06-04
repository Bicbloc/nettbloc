import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Clock, 
  Download, 
  CalendarDays, 
  Users, 
  Home,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  Edit2,
  XCircle,
  AlertCircle,
  User,
  StopCircle,
  PlayCircle
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface StaffTimesheetPanelProps {
  hotelId: string;
}

interface Timesheet {
  id: string;
  staff_type: string;
  staff_name: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  rooms_cleaned: number;
  rooms_recouche: number;
  rooms_depart: number;
  rooms_inspected: number;
  notes: string | null;
  status: string;
  validated_at: string | null;
  validated_by_name: string | null;
  modified_at: string | null;
  modified_by_name: string | null;
  original_start_time: string | null;
  original_end_time: string | null;
}

const STAFF_TYPES = [
  { value: 'all', label: 'Tous', icon: Users },
  { value: 'housekeeper', label: 'Femmes de chambre', icon: Home },
  { value: 'governess', label: 'Gouvernantes', icon: Users },
  { value: 'technician', label: 'Techniciens', icon: Users },
];

const VIEW_MODES = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'En cours', color: 'bg-emerald-100 text-emerald-800', icon: PlayCircle },
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  validated: { label: 'Validé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  modified: { label: 'Modifié', color: 'bg-blue-100 text-blue-800', icon: Edit2 },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-800', icon: XCircle },
  not_clocked: { label: 'Non pointé', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeStaffName = (value?: string | null) => (value || '').trim().toLowerCase();

export function StaffTimesheetPanel({ hotelId }: StaffTimesheetPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState('day');
  const [staffFilter, setStaffFilter] = useState('all');
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [editForm, setEditForm] = useState({
    start_time: '',
    end_time: '',
    break_minutes: 0,
    rooms_cleaned: 0,
    rooms_recouche: 0,
    rooms_depart: 0,
    notes: '',
  });

  // Fetch current user name (admin or sub-account)
  const { data: currentUserName } = useQuery({
    queryKey: ["current-user-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return 'Admin';
      
      // Check if sub-account first
      const { data: subAccount } = await supabase
        .from('sub_accounts')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (subAccount) {
        return `${subAccount.first_name} ${subAccount.last_name}`.trim();
      }
      
      // Otherwise use email or Admin
      return user.email?.split('@')[0] || 'Admin';
    },
    enabled: !!user?.id,
  });

  // Calculate date range based on view mode
  const getDateRange = () => {
    switch (viewMode) {
      case 'week':
        return {
          start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
          end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate),
        };
      default:
        return {
          start: selectedDate,
          end: selectedDate,
        };
    }
  };

  const dateRange = getDateRange();

  // Fetch timesheets
  const { data: timesheets, isLoading, refetch } = useQuery({
    queryKey: ["staff-timesheets", hotelId, format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd'), staffFilter],
    queryFn: async () => {
      let query = supabase
        .from("staff_timesheets")
        .select("*")
        .eq("hotel_id", hotelId)
        .gte("work_date", format(dateRange.start, 'yyyy-MM-dd'))
        .lte("work_date", format(dateRange.end, 'yyyy-MM-dd'))
        .order("work_date", { ascending: false })
        .order("staff_name");

      if (staffFilter !== 'all') {
        query = query.eq("staff_type", staffFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Timesheet[];
    },
  });

  // Femmes de chambre affectées pour la journée sélectionnée (vue Jour uniquement).
  // Permet d'afficher une ligne même si la personne n'a pas pointé via son interface.
  const { data: assignedHousekeepers = [] } = useQuery({
    queryKey: ["assigned-housekeepers-timesheet", hotelId, format(selectedDate, 'yyyy-MM-dd')],
    enabled: viewMode === 'day' && !!hotelId,
    queryFn: async () => {
      const dayStart = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('assignments')
        .select('housekeeper_name, housekeeper_id, assigned_at')
        .eq('hotel_id', hotelId)
        .gte('assigned_at', `${dayStart}T00:00:00`)
        .lte('assigned_at', `${dayStart}T23:59:59.999`);
      if (error) throw error;
      const seen = new Map<string, { housekeeper_name: string; housekeeper_id: string | null }>();
      (data || []).forEach((a: any) => {
        const key = normalizeStaffName(a.housekeeper_name);
        if (a.housekeeper_name && !seen.has(key)) {
          seen.set(key, { housekeeper_name: a.housekeeper_name, housekeeper_id: a.housekeeper_id });
        }
      });
      return Array.from(seen.values());
    },
  });

  // Liste affichée = pointages réels + lignes virtuelles pour les FdC affectées non pointées
  const mergedTimesheets: Timesheet[] = (() => {
    const base = timesheets ? [...timesheets] : [];
    if (viewMode !== 'day') return base;
    if (staffFilter !== 'all' && staffFilter !== 'housekeeper') return base;

    const workDate = format(selectedDate, 'yyyy-MM-dd');
    const existingNames = new Set(
      base
        .filter((t) => t.staff_type === 'housekeeper')
        .map((t) => normalizeStaffName(t.staff_name))
    );

    const placeholders = assignedHousekeepers
      .filter((a) => !existingNames.has(normalizeStaffName(a.housekeeper_name)))
      .map((a) => ({
        id: `virtual-${normalizeStaffName(a.housekeeper_name)}`,
        staff_type: 'housekeeper',
        staff_name: a.housekeeper_name,
        work_date: workDate,
        start_time: null,
        end_time: null,
        break_minutes: 0,
        rooms_cleaned: 0,
        rooms_recouche: 0,
        rooms_depart: 0,
        rooms_inspected: 0,
        notes: null,
        status: 'not_clocked',
        validated_at: null,
        validated_by_name: null,
        modified_at: null,
        modified_by_name: null,
        original_start_time: null,
        original_end_time: null,
        _housekeeper_id: a.housekeeper_id,
      })) as any[];

    return [...base, ...placeholders];
  })();

  // Calculate totals
  const calculateTotals = () => {
    if (!timesheets) return { totalHours: 0, totalRooms: 0, totalRecouche: 0, totalDepart: 0 };

    let totalMinutes = 0;
    let totalRooms = 0;
    let totalRecouche = 0;
    let totalDepart = 0;

    timesheets.forEach(ts => {
      if (ts.start_time && ts.end_time) {
        const start = new Date(ts.start_time);
        const end = new Date(ts.end_time);
        totalMinutes += (end.getTime() - start.getTime()) / 60000 - (ts.break_minutes || 0);
      }
      totalRooms += ts.rooms_cleaned || 0;
      totalRecouche += ts.rooms_recouche || 0;
      totalDepart += ts.rooms_depart || 0;
    });

    return {
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      totalRooms,
      totalRecouche,
      totalDepart,
    };
  };

  const totals = calculateTotals();

  // Format time for display
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    try {
      return format(parseISO(isoString), 'HH:mm');
    } catch {
      return '-';
    }
  };

  // Calculate work duration
  const calculateDuration = (start: string | null, end: string | null, breakMins: number = 0) => {
    if (!start || !end) return '-';
    try {
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      const minutes = (endDate.getTime() - startDate.getTime()) / 60000 - breakMins;
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`;
    } catch {
      return '-';
    }
  };

  // Handle edit dialog open
  const handleEdit = (timesheet: Timesheet) => {
    setEditingTimesheet(timesheet);
    setEditForm({
      start_time: timesheet.start_time ? format(parseISO(timesheet.start_time), 'HH:mm') : '',
      end_time: timesheet.end_time ? format(parseISO(timesheet.end_time), 'HH:mm') : '',
      break_minutes: timesheet.break_minutes || 0,
      rooms_cleaned: timesheet.rooms_cleaned || 0,
      rooms_recouche: timesheet.rooms_recouche || 0,
      rooms_depart: timesheet.rooms_depart || 0,
      notes: timesheet.notes || '',
    });
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingTimesheet || !user?.id) return;

    try {
      const workDate = editingTimesheet.work_date;
      
      // Build full timestamps
      const startTime = editForm.start_time 
        ? new Date(`${workDate}T${editForm.start_time}:00`).toISOString()
        : null;
      const endTime = editForm.end_time 
        ? new Date(`${workDate}T${editForm.end_time}:00`).toISOString()
        : null;

      const isVirtual = editingTimesheet.id.startsWith('virtual-');

      if (isVirtual) {
        // Aucune ligne de pointage n'existe encore : on la crée pour la FdC affectée.
        const housekeeperId = (editingTimesheet as any)._housekeeper_id;
        const profileId = housekeeperId && UUID_REGEX.test(housekeeperId) ? housekeeperId : null;
        const { error } = await supabase
          .from('staff_timesheets')
          .insert({
            hotel_id: hotelId,
            staff_type: editingTimesheet.staff_type,
            staff_name: editingTimesheet.staff_name,
            housekeeper_profile_id: profileId,
            work_date: workDate,
            start_time: startTime,
            end_time: endTime,
            break_minutes: editForm.break_minutes,
            rooms_cleaned: editForm.rooms_cleaned,
            rooms_recouche: editForm.rooms_recouche,
            rooms_depart: editForm.rooms_depart,
            notes: editForm.notes,
            status: 'modified',
            modified_at: new Date().toISOString(),
            modified_by: user.id,
            modified_by_name: currentUserName || 'Admin',
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('staff_timesheets')
          .update({
            start_time: startTime,
            end_time: endTime,
            break_minutes: editForm.break_minutes,
            rooms_cleaned: editForm.rooms_cleaned,
            rooms_recouche: editForm.rooms_recouche,
            rooms_depart: editForm.rooms_depart,
            notes: editForm.notes,
            status: 'modified',
            modified_at: new Date().toISOString(),
            modified_by: user.id,
            modified_by_name: currentUserName || 'Admin',
            original_start_time: editingTimesheet.original_start_time || editingTimesheet.start_time,
            original_end_time: editingTimesheet.original_end_time || editingTimesheet.end_time,
          })
          .eq('id', editingTimesheet.id);
        if (error) throw error;
      }

      toast({
        title: "Pointage modifié",
        description: `Les modifications ont été enregistrées par ${currentUserName}`,
      });
      
      setEditingTimesheet(null);
      refetch();
    } catch (error) {
      console.error('Erreur modification:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le pointage",
        variant: "destructive",
      });
    }
  };

  // Handle validate
  const handleValidate = async (timesheet: Timesheet) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('staff_timesheets')
        .update({
          status: 'validated',
          validated_at: new Date().toISOString(),
          validated_by: user.id,
          validated_by_name: currentUserName || 'Admin',
        })
        .eq('id', timesheet.id);

      if (error) throw error;

      toast({
        title: "Pointage validé",
        description: `Validé par ${currentUserName}`,
      });
      
      refetch();
    } catch (error) {
      console.error('Erreur validation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de valider le pointage",
        variant: "destructive",
      });
    }
  };

  // Handle reject
  const handleReject = async (timesheet: Timesheet) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('staff_timesheets')
        .update({
          status: 'rejected',
          validated_at: new Date().toISOString(),
          validated_by: user.id,
          validated_by_name: currentUserName || 'Admin',
        })
        .eq('id', timesheet.id);

      if (error) throw error;

      toast({
        title: "Pointage rejeté",
        description: `Rejeté par ${currentUserName}`,
      });
      
      refetch();
    } catch (error) {
      console.error('Erreur rejet:', error);
      toast({
        title: "Erreur",
        description: "Impossible de rejeter le pointage",
        variant: "destructive",
      });
    }
  };

  // Handle end shift (admin stops a running timesheet)
  const handleEndShift = async (timesheet: Timesheet) => {
    if (!user?.id) return;

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('staff_timesheets')
        .update({
          end_time: now,
          status: 'pending',
          modified_at: now,
          modified_by: user.id,
          modified_by_name: currentUserName || 'Admin',
          notes: (timesheet.notes ? timesheet.notes + '\n' : '') + `Fin de pointage par ${currentUserName || 'Admin'} le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`,
        })
        .eq('id', timesheet.id);

      if (error) throw error;

      // Log to activity journal
      supabase.from("daily_action_logs").insert({
        hotel_id: hotelId,
        action_type: "timesheet_ended_by_admin",
        description: `Pointage de ${timesheet.staff_name} clôturé par ${currentUserName || 'Admin'}`,
        actor_name: currentUserName || 'Admin',
        actor_type: 'admin',
      }).then(() => {});

      toast({
        title: "Pointage clôturé",
        description: `Le pointage de ${timesheet.staff_name} a été terminé par ${currentUserName}`,
      });
      
      refetch();
    } catch (error) {
      console.error('Erreur fin pointage:', error);
      toast({
        title: "Erreur",
        description: "Impossible de clôturer le pointage",
        variant: "destructive",
      });
    }
  };

  // Handle end shift and validate in one step
  const handleEndAndValidate = async (timesheet: Timesheet) => {
    if (!user?.id) return;

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('staff_timesheets')
        .update({
          end_time: now,
          status: 'validated',
          validated_at: now,
          validated_by: user.id,
          validated_by_name: currentUserName || 'Admin',
          modified_at: now,
          modified_by: user.id,
          modified_by_name: currentUserName || 'Admin',
          notes: (timesheet.notes ? timesheet.notes + '\n' : '') + `Clôturé et validé par ${currentUserName || 'Admin'} le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`,
        })
        .eq('id', timesheet.id);

      if (error) throw error;

      // Log to activity journal
      supabase.from("daily_action_logs").insert({
        hotel_id: hotelId,
        action_type: "timesheet_ended_validated",
        description: `Pointage de ${timesheet.staff_name} clôturé et validé par ${currentUserName || 'Admin'}`,
        actor_name: currentUserName || 'Admin',
        actor_type: 'admin',
      }).then(() => {});

      toast({
        title: "Pointage clôturé et validé",
        description: `Le pointage de ${timesheet.staff_name} a été terminé et validé`,
      });
      
      refetch();
    } catch (error) {
      console.error('Erreur fin + validation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de clôturer et valider le pointage",
        variant: "destructive",
      });
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!timesheets || timesheets.length === 0) return;

    const headers = ['Date', 'Type', 'Nom', 'Début', 'Fin', 'Pause (min)', 'Durée', 'Chambres', 'Recouches', 'Départs', 'Statut', 'Validé par'];
    const rows = timesheets.map(ts => [
      format(parseISO(ts.work_date), 'dd/MM/yyyy'),
      ts.staff_type === 'housekeeper' ? 'FdC' : ts.staff_type === 'governess' ? 'Gouv' : 'Tech',
      ts.staff_name,
      formatTime(ts.start_time),
      formatTime(ts.end_time),
      ts.break_minutes || 0,
      calculateDuration(ts.start_time, ts.end_time, ts.break_minutes),
      ts.rooms_cleaned || 0,
      ts.rooms_recouche || 0,
      ts.rooms_depart || 0,
      STATUS_LABELS[ts.status]?.label || ts.status,
      ts.validated_by_name || ts.modified_by_name || '',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pointages_${format(dateRange.start, 'yyyy-MM-dd')}_${format(dateRange.end, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Group by staff for summary
  const groupByStaff = () => {
    if (!timesheets) return [];

    const grouped: Record<string, {
      name: string;
      type: string;
      totalMinutes: number;
      rooms: number;
      recouche: number;
      depart: number;
      days: number;
      pendingCount: number;
      validatedCount: number;
    }> = {};

    timesheets.forEach(ts => {
      const key = `${ts.staff_type}_${ts.staff_name}`;
      if (!grouped[key]) {
        grouped[key] = {
          name: ts.staff_name,
          type: ts.staff_type,
          totalMinutes: 0,
          rooms: 0,
          recouche: 0,
          depart: 0,
          days: 0,
          pendingCount: 0,
          validatedCount: 0,
        };
      }

      if (ts.start_time && ts.end_time) {
        const start = parseISO(ts.start_time);
        const end = parseISO(ts.end_time);
        grouped[key].totalMinutes += (end.getTime() - start.getTime()) / 60000 - (ts.break_minutes || 0);
      }
      grouped[key].rooms += ts.rooms_cleaned || 0;
      grouped[key].recouche += ts.rooms_recouche || 0;
      grouped[key].depart += ts.rooms_depart || 0;
      grouped[key].days += 1;
      if (ts.status === 'pending') grouped[key].pendingCount += 1;
      if (ts.status === 'validated') grouped[key].validatedCount += 1;
    });

    return Object.values(grouped).sort((a, b) => b.totalMinutes - a.totalMinutes);
  };

  const staffSummary = groupByStaff();
  const pendingCount = timesheets?.filter(t => t.status === 'pending' || (!t.end_time && t.start_time)).length || 0;
  const activeCount = timesheets?.filter(t => !t.end_time && t.start_time).length || 0;

  return (
    <div className="space-y-4">
      {/* Pending Alert */}
      {(pendingCount > 0 || activeCount > 0) && (
        <div className="space-y-2">
          {activeCount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-emerald-600 animate-pulse" />
              <span className="text-sm text-emerald-800">
                <strong>{activeCount}</strong> pointage{activeCount > 1 ? 's' : ''} en cours — vous pouvez y mettre fin
              </span>
            </div>
          )}
          {timesheets?.filter(t => t.status === 'pending').length! > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                <strong>{timesheets?.filter(t => t.status === 'pending').length}</strong> pointage{(timesheets?.filter(t => t.status === 'pending').length || 0) > 1 ? 's' : ''} en attente de validation
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              {viewMode === 'day' ? format(selectedDate, 'dd/MM/yyyy', { locale: fr }) :
               viewMode === 'week' ? `Sem. ${format(selectedDate, 'w', { locale: fr })}` :
               format(selectedDate, 'MMMM yyyy', { locale: fr })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={fr}
            />
          </PopoverContent>
        </Popover>

        <Select value={viewMode} onValueChange={setViewMode}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEW_MODES.map(mode => (
              <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAFF_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                <span className="flex items-center gap-2">
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={exportToCSV} disabled={!timesheets?.length}>
          <Download className="h-4 w-4 mr-1" />
          Exporter CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-sm text-muted-foreground">Heures totales</div>
            <div className="text-2xl font-bold">{totals.totalHours}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-sm text-muted-foreground">Chambres nettoyées</div>
            <div className="text-2xl font-bold">{totals.totalRooms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-sm text-muted-foreground">Recouches</div>
            <div className="text-2xl font-bold text-blue-600">{totals.totalRecouche}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-sm text-muted-foreground">Départs (À blanc)</div>
            <div className="text-2xl font-bold text-amber-600">{totals.totalDepart}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : timesheets && timesheets.length > 0 ? (
        <div className="space-y-4">
          {/* Staff Summary (for week/month view) */}
          {viewMode !== 'day' && staffSummary.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Résumé par personnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {staffSummary.map((staff, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {staff.type === 'housekeeper' ? 'FdC' : staff.type === 'governess' ? 'Gouv' : 'Tech'}
                        </Badge>
                        <span className="font-medium">{staff.name}</span>
                        <span className="text-xs text-muted-foreground">({staff.days} jour{staff.days > 1 ? 's' : ''})</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.round(staff.totalMinutes / 60 * 10) / 10}h
                        </span>
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3" />
                          {staff.rooms} ch.
                        </span>
                        {staff.pendingCount > 0 && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            {staff.pendingCount} en attente
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Détail des pointages</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead className="text-center">Ch.</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Validé par</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheets.map(ts => {
                      const isActive = !ts.end_time && !!ts.start_time;
                      const effectiveStatus = isActive ? 'active' : ts.status;
                      const statusInfo = STATUS_LABELS[effectiveStatus] || STATUS_LABELS.pending;
                      const StatusIcon = statusInfo.icon;
                      const canValidate = effectiveStatus === 'pending' || effectiveStatus === 'modified';
                      
                      return (
                        <TableRow key={ts.id} className={
                          isActive ? 'bg-emerald-50/50' : 
                          ts.status === 'pending' ? 'bg-yellow-50/50' : ''
                        }>
                          <TableCell className="whitespace-nowrap">
                            {format(parseISO(ts.work_date), 'dd/MM', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {ts.staff_type === 'housekeeper' ? 'FdC' : ts.staff_type === 'governess' ? 'Gouv' : 'Tech'}
                              </Badge>
                              {ts.staff_name}
                              {isActive && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{formatTime(ts.start_time)}</span>
                              {ts.original_start_time && ts.original_start_time !== ts.start_time && (
                                <span className="text-xs text-muted-foreground line-through">
                                  {formatTime(ts.original_start_time)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              {isActive ? (
                                <span className="text-emerald-600 font-medium">En cours...</span>
                              ) : (
                                <>
                                  <span>{formatTime(ts.end_time)}</span>
                                  {ts.original_end_time && ts.original_end_time !== ts.end_time && (
                                    <span className="text-xs text-muted-foreground line-through">
                                      {formatTime(ts.original_end_time)}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isActive ? (
                              <span className="text-emerald-600 text-sm">⏱ actif</span>
                            ) : (
                              calculateDuration(ts.start_time, ts.end_time, ts.break_minutes)
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-medium">{ts.rooms_cleaned || 0}</span>
                              <span className="text-xs text-muted-foreground">
                                R:{ts.rooms_recouche || 0} B:{ts.rooms_depart || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusInfo.color} flex items-center gap-1 w-fit`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(ts.validated_by_name || ts.modified_by_name) && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {ts.modified_by_name || ts.validated_by_name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isActive ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEndShift(ts)}
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    title="Mettre fin au pointage"
                                  >
                                    <StopCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEndAndValidate(ts)}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Clôturer et valider"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(ts)}
                                    title="Modifier"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  {canValidate && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleValidate(ts)}
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                        title="Valider"
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleReject(ts)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Rejeter"
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="p-8">
          <div className="text-center text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucun pointage pour cette période</p>
            <p className="text-sm">Les pointages sont enregistrés automatiquement lorsque le personnel commence et termine son travail</p>
          </div>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingTimesheet} onOpenChange={(open) => !open && setEditingTimesheet(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le pointage</DialogTitle>
          </DialogHeader>
          
          {editingTimesheet && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">{editingTimesheet.staff_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(editingTimesheet.work_date), 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Heure de début</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Heure de fin</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="break_minutes">Pause (minutes)</Label>
                <Input
                  id="break_minutes"
                  type="number"
                  min="0"
                  value={editForm.break_minutes}
                  onChange={(e) => setEditForm({ ...editForm, break_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rooms_cleaned">Chambres</Label>
                  <Input
                    id="rooms_cleaned"
                    type="number"
                    min="0"
                    value={editForm.rooms_cleaned}
                    onChange={(e) => setEditForm({ ...editForm, rooms_cleaned: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rooms_recouche">Recouches</Label>
                  <Input
                    id="rooms_recouche"
                    type="number"
                    min="0"
                    value={editForm.rooms_recouche}
                    onChange={(e) => setEditForm({ ...editForm, rooms_recouche: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rooms_depart">Départs</Label>
                  <Input
                    id="rooms_depart"
                    type="number"
                    min="0"
                    value={editForm.rooms_depart}
                    onChange={(e) => setEditForm({ ...editForm, rooms_depart: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Remarques sur ce pointage..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTimesheet(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit}>
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
