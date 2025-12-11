/**
 * ReportAnalyzer v2 - Interface améliorée avec 2 panneaux
 * - Aperçu du texte avec highlighting
 * - Filtres et recherche
 * - Sélection multiple et correction groupée
 * - Export CSV
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Calendar, Loader2, Check, AlertTriangle, Sparkles, RefreshCw, 
  Download, FileText, Search, Filter, Copy, CheckSquare, Square
} from "lucide-react";
import { format, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { localRoomParser, ParsedRoom } from "@/services/pms/LocalRoomParser";
import { getCleaningTypeLabel, normalizeCleaningType } from "@/utils/cleaningTypeUtils";
import type { NormalizedCleaningType } from "@/services/pms/types";

interface ReportAnalyzerProps {
  rawText: string;
  hotelId: string;
  userId: string;
  reportName: string;
  onRoomsExtracted: (rooms: any[]) => void;
}

type CleaningOption = 'a_blanc' | 'recouche' | 'none';
type FilterType = 'all' | 'a_blanc' | 'recouche' | 'none';

export const ReportAnalyzer = ({
  rawText,
  hotelId,
  userId,
  reportName,
  onRoomsExtracted
}: ReportAnalyzerProps) => {
  // États principaux
  const [reportDate, setReportDate] = useState<string>('');
  const [reportDateInput, setReportDateInput] = useState<string>('');
  const [detectedPms, setDetectedPms] = useState<string>('');
  const [rooms, setRooms] = useState<ParsedRoom[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUsingAi, setIsUsingAi] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // États pour filtres et sélection
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [highlightedRoom, setHighlightedRoom] = useState<string | null>(null);

  // Extraction automatique de la date
  useEffect(() => {
    const extractedDate = localRoomParser.extractReportDate(rawText);
    const dateStr = format(extractedDate, 'dd/MM/yyyy');
    setReportDate(dateStr);
    setReportDateInput(dateStr);
  }, [rawText]);

  // Filtrer les chambres
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Filtre par type
      if (filterType !== 'all' && room.cleaningType !== filterType) {
        return false;
      }
      // Filtre par recherche
      if (searchQuery && !room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [rooms, filterType, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    aBlanc: rooms.filter(r => r.cleaningType === 'a_blanc').length,
    recouche: rooms.filter(r => r.cleaningType === 'recouche').length,
    aucun: rooms.filter(r => r.cleaningType === 'none').length,
    total: rooms.length
  }), [rooms]);

  // Analyser le rapport
  const analyzeReport = useCallback(async (useAi: boolean = false) => {
    setIsAnalyzing(true);
    setIsUsingAi(useAi);
    setSelectedRooms(new Set());

    try {
      let reportDateObj: Date;
      try {
        const parts = reportDateInput.split('/');
        reportDateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (!isValid(reportDateObj)) throw new Error();
      } catch {
        reportDateObj = new Date();
        toast.error("Date invalide, utilisation de la date du jour");
      }

      if (useAi) {
        const { data, error } = await supabase.functions.invoke('parse-report', {
          body: { text: rawText, reportDate: reportDateInput, hotelId }
        });

        if (error) {
          if (error.message?.includes('402') || error.message?.includes('credits')) {
            toast.warning("Crédits IA insuffisants");
            return;
          }
          throw error;
        }

        if (data?.rooms?.length > 0) {
          const normalizedRooms = data.rooms.map((r: any) => ({
            ...r,
            cleaningType: normalizeCleaningType(r.cleaningType)
          }));
          setRooms(normalizedRooms);
          setConfidence(data.confidence || 85);
          setDetectedPms(data.pmsType || 'unknown');
          toast.success(`${normalizedRooms.length} chambres extraites (IA)`);
        }
      } else {
        const result = localRoomParser.parseReport(rawText, reportDateObj);
        setRooms(result.rooms);
        setConfidence(result.confidence);
        setDetectedPms(result.detectedPms);
        
        if (result.rooms.length > 0) {
          toast.success(`${result.rooms.length} chambres extraites`);
        } else {
          toast.info("Aucune chambre détectée. Essayez l'analyse IA.");
        }
      }

      setHasAnalyzed(true);
    } catch (error) {
      console.error('Erreur analyse:', error);
      toast.error("Erreur lors de l'analyse");
    } finally {
      setIsAnalyzing(false);
      setIsUsingAi(false);
    }
  }, [rawText, reportDateInput, hotelId]);

  // Correction d'une chambre
  const handleCorrection = useCallback(async (roomNumber: string, newType: CleaningOption) => {
    setRooms(prev => prev.map(room => {
      if (room.roomNumber === roomNumber) {
        return {
          ...room,
          cleaningType: newType as NormalizedCleaningType,
          reason: `Corrigé → ${getCleaningTypeLabel(newType)}`,
          confidence: 100
        };
      }
      return room;
    }));

    try {
      await supabase.from('hotel_cleaning_rules').upsert({
        hotel_id: hotelId,
        rule_name: `correction_${roomNumber}_${Date.now()}`,
        conditions: { roomNumber, context: 'manual_correction' },
        result_cleaning_type: newType,
        result_status: newType === 'none' ? 'clean' : newType === 'a_blanc' ? 'checkout' : 'stayover',
        priority: 100,
        is_active: true,
        created_by: userId
      });
    } catch (e) {
      console.error('Erreur sauvegarde:', e);
    }
  }, [hotelId, userId]);

  // Correction groupée
  const handleBulkCorrection = useCallback(async (newType: CleaningOption) => {
    if (selectedRooms.size === 0) {
      toast.error("Aucune chambre sélectionnée");
      return;
    }

    setRooms(prev => prev.map(room => {
      if (selectedRooms.has(room.roomNumber)) {
        return {
          ...room,
          cleaningType: newType as NormalizedCleaningType,
          reason: `Correction groupée → ${getCleaningTypeLabel(newType)}`,
          confidence: 100
        };
      }
      return room;
    }));

    toast.success(`${selectedRooms.size} chambres corrigées`);
    setSelectedRooms(new Set());
  }, [selectedRooms]);

  // Toggle sélection
  const toggleRoomSelection = useCallback((roomNumber: string) => {
    setSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomNumber)) {
        next.delete(roomNumber);
      } else {
        next.add(roomNumber);
      }
      return next;
    });
  }, []);

  // Sélectionner/Désélectionner tout
  const toggleSelectAll = useCallback(() => {
    if (selectedRooms.size === filteredRooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(filteredRooms.map(r => r.roomNumber)));
    }
  }, [filteredRooms, selectedRooms]);

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = ['Chambre', 'Type', 'Statut', 'Nuit', 'Départ', 'Client', 'Raison'];
    const rows = rooms.map(r => [
      r.roomNumber,
      r.cleaningType === 'a_blanc' ? 'À Blanc' : r.cleaningType === 'recouche' ? 'Recouche' : 'Aucun',
      r.status,
      r.nightInfo || '',
      r.departureDate || '',
      r.guestName || '',
      r.reason
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport_${reportDateInput.replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  }, [rooms, reportDateInput]);

  // Copier liste
  const copyToClipboard = useCallback(() => {
    const text = rooms.map(r => 
      `${r.roomNumber}: ${r.cleaningType === 'a_blanc' ? 'À Blanc' : r.cleaningType === 'recouche' ? 'Recouche' : 'Aucun'}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    toast.success("Liste copiée");
  }, [rooms]);

  // Valider les chambres
  const validateRooms = useCallback(() => {
    if (rooms.length === 0) {
      toast.error("Aucune chambre à valider");
      return;
    }

    const formattedRooms = rooms.map(room => ({
      roomNumber: room.roomNumber,
      cleaningType: room.cleaningType,
      status: room.status,
      nightInfo: room.nightInfo,
      departureDate: room.departureDate,
      arrivalDate: room.arrivalDate,
      guestName: room.guestName,
      confidence: room.confidence,
      detectionReason: room.reason
    }));

    onRoomsExtracted(formattedRooms);
    toast.success(`${rooms.length} chambres validées`);
  }, [rooms, onRoomsExtracted]);

  // Highlight le texte brut
  const highlightedText = useMemo(() => {
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      const room = rooms.find(r => line.includes(r.roomNumber));
      const isHighlighted = highlightedRoom && line.includes(highlightedRoom);
      return { line, room, isHighlighted, idx };
    });
  }, [rawText, rooms, highlightedRoom]);

  // Badge pour type de nettoyage
  const getTypeBadge = (type: NormalizedCleaningType) => {
    const config = {
      a_blanc: { label: '🔴 À Blanc', className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30' },
      recouche: { label: '🟡 Recouche', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' },
      none: { label: '✅ Aucun', className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' }
    };
    return config[type] || config.none;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Analyseur de Rapport v2
          </CardTitle>
          
          {/* Date et badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                value={reportDateInput}
                onChange={(e) => setReportDateInput(e.target.value)}
                className="w-28 h-7 text-sm"
                placeholder="JJ/MM/AAAA"
              />
            </div>
            {detectedPms && (
              <Badge variant="secondary" className="text-xs">PMS: {detectedPms.toUpperCase()}</Badge>
            )}
            {hasAnalyzed && (
              <Badge variant={confidence >= 80 ? "default" : "secondary"} className="text-xs">
                {confidence.toFixed(0)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Actions principales */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            <Button onClick={() => analyzeReport(false)} disabled={isAnalyzing} size="sm">
              {isAnalyzing && !isUsingAi ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Local
            </Button>
            <Button onClick={() => analyzeReport(true)} disabled={isAnalyzing} variant="outline" size="sm">
              {isAnalyzing && isUsingAi ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              IA
            </Button>
          </div>
          
          {rooms.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={copyToClipboard} variant="ghost" size="sm" title="Copier">
                <Copy className="h-4 w-4" />
              </Button>
              <Button onClick={exportCSV} variant="ghost" size="sm" title="Export CSV">
                <Download className="h-4 w-4" />
              </Button>
              <Button onClick={validateRooms} size="sm">
                <Check className="h-4 w-4 mr-1" />
                Valider ({rooms.length})
              </Button>
            </div>
          )}
        </div>

        {/* Stats rapides */}
        {rooms.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Badge 
              variant={filterType === 'all' ? 'default' : 'outline'} 
              className="cursor-pointer"
              onClick={() => setFilterType('all')}
            >
              Tous: {stats.total}
            </Badge>
            <Badge 
              variant={filterType === 'a_blanc' ? 'default' : 'outline'} 
              className={`cursor-pointer ${filterType === 'a_blanc' ? 'bg-red-500' : 'bg-red-500/20 text-red-700 dark:text-red-300'}`}
              onClick={() => setFilterType(filterType === 'a_blanc' ? 'all' : 'a_blanc')}
            >
              🔴 À Blanc: {stats.aBlanc}
            </Badge>
            <Badge 
              variant={filterType === 'recouche' ? 'default' : 'outline'} 
              className={`cursor-pointer ${filterType === 'recouche' ? 'bg-yellow-500' : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'}`}
              onClick={() => setFilterType(filterType === 'recouche' ? 'all' : 'recouche')}
            >
              🟡 Recouche: {stats.recouche}
            </Badge>
            <Badge 
              variant={filterType === 'none' ? 'default' : 'outline'} 
              className={`cursor-pointer ${filterType === 'none' ? 'bg-green-500' : 'bg-green-500/20 text-green-700 dark:text-green-300'}`}
              onClick={() => setFilterType(filterType === 'none' ? 'all' : 'none')}
            >
              ✅ Aucun: {stats.aucun}
            </Badge>
          </div>
        )}

        {/* Layout 2 panneaux */}
        {hasAnalyzed && rooms.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Panneau gauche: Aperçu texte */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-sm font-medium border-b flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Aperçu du rapport
              </div>
              <ScrollArea className="h-[400px]">
                <div className="p-2 font-mono text-xs space-y-0.5">
                  {highlightedText.map(({ line, room, isHighlighted, idx }) => (
                    <div
                      key={idx}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-primary/30 ring-1 ring-primary' :
                        room ? (
                          room.cleaningType === 'a_blanc' ? 'bg-red-500/10 hover:bg-red-500/20' :
                          room.cleaningType === 'recouche' ? 'bg-yellow-500/10 hover:bg-yellow-500/20' :
                          'bg-green-500/10 hover:bg-green-500/20'
                        ) : 'hover:bg-muted/50'
                      }`}
                      onClick={() => room && setHighlightedRoom(room.roomNumber === highlightedRoom ? null : room.roomNumber)}
                    >
                      <span className="text-muted-foreground mr-2">{String(idx + 1).padStart(3, ' ')}</span>
                      {room && <span className="font-bold">{room.roomNumber}</span>}
                      {line.replace(room?.roomNumber || '', '')}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Panneau droit: Résultats */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-sm font-medium border-b flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Résultats ({filteredRooms.length})
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-7 w-32 pl-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Barre de sélection groupée */}
              {selectedRooms.size > 0 && (
                <div className="bg-primary/10 px-3 py-2 border-b flex items-center justify-between gap-2">
                  <span className="text-sm">{selectedRooms.size} sélectionnée(s)</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleBulkCorrection('a_blanc')}>
                      🔴 À Blanc
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleBulkCorrection('recouche')}>
                      🟡 Recouche
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleBulkCorrection('none')}>
                      ✅ Aucun
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="h-[350px]">
                <div className="divide-y">
                  {/* Header */}
                  <div className="grid grid-cols-[24px_60px_90px_1fr_80px] gap-2 px-3 py-2 bg-muted/30 text-xs font-medium sticky top-0">
                    <div className="flex items-center">
                      <Checkbox
                        checked={selectedRooms.size === filteredRooms.length && filteredRooms.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </div>
                    <div>Ch.</div>
                    <div>Type</div>
                    <div>Raison</div>
                    <div>Action</div>
                  </div>

                  {/* Rows */}
                  {filteredRooms.map((room) => {
                    const badge = getTypeBadge(room.cleaningType);
                    const isSelected = selectedRooms.has(room.roomNumber);
                    const isHighlit = highlightedRoom === room.roomNumber;

                    return (
                      <div 
                        key={room.roomNumber}
                        className={`grid grid-cols-[24px_60px_90px_1fr_80px] gap-2 px-3 py-2 text-sm items-center hover:bg-muted/30 transition-colors ${
                          isHighlit ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : ''
                        }`}
                        onMouseEnter={() => setHighlightedRoom(room.roomNumber)}
                        onMouseLeave={() => setHighlightedRoom(null)}
                      >
                        <div>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRoomSelection(room.roomNumber)}
                          />
                        </div>
                        <div className="font-medium">{room.roomNumber}</div>
                        <div>
                          <Badge variant="outline" className={`text-xs ${badge.className}`}>
                            {badge.label}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate" title={room.reason}>
                          {room.nightInfo && <span className="mr-1">🌙{room.nightInfo}</span>}
                          {room.reason}
                        </div>
                        <div>
                          <Select
                            value={room.cleaningType}
                            onValueChange={(v) => handleCorrection(room.roomNumber, v as CleaningOption)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="a_blanc">🔴 À Blanc</SelectItem>
                              <SelectItem value="recouche">🟡 Recouche</SelectItem>
                              <SelectItem value="none">✅ Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* État initial / pas de résultats */}
        {!hasAnalyzed && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Cliquez sur "Local" ou "IA" pour analyser</p>
            <p className="text-xs mt-1">{rawText.split('\n').length} lignes détectées</p>
          </div>
        )}

        {hasAnalyzed && rooms.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucune chambre détectée</p>
            <p className="text-xs mt-1">Essayez l'analyse IA</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
