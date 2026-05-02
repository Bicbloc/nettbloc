import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { IncidentList } from '@/components/incident/IncidentList';
import { StaffManagement } from '@/components/incident/StaffManagement';
import { IncidentInventoryManager } from '@/components/incident/IncidentInventoryManager';
import { IncidentReportDialog } from '@/components/incident/IncidentReportDialog';
import { RolePermissionsManager } from '@/components/incident/RolePermissionsManager';

interface HotelOpt { id: string; name: string; hotel_code: string | null; }

export function IncidentsPanel() {
  const [hotels, setHotels] = useState<HotelOpt[]>([]);
  const [hotelId, setHotelId] = useState<string>('');

  useEffect(() => {
    supabase.from('hotels').select('id, name, hotel_code').order('name').then(({ data }) => {
      const list = data || [];
      setHotels(list);
      if (list.length > 0) setHotelId(list[0].id);
    });
  }, []);

  if (hotels.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Aucun hôtel disponible</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Label className="whitespace-nowrap">Hôtel :</Label>
          <Select value={hotelId} onValueChange={setHotelId}>
            <SelectTrigger className="w-72 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {hotels.map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name} ({h.hotel_code || '—'})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hotelId && <IncidentReportDialog hotelId={hotelId} userType="admin" />}
      </div>

      {hotelId && (
        <Tabs defaultValue="incidents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="staff">Personnel</TabsTrigger>
            <TabsTrigger value="inventory">Inventaire</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>
          <TabsContent value="incidents"><IncidentList hotelId={hotelId} /></TabsContent>
          <TabsContent value="staff"><StaffManagement hotelId={hotelId} /></TabsContent>
          <TabsContent value="inventory"><IncidentInventoryManager hotelId={hotelId} /></TabsContent>
          <TabsContent value="permissions"><RolePermissionsManager hotelId={hotelId} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default IncidentsPanel;
