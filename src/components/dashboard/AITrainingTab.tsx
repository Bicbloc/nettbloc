/**
 * Nouveau système d'entraînement IA simplifié
 * Flow: Upload PDF → IA parse → Corriger les chambres → Sauvegarder les exemples
 */
import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Brain, Upload, CheckCircle, AlertCircle, Loader2, Sparkles, Save, Trash2, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { loadTrainingExamples, saveTrainingExamples, type TrainingExample } from "@/services/trainingExamplesService";

interface ParsedRoom {
  roomNumber: string;
  cleaningType: 'a_blanc' | 'recouche' | 'none';
  reason: string;
  guestName?: string;
  departureDate?: string;
  nightInfo?: string;
  status?: string;
}

interface RoomSignature {
  hasArrival: boolean;
  hasDeparture: boolean;
  guestCount: 'single' | 'multiple' | 'unknown';
}

interface PropagationCandidate {
  roomNumber: string;
  currentType: string;
}

interface AITrainingTabProps {
  currentHotelId: string | null;
}

const getRoomSignature = (room: ParsedRoom): string => {
  const hasArr = !!room.departureDate || room.status?.toLowerCase().includes('arr');
  const hasDep = !!room.departureDate || room.status?.toLowerCase().includes('dep') || room.status?.toLowerCase().includes('out');
  const nightNum = room.nightInfo ? parseInt(room.nightInfo) : 0;
  const multiGuest = room.guestName?.includes('/') || room.guestName?.includes('+') || room.guestName?.includes('&');
  const guestCount = multiGuest ? 'multiple' : room.guestName ? 'single' : 'unknown';
  return `${hasArr ? 'A' : '-'}|${hasDep ? 'D' : '-'}|${guestCount}|${nightNum > 0 ? 'N' + nightNum : 'N?'}`;
};

const getSignatureLabel = (sig: string): string => {
  const [arr, dep, guests, night] = sig.split('|');
  const parts: string[] = [];
  if (arr === 'A') parts.push('arrivée');
  if (dep === 'D') parts.push('départ');
  if (guests === 'single') parts.push('1 client');
  if (guests === 'multiple') parts.push('clients multiples');
  if (night !== 'N?') parts.push(night.replace('N', '') + ' nuit(s)');
  return parts.length > 0 ? parts.join(' + ') : 'profil inconnu';
};

