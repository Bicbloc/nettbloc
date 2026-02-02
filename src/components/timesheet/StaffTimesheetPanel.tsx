import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Clock, 
  Download, 
  CalendarDays, 
  Users, 
  Home,
  ArrowUpDown,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from "date-fns";
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

export function StaffTimesheetPanel({ hotelId }: StaffTimesheetPanelProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState('day');
  const [staffFilter, setStaffFilter] = useState('all');

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
  const { data: timesheets, isLoading } = useQuery({
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

  // Export to CSV
  const exportToCSV = () => {
    if (!timesheets || timesheets.length === 0) return;

    const headers = ['Date', 'Type', 'Nom', 'Début', 'Fin', 'Pause (min)', 'Durée', 'Chambres', 'Recouches', 'Départs'];
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
    });

    return Object.values(grouped).sort((a, b) => b.totalMinutes - a.totalMinutes);
  };

  const staffSummary = groupByStaff();

  return (
    <div className="space-y-4">
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
                        <Badge variant="secondary" className="text-xs">
                          R: {staff.recouche} | B: {staff.depart}
                        </Badge>
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
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead className="text-center">Chambres</TableHead>
                      <TableHead className="text-center">R</TableHead>
                      <TableHead className="text-center">B</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheets.map(ts => (
                      <TableRow key={ts.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(ts.work_date), 'dd/MM', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {ts.staff_type === 'housekeeper' ? 'FdC' : ts.staff_type === 'governess' ? 'Gouv' : 'Tech'}
                            </Badge>
                            {ts.staff_name}
                          </div>
                        </TableCell>
                        <TableCell>{formatTime(ts.start_time)}</TableCell>
                        <TableCell>{formatTime(ts.end_time)}</TableCell>
                        <TableCell>{calculateDuration(ts.start_time, ts.end_time, ts.break_minutes)}</TableCell>
                        <TableCell className="text-center font-medium">{ts.rooms_cleaned || 0}</TableCell>
                        <TableCell className="text-center text-blue-600">{ts.rooms_recouche || 0}</TableCell>
                        <TableCell className="text-center text-amber-600">{ts.rooms_depart || 0}</TableCell>
                      </TableRow>
                    ))}
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
    </div>
  );
}
