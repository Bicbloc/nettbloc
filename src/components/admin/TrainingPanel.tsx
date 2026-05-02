import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { ReportTrainingPanel } from '@/components/ReportTrainingPanel';

export function TrainingPanel() {
  const [hotels, setHotels] = useState<{ id: string; name: string; hotel_code: string | null }[]>([]);
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
        <AlertDescription>Aucun hôtel disponible pour l'entraînement IA</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
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
      {hotelId && <ReportTrainingPanel hotelId={hotelId} />}
    </div>
  );
}

export default TrainingPanel;