export function AITrainingTab({ currentHotelId }: AITrainingTabProps) {
  const [step, setStep] = useState<'upload' | 'review' | 'saved'>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedRooms, setParsedRooms] = useState<ParsedRoom[]>([]);
  const [corrections, setCorrections] = useState<Record<string, 'a_blanc' | 'recouche' | 'none'>>({});
  const [savedExamples, setSavedExamples] = useState<TrainingExample[]>([]);
  const [reportText, setReportText] = useState('');
  const [propagationDialog, setPropagationDialog] = useState<{
    open: boolean;
    roomNumber: string;
    newType: 'a_blanc' | 'recouche' | 'none';
    signature: string;
    similarRooms: PropagationCandidate[];
  } | null>(null);

  // Load existing training examples
  const loadExisting = useCallback(async () => {
    if (!currentHotelId) return;
    const examples = await loadTrainingExamples(currentHotelId);
    setSavedExamples(examples);
  }, [currentHotelId]);

  // Load on mount
  useState(() => { loadExisting(); });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentHotelId) return;

    setIsAnalyzing(true);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }

      setReportText(fullText);
      await analyzeWithAI(fullText);
    } catch (error) {
      console.error('Error reading PDF:', error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de lire le PDF" });
      setIsAnalyzing(false);
    }
  };

  const handlePasteText = async () => {
    if (!reportText.trim() || !currentHotelId) return;
    setIsAnalyzing(true);
    await analyzeWithAI(reportText);
  };

  const analyzeWithAI = async (text: string) => {
    try {
      // Load existing training examples to send with the request
      const existingExamples = await loadTrainingExamples(currentHotelId!);

      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.functions.invoke('parse-report', {
        body: {
          text,
          hotelId: currentHotelId,
          reportDate: today,
          trainingExamples: existingExamples.length > 0 ? existingExamples : undefined,
        },
      });

      if (error) throw error;

      const rooms: ParsedRoom[] = (data?.rooms || []).map((r: any) => ({
        roomNumber: r.roomNumber,
        cleaningType: r.cleaningType || 'a_blanc',
        reason: r.reason || '',
        guestName: r.guestName,
        departureDate: r.departureDate,
        nightInfo: r.nightInfo,
        status: r.status,
      }));

      setParsedRooms(rooms);
      setCorrections({});
      setStep('review');

      toast({ title: "Analyse terminée", description: `${rooms.length} chambres détectées par l'IA` });
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({ variant: "destructive", title: "Erreur", description: "Erreur lors de l'analyse IA" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCorrection = (roomNumber: string, newType: 'a_blanc' | 'recouche' | 'none') => {
    const room = parsedRooms.find(r => r.roomNumber === roomNumber);
    if (!room) return;

    const sig = getRoomSignature(room);
    // Find similar rooms with same signature but different type
    const similar = parsedRooms.filter(r => {
      if (r.roomNumber === roomNumber) return false;
      const effectiveType = corrections[r.roomNumber] || r.cleaningType;
      if (effectiveType === newType) return false; // already correct
      return getRoomSignature(r) === sig;
    });

    // Apply correction to this room immediately
    setCorrections(prev => ({ ...prev, [roomNumber]: newType }));

    // If there are similar rooms, show propagation dialog
    if (similar.length > 0) {
      setPropagationDialog({
        open: true,
        roomNumber,
        newType,
        signature: sig,
        similarRooms: similar.map(r => ({
          roomNumber: r.roomNumber,
          currentType: corrections[r.roomNumber] || r.cleaningType,
        })),
      });
    }
  };

  const handlePropagate = () => {
    if (!propagationDialog) return;
    const { newType, similarRooms } = propagationDialog;
    setCorrections(prev => {
      const updated = { ...prev };
      for (const r of similarRooms) {
        updated[r.roomNumber] = newType;
      }
      return updated;
    });
    toast({
      title: "Propagation appliquée",
      description: `${similarRooms.length} chambre(s) corrigée(s) en ${newType === 'a_blanc' ? 'à blanc' : newType === 'recouche' ? 'recouche' : 'propre'}`,
    });
    setPropagationDialog(null);
  };

  const getEffectiveType = (room: ParsedRoom) => {
    return corrections[room.roomNumber] || room.cleaningType;
  };

  const handleSaveTraining = async () => {
    if (!currentHotelId) return;
    setIsSaving(true);

    try {
      // Build training examples from all rooms (corrected ones are most valuable)
      const examples: TrainingExample[] = parsedRooms
        .filter(room => corrections[room.roomNumber]) // Only save rooms that were corrected
        .map(room => ({
          roomNumber: room.roomNumber,
          cleaningType: corrections[room.roomNumber],
          reason: buildReason(room, corrections[room.roomNumber]),
        }));

      if (examples.length === 0) {
        toast({ title: "Aucune correction", description: "Corrigez au moins une chambre pour entraîner l'IA." });
        setIsSaving(false);
        return;
      }

      // Merge with existing examples
      const existing = await loadTrainingExamples(currentHotelId);
      const merged = [...existing];
      for (const ex of examples) {
        const idx = merged.findIndex(e => e.roomNumber === ex.roomNumber);
        if (idx >= 0) {
          merged[idx] = ex;
        } else {
          merged.push(ex);
        }
      }

      await saveTrainingExamples(currentHotelId, merged);
      setSavedExamples(merged);
      setStep('saved');

      toast({ title: "Entraînement sauvegardé", description: `${examples.length} exemple(s) ajouté(s). L'IA utilisera ces patterns pour les prochains rapports.` });
    } catch (error) {
      console.error('Save error:', error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearExamples = async () => {
    if (!currentHotelId) return;
    await saveTrainingExamples(currentHotelId, []);
    setSavedExamples([]);
    toast({ title: "Exemples supprimés", description: "L'IA n'a plus d'exemples d'entraînement pour cet hôtel." });
  };

  const buildReason = (room: ParsedRoom, correctedType: 'a_blanc' | 'recouche' | 'none') => {
    const parts: string[] = [];
    if (room.guestName) parts.push(`client: ${room.guestName}`);
    if (room.departureDate) parts.push(`départ: ${room.departureDate}`);
    if (room.nightInfo) parts.push(`Nuit ${room.nightInfo}`);
    if (room.status) parts.push(`statut PMS: ${room.status}`);
    parts.push(`→ ${correctedType === 'a_blanc' ? 'à blanc' : correctedType === 'recouche' ? 'recouche' : 'propre'}`);
    return parts.join(', ');
  };

  const cleaningTypeLabel = (type: string) => {
    switch (type) {
      case 'a_blanc': return { label: 'À blanc', className: 'bg-red-100 text-red-700 border-red-200' };
      case 'recouche': return { label: 'Recouche', className: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'none': return { label: 'Propre', className: 'bg-green-100 text-green-700 border-green-200' };
      default: return { label: type, className: 'bg-muted text-muted-foreground' };
    }
  };

  if (!currentHotelId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Veuillez d'abord configurer votre hôtel.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                Entraînement IA
                <Sparkles className="h-5 w-5 text-yellow-500" />
              </CardTitle>
              <CardDescription className="text-base mt-1">
                Importez un rapport, corrigez les erreurs, l'IA apprend automatiquement
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Saved examples summary */}
      {savedExamples.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                {savedExamples.length} exemple(s) d'entraînement
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClearExamples} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Réinitialiser
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedExamples.map(ex => {
                const info = cleaningTypeLabel(ex.cleaningType);
                return (
                  <Badge key={ex.roomNumber} variant="outline" className={info.className}>
                    {ex.roomNumber}: {info.label}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importer un rapport pour entraînement
            </CardTitle>
            <CardDescription>
              Uploadez un PDF ou collez le texte de votre rapport PMS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="training-pdf-upload"
                disabled={isAnalyzing}
              />
              <label htmlFor="training-pdf-upload" className="cursor-pointer">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="text-muted-foreground">Analyse IA en cours...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">Cliquez pour uploader un PDF</p>
                    <p className="text-sm text-muted-foreground/70">ou collez le texte ci-dessous</p>
                  </div>
                )}
              </label>
            </div>

            <div className="space-y-2">
              <textarea
                className="w-full min-h-[120px] p-3 border rounded-lg text-sm font-mono resize-y bg-background"
                placeholder="Collez le texte de votre rapport ici..."
                value={reportText}
                onChange={e => setReportText(e.target.value)}
                disabled={isAnalyzing}
              />
              <Button onClick={handlePasteText} disabled={!reportText.trim() || isAnalyzing} className="gap-2">
                <Brain className="h-4 w-4" />
                Analyser avec l'IA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Review & Correct */}
      {step === 'review' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Résultat de l'analyse — {parsedRooms.length} chambres
                </CardTitle>
                <CardDescription>
                  Corrigez le type de nettoyage si l'IA s'est trompée, puis sauvegardez
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep('upload'); setParsedRooms([]); }}>
                  Recommencer
                </Button>
                <Button onClick={handleSaveTraining} disabled={isSaving || Object.keys(corrections).length === 0} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Sauvegarder ({Object.keys(corrections).length} correction{Object.keys(corrections).length > 1 ? 's' : ''})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(corrections).length === 0 && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                💡 Changez le type de nettoyage des chambres mal classées. Ces corrections entraîneront l'IA pour les prochains rapports.
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {parsedRooms.map(room => {
                const effectiveType = getEffectiveType(room);
                const isCorrected = corrections[room.roomNumber] !== undefined;
                const info = cleaningTypeLabel(effectiveType);
                const sig = getRoomSignature(room);
                const similarCount = parsedRooms.filter(r => r.roomNumber !== room.roomNumber && getRoomSignature(r) === sig).length;

                return (
                  <div
                    key={room.roomNumber}
                    className={`p-3 rounded-lg border transition-all ${isCorrected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'bg-card'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg">{room.roomNumber}</span>
                      <Select
                        value={effectiveType}
                        onValueChange={(val) => handleCorrection(room.roomNumber, val as 'a_blanc' | 'recouche' | 'none')}
                      >
                        <SelectTrigger className={`w-[130px] h-8 text-xs font-medium ${info.className}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a_blanc">À blanc</SelectItem>
                          <SelectItem value="recouche">Recouche</SelectItem>
                          <SelectItem value="none">Propre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {room.guestName && <p>👤 {room.guestName}</p>}
                      {room.departureDate && <p>📅 Départ: {room.departureDate}</p>}
                      {room.nightInfo && <p>🌙 Nuit {room.nightInfo}</p>}
                      {room.status && <p>📋 {room.status}</p>}
                      <p className="text-muted-foreground/60 italic">{room.reason}</p>
                    </div>
                    {isCorrected && (
                      <Badge className="mt-2 bg-primary/10 text-primary text-xs">
                        ✏️ Corrigé
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Saved */}
      {step === 'saved' && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Entraînement sauvegardé !</h3>
            <p className="text-muted-foreground mb-6">
              L'IA utilisera ces exemples pour mieux classifier les chambres lors des prochains imports.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setStep('upload'); setParsedRooms([]); setCorrections({}); }}>
                Entraîner avec un autre rapport
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comment ça marche ?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h4 className="font-medium">Importez un rapport</h4>
                <p className="text-sm text-muted-foreground">PDF ou texte collé de votre PMS</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <h4 className="font-medium">Corrigez les erreurs</h4>
                <p className="text-sm text-muted-foreground">Changez le type si l'IA se trompe</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <h4 className="font-medium">L'IA apprend</h4>
                <p className="text-sm text-muted-foreground">Les corrections deviennent des exemples pour les prochains rapports</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Propagation Dialog */}
      <Dialog open={!!propagationDialog?.open} onOpenChange={(open) => { if (!open) setPropagationDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Appliquer aux chambres similaires ?
            </DialogTitle>
            <DialogDescription>
              {propagationDialog && (
                <>
                  La chambre <strong>{propagationDialog.roomNumber}</strong> a le profil : <Badge variant="outline" className="mx-1">{getSignatureLabel(propagationDialog.signature)}</Badge>.
                  <br />
                  <strong>{propagationDialog.similarRooms.length}</strong> autre(s) chambre(s) ont le même profil.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {propagationDialog && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Appliquer <Badge className={cleaningTypeLabel(propagationDialog.newType).className}>
                  {cleaningTypeLabel(propagationDialog.newType).label}
                </Badge> à toutes ces chambres :
              </p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {propagationDialog.similarRooms.map(r => (
                  <Badge key={r.roomNumber} variant="outline" className="text-sm">
                    {r.roomNumber}
                    <span className="ml-1 text-muted-foreground">
                      ({cleaningTypeLabel(r.currentType).label})
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPropagationDialog(null)}>
              Non, juste cette chambre
            </Button>
            <Button onClick={handlePropagate} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Appliquer à toutes ({propagationDialog?.similarRooms.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
