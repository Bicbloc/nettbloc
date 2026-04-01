import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Check, X, ChevronLeft, Plus, Brain, Save, Play,
  AlertTriangle, Sparkles, RefreshCw, CheckCircle, ArrowRight
} from "lucide-react";
import { ExtractedRoom, CLEANING_TYPE_LABELS } from "@/services/pms";
import { TrainingData } from "./TrainingWizard";
import { pmsAdapterFactory, unifiedParserService } from "@/services/pms";
import { CleaningType } from "@/services/pms/types";
import { MappingConfig } from "./TrainingStep1bColumnMapping";

interface TrainingStep3ValidateProps {
  trainingData: TrainingData;
  hotelId: string;
  onBack: () => void;
  onReset: () => void;
}

const CLEANING_OPTIONS = [
  { value: 'full', label: 'À blanc', color: 'bg-orange-500' },
  { value: 'a_blanc', label: 'À blanc', color: 'bg-orange-500' },
  { value: 'quick', label: 'Recouche', color: 'bg-blue-500' },
  { value: 'recouche', label: 'Recouche', color: 'bg-blue-500' },
  { value: 'none', label: 'Aucun', color: 'bg-gray-400' },
];

function getCleaningLabel(type: string): string {
  if (type === 'full' || type === 'a_blanc') return 'À blanc';
  if (type === 'quick' || type === 'recouche') return 'Recouche';
  if (type === 'none') return 'Aucun';
  return 'Inconnu';
}

function getCleaningBadgeColor(type: string): string {
  if (type === 'full' || type === 'a_blanc') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (type === 'quick' || type === 'recouche') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (type === 'none') return 'bg-gray-100 text-gray-800 border-gray-200';
  return 'bg-yellow-100 text-yellow-800 border-yellow-200';
}

function extractContextKeywords(text: string): string[] {
  const upper = text.toUpperCase();
  const keywords: string[] = [];
  if (/\bDEP\b|DÉPART|DEPARTURE|CHECKOUT|C\/O/.test(upper)) keywords.push('DEPART');
  const lastNightMatch = upper.match(/NUIT\s*(\d+)\s*[\/\\]\s*(\d+)/) || upper.match(/(\d+)\s*[\/\\]\s*(\d+)\s*NUIT/);
  if (lastNightMatch && lastNightMatch[1] === lastNightMatch[2]) {
    keywords.push('DERNIERE_NUIT');
    if (!/\d{1,2}:\d{2}/.test(text)) keywords.push('NUIT_SANS_HORAIRE');
  }
  if (lastNightMatch && lastNightMatch[1] !== lastNightMatch[2]) keywords.push('NUIT_INTERMEDIAIRE');
  return keywords;
}

function buildContextPatterns(rooms: any[]): { [keyword: string]: CleaningType } {
  const patterns: { [keyword: string]: { count: number; cleaningType: CleaningType } } = {};
  for (const room of rooms) {
    const keywords = room.contextKeywords || [];
    const cleaningType = room.cleaningType as CleaningType;
    for (const keyword of keywords) {
      if (!patterns[keyword]) {
        patterns[keyword] = { count: 0, cleaningType };
      }
      if (patterns[keyword].cleaningType === cleaningType) {
        patterns[keyword].count++;
      } else {
        patterns[keyword].count--;
        if (patterns[keyword].count < 0) patterns[keyword] = { count: 1, cleaningType };
      }
    }
  }
  const result: { [keyword: string]: CleaningType } = {};
  for (const [keyword, data] of Object.entries(patterns)) result[keyword] = data.cleaningType;
  return result;
}

