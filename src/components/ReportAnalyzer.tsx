/**
 * ReportAnalyzer - Composant unifié simplifié pour l'analyse des rapports
 * Workflow: Date → Parsing local → Résultats → Corrections rapides
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Calendar, Loader2, Check, AlertTriangle, Sparkles, RefreshCw, Download, FileText } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
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

export const ReportAnalyzer = ({
  rawText,
  hotelId,
  userId,
  reportName,
  onRoomsExtracted
}: ReportAnalyzerProps) => {
  // États
  const [reportDate, setReportDate] = useState<string>('');
  const [reportDateInput, setReportDateInput] = useState<string>('');
  const [detectedPms, setDetectedPms] = useState<string>('');
  const [rooms, setRooms] = useState<ParsedRoom[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUsingAi, setIsUsingAi] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Extraction automatique de la date au chargement
  useEffect(() => {
    const extractedDate = localRoomParser.extractReportDate(rawText);
    const dateStr = format(extractedDate, 'dd/MM/yyyy');
    setReportDate(dateStr);
    setReportDateInput(dateStr);
  }, [rawText]);

  // Analyser le rapport (local d'abord)
  const analyzeReport = useCallback(async (useAi: boolean = false) => {
    setIsAnalyzing(true);
    setIsUsingAi(useAi);

    try {
      // Parser la date
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
        // Fallback IA
        const { data, error } = await supabase.functions.invoke('parse-report', {
          body: { 
            text: rawText, 
            reportDate: reportDateInput,
            hotelId 
          }
        });

        if (error) {
          if (error.message?.includes('402') || error.message?.includes('credits')) {
            toast.warning("Crédits IA insuffisants", {
              description: "Utilisez l'analyse locale"
            });
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
        // Parsing local
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

  // Correction rapide d'une chambre
  const handleCorrection = useCallback(async (roomNumber: string, newType: CleaningOption) => {
    setRooms(prev => {
      const updated = prev.map(room => {
        if (room.roomNumber === roomNumber) {
          return {
            ...room,
            cleaningType: newType as NormalizedCleaningType,
            reason: `Corrigé manuellement → ${getCleaningTypeLabel(newType)}`,
            confidence: 100
          };
        }
        return room;
      });

      // Chercher des chambres similaires à corriger
      const correctedRoom = updated.find(r => r.roomNumber === roomNumber);
      if (correctedRoom) {
        const similarRooms = updated.filter(r => 
          r.roomNumber !== roomNumber &&
          r.nightInfo === correctedRoom.nightInfo &&
          r.cleaningType !== newType
        );

        if (similarRooms.length > 0) {
          similarRooms.forEach(similar => {
            const idx = updated.findIndex(r => r.roomNumber === similar.roomNumber);
            if (idx >= 0) {
              updated[idx] = {
                ...updated[idx],
                cleaningType: newType as NormalizedCleaningType,
                reason: `Auto-corrigé (similaire à ${roomNumber})`,
                confidence: 95
              };
            }
          });
          toast.success(`${similarRooms.length + 1} chambres corrigées`);
        }
      }

      return updated;
    });

    // Sauvegarder la correction comme pattern appris
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
      console.error('Erreur sauvegarde correction:', e);
    }
  }, [hotelId, userId]);

  // Valider et envoyer les chambres
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

  // Stats
  const stats = {
    aBlanc: rooms.filter(r => r.cleaningType === 'a_blanc').length,
    recouche: rooms.filter(r => r.cleaningType === 'recouche').length,
    aucun: rooms.filter(r => r.cleaningType === 'none').length
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Analyseur de Rapport
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Étape 1: Configuration */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            {/* Date du rapport */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date du rapport:</span>
              <Input
                value={reportDateInput}
                onChange={(e) => setReportDateInput(e.target.value)}
                className="w-32 h-8 text-sm"
                placeholder="JJ/MM/AAAA"
              />
            </div>

            {/* PMS détecté */}
            {detectedPms && (
              <Badge variant="secondary" className="text-xs">
                PMS: {detectedPms.toUpperCase()}
              </Badge>
            )}

            {/* Confiance */}
            {hasAnalyzed && (
              <Badge 
                variant={confidence >= 80 ? "default" : confidence >= 60 ? "secondary" : "destructive"}
                className="text-xs"
              >
                Confiance: {confidence.toFixed(0)}%
              </Badge>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => analyzeReport(false)}
              disabled={isAnalyzing}
              size="sm"
            >
              {isAnalyzing && !isUsingAi ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Analyser (local)
            </Button>

            <Button
              onClick={() => analyzeReport(true)}
              disabled={isAnalyzing}
              variant="outline"
              size="sm"
            >
              {isAnalyzing && isUsingAi ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Analyser (IA)
            </Button>

            {rooms.length > 0 && (
              <Button
                onClick={validateRooms}
                variant="default"
                size="sm"
                className="ml-auto"
              >
                <Check className="h-4 w-4 mr-2" />
                Valider {rooms.length} chambres
              </Button>
            )}
          </div>
        </div>

        {/* Stats rapides */}
        {rooms.length > 0 && (
          <div className="flex gap-2">
            <Badge variant="default" className="bg-red-500/20 text-red-700 dark:text-red-300">
              🔴 À Blanc: {stats.aBlanc}
            </Badge>
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
              🟡 Recouche: {stats.recouche}
            </Badge>
            <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300">
              ✅ Aucun: {stats.aucun}
            </Badge>
          </div>
        )}

        {/* Tableau des résultats */}
        {rooms.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-20">Chambre</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead className="w-36">Correction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.roomNumber} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {room.roomNumber}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          room.cleaningType === 'a_blanc' ? 'default' :
                          room.cleaningType === 'recouche' ? 'secondary' : 'outline'
                        }
                        className={
                          room.cleaningType === 'a_blanc' ? 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/50' :
                          room.cleaningType === 'recouche' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/50' :
                          'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50'
                        }
                      >
                        {room.cleaningType === 'a_blanc' ? '🔴 À Blanc' :
                         room.cleaningType === 'recouche' ? '🟡 Recouche' : '✅ Aucun'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {room.nightInfo && <span className="mr-2">🌙 Nuit {room.nightInfo}</span>}
                      {room.reason}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={room.cleaningType}
                        onValueChange={(value) => handleCorrection(room.roomNumber, value as CleaningOption)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a_blanc">🔴 À Blanc</SelectItem>
                          <SelectItem value="recouche">🟡 Recouche</SelectItem>
                          <SelectItem value="none">✅ Aucun</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Message si pas de résultats */}
        {hasAnalyzed && rooms.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucune chambre détectée</p>
            <p className="text-xs mt-1">Essayez l'analyse IA ou vérifiez le format du rapport</p>
          </div>
        )}

        {/* Aperçu du texte brut */}
        {!hasAnalyzed && (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Cliquez sur "Analyser" pour extraire les chambres</p>
            <p className="text-xs mt-1">{rawText.split('\n').length} lignes détectées</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