export const TrainingStep3Validate = ({
  trainingData,
  hotelId,
  onBack,
  onReset,
}: TrainingStep3ValidateProps) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<ExtractedRoom[]>(
    trainingData.extractedRooms.map(r => ({ ...r, validated: true }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newRoom, setNewRoom] = useState({ roomNumber: "", cleaningType: "full" });
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const isUpdate = !!trainingData.existingPatternId;

  const collator = useMemo(() => new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }), []);

  const sortedRooms = useMemo(() => {
    const indexed = rooms.map((room, index) => ({ room, index }));
    indexed.sort((a, b) => {
      const cmp = collator.compare(a.room.roomNumber, b.room.roomNumber);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return indexed;
  }, [rooms, sortOrder, collator]);

  const validatedCount = rooms.filter(r => r.validated).length;

  const stats = useMemo(() => {
    let full = 0, quick = 0, none = 0;
    for (const r of rooms) {
      if (r.cleaningType === 'full' || r.cleaningType === 'a_blanc') full++;
      else if (r.cleaningType === 'quick' || r.cleaningType === 'recouche') quick++;
      else if (r.cleaningType === 'none') none++;
    }
    return { total: rooms.length, full, quick, none };
  }, [rooms]);

  const toggleValidation = (idx: number) => {
    setRooms(prev => prev.map((r, i) => i === idx ? { ...r, validated: !r.validated } : r));
  };

  /**
   * Build a "combination signature" for a room based on its status, date pattern, and guest count.
   * Rooms with the same signature are considered similar.
   */
  const getRoomSignature = useCallback((room: ExtractedRoom): string => {
    const parts: string[] = [];
    
    // Status code (normalized)
    const status = (room.status || 'unknown').toLowerCase();
    parts.push(`s:${status}`);
    
    // Date pattern: has arrival, has departure, has both
    const hasArr = !!room.arrivalDate;
    const hasDep = !!room.departureDate;
    parts.push(`d:${hasArr ? 'A' : '_'}${hasDep ? 'D' : '_'}`);
    
    // Guest name count pattern (0, 1, 2+)
    const guestName = room.guestName || '';
    // Count distinct names by looking for "Name Surname" patterns separated by common delimiters
    const nameSegments = guestName.split(/\s*[\/,&]\s*|\s+(?:et|and|und)\s+/i).filter(s => s.trim().length > 2);
    const nameCount = nameSegments.length <= 1 ? (guestName.trim() ? '1' : '0') : '2+';
    parts.push(`g:${nameCount}`);
    
    // Night info pattern
    if (room.currentNight && room.totalNights) {
      const isLast = room.currentNight >= room.totalNights;
      parts.push(`n:${isLast ? 'last' : 'mid'}`);
    }
    
    // Time pattern
    const hasDepTime = !!room.departureTime;
    const hasArrTime = !!room.arrivalTime;
    if (hasDepTime || hasArrTime) {
      parts.push(`t:${hasArrTime ? 'A' : '_'}${hasDepTime ? 'D' : '_'}`);
    }
    
    return parts.join('|');
  }, []);

  const updateCleaningType = useCallback((idx: number, type: string) => {
    setRooms(prev => {
      const targetRoom = prev[idx];
      const targetSignature = getRoomSignature(targetRoom);
      
      // Find all rooms with the same signature and update them
      let propagatedCount = 0;
      const updated = prev.map((r, i) => {
        if (i === idx) return { ...r, cleaningType: type as any };
        // Only propagate to rooms that still have the SAME cleaning type as the original
        if (getRoomSignature(r) === targetSignature && r.cleaningType === targetRoom.cleaningType) {
          propagatedCount++;
          return { ...r, cleaningType: type as any };
        }
        return r;
      });
      
      if (propagatedCount > 0) {
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          toast({
            title: `${propagatedCount + 1} chambres mises à jour`,
            description: `Appliqué à toutes les chambres avec la même combinaison`,
          });
        }, 0);
      }
      
      return updated;
    });
  }, [getRoomSignature, toast]);

  const removeRoom = (idx: number) => {
    setRooms(prev => prev.filter((_, i) => i !== idx));
  };

  const addRoom = () => {
    if (!newRoom.roomNumber.trim()) return;
    setRooms(prev => [...prev, {
      roomNumber: newRoom.roomNumber.trim(),
      cleaningType: newRoom.cleaningType as any,
      status: 'unknown',
      arrivalDate: '',
      departureDate: '',
      validated: true,
      originalText: '',
    }]);
    setNewRoom({ roomNumber: "", cleaningType: "full" });
    setShowAddRoom(false);
    toast({ title: `Chambre ${newRoom.roomNumber} ajoutée` });
  };

  const saveTraining = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erreur", description: "Vous devez être connecté", variant: "destructive" });
        return;
      }

      const validatedRooms = rooms.filter(r => r.validated);
      const roomsToSave = validatedRooms.map(r => ({
        ...r,
        validated: true,
        contextKeywords: extractContextKeywords(r.originalText || ''),
      }));

      const contextPatterns = buildContextPatterns(roomsToSave);

      const patternData = {
        hotel_id: hotelId,
        report_name: trainingData.reportName,
        pms_type: trainingData.detectedPmsType,
        raw_text: trainingData.rawText.substring(0, 10000),
        extracted_data: roomsToSave as any,
        validated: true,
        created_by: user.id,
        updated_at: new Date().toISOString(),
        detection_rules: {
          connected_rooms: validatedRooms
            .filter(r => r.isConnected)
            .map(r => ({ pattern: r.roomNumber, rooms: r.linkedRooms })),
          contextPatterns,
        },
      };

      let error;
      if (isUpdate && trainingData.existingPatternId) {
        const result = await supabase
          .from("report_training_patterns")
          .update(patternData)
          .eq("id", trainingData.existingPatternId);
        error = result.error;
      } else {
        const result = await supabase
          .from("report_training_patterns")
          .insert([patternData]);
        error = result.error;
      }

      if (error) throw error;

      await unifiedParserService.loadHotelPatterns(hotelId);
      setSaved(true);
      toast({
        title: isUpdate ? "Entraînement mis à jour" : "Entraînement sauvegardé",
        description: `${validatedRooms.length} chambres enregistrées`,
      });
    } catch (error) {
      console.error("Erreur:", error);
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testExtraction = () => {
    if (!testText.trim()) {
      toast({ title: "Collez un extrait de rapport", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const detection = pmsAdapterFactory.detectPms(testText);
      const testRooms = detection.adapter.extractRooms(testText);
      setTestResult({
        pmsType: detection.detection.pmsType,
        confidence: detection.detection.confidence,
        roomsFound: testRooms.length,
        rooms: testRooms.slice(0, 10),
      });
      toast({ title: `${testRooms.length} chambres détectées` });
    } catch {
      toast({ title: "Erreur lors du test", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3 text-center bg-slate-50">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
        <Card className="p-3 text-center bg-orange-50">
          <p className="text-2xl font-bold text-orange-700">{stats.full}</p>
          <p className="text-xs text-orange-600">À blanc</p>
        </Card>
        <Card className="p-3 text-center bg-blue-50">
          <p className="text-2xl font-bold text-blue-700">{stats.quick}</p>
          <p className="text-xs text-blue-600">Recouche</p>
        </Card>
        <Card className="p-3 text-center bg-gray-50">
          <p className="text-2xl font-bold text-gray-700">{stats.none}</p>
          <p className="text-xs text-gray-600">Aucun</p>
        </Card>
      </div>

      {rooms.length === 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Aucune chambre détectée. Ajoutez des chambres manuellement ou retournez à l'étape précédente pour ajuster le mapping.
          </AlertDescription>
        </Alert>
      )}

      {/* Room Table */}
      <Card>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Chambres détectées ({rooms.length})</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
              {sortOrder === 'asc' ? '↑' : '↓'} Tri
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddRoom(!showAddRoom)} className="gap-1">
              <Plus className="h-3 w-3" />
              Ajouter
            </Button>
          </div>
        </div>

        {showAddRoom && (
          <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
            <Input
              placeholder="N° chambre"
              value={newRoom.roomNumber}
              onChange={(e) => setNewRoom(prev => ({ ...prev, roomNumber: e.target.value }))}
              className="w-28"
              onKeyDown={(e) => e.key === 'Enter' && addRoom()}
            />
            <Select value={newRoom.cleaningType} onValueChange={(v) => setNewRoom(prev => ({ ...prev, cleaningType: v }))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">À blanc</SelectItem>
                <SelectItem value="quick">Recouche</SelectItem>
                <SelectItem value="none">Aucun</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addRoom}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        )}

        <ScrollArea className="h-[350px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">✓</TableHead>
                <TableHead className="w-20">Chambre</TableHead>
                <TableHead className="w-28">Nettoyage</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRooms.map(({ room, index }) => (
                <TableRow key={index} className={!room.validated ? 'opacity-50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={room.validated}
                      onCheckedChange={() => toggleValidation(index)}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-bold">{room.roomNumber}</TableCell>
                  <TableCell>
                    <Select
                      value={room.cleaningType === 'a_blanc' ? 'full' : room.cleaningType === 'recouche' ? 'quick' : room.cleaningType}
                      onValueChange={(v) => updateCleaningType(index, v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">À blanc</SelectItem>
                        <SelectItem value="quick">Recouche</SelectItem>
                        <SelectItem value="none">Aucun</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {room.status || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs truncate max-w-[120px]">
                    {room.guestName || '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRoom(index)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Save */}
      {!saved ? (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4" />
                {isUpdate ? "Mettre à jour l'entraînement" : "Sauvegarder l'entraînement"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {validatedCount} chambres validées seront enregistrées
              </p>
            </div>
            <Button onClick={saveTraining} disabled={saving || validatedCount === 0} className="gap-2">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Sauvegarder
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 border-green-500/50 bg-green-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <h4 className="font-semibold text-green-700">Entraînement sauvegardé !</h4>
              <p className="text-sm text-green-600">{validatedCount} chambres enregistrées</p>
            </div>
          </div>
        </Card>
      )}

      {/* Test Zone */}
      {saved && (
        <Card className="p-6">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Play className="w-4 h-4" />
            Tester l'extraction
          </h4>
          <Textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Collez un extrait de rapport pour vérifier..."
            className="min-h-[80px] mb-3 font-mono text-sm"
          />
          <Button onClick={testExtraction} disabled={testing} variant="outline" className="w-full gap-2">
            {testing ? "Test en cours..." : "Lancer le test"}
          </Button>

          {testResult && (
            <div className="mt-3 p-3 bg-muted rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span>PMS:</span>
                <Badge>{testResult.pmsType.toUpperCase()}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Chambres:</span>
                <Badge variant="outline">{testResult.roomsFound}</Badge>
              </div>
              {testResult.rooms.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t">
                  {testResult.rooms.map((r: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {r.roomNumber} ({getCleaningLabel(r.cleaningType)})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Retour
        </Button>
        {saved && (
          <Button variant="outline" onClick={onReset} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Nouvel entraînement
          </Button>
        )}
      </div>
    </div>
  );
};
