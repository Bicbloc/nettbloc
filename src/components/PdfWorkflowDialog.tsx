import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { processPdf, getLastParsedLines } from "@/services/pdfService";
import { FileUp, Users, ArrowRight, CheckCircle, X, Search, Loader2, RefreshCw, AlertTriangle, Replace, Plug, Clock, Brain, Home, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UnifiedHousekeeperService, HousekeeperWithCode } from "@/services/unifiedHousekeeperService";
import { supabase } from "@/integrations/supabase/client";
import { RoomArchiveService } from "@/services/roomArchiveService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RoomLine } from "@/services/pms/RoomLineParser";
import { 
  loadHotelRoomFormat, 
  filterRoomsByFormat, 
  getInactiveRoomNumbers, 
  filterOutInactiveRooms,
  normalizeRoomNumber
} from "@/utils/roomFormatUtils";

interface PdfWorkflowDialogProps {
  onWorkflowComplete: (data: any, housekeepers?: string[], distributionMethod?: 'random' | 'floor' | 'cleaning-type') => void;
  hotelId?: string;
}

type Step = 'upload' | 'preview' | 'import-mode' | 'housekeepers' | 'distribution';

export function PdfWorkflowDialog({ onWorkflowComplete, hotelId }: PdfWorkflowDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [pdfData, setPdfData] = useState<any>(null);
  const [parsedLines, setParsedLines] = useState<RoomLine[]>([]);
  const [housekeepers, setHousekeepers] = useState<string[]>([]);
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingHousekeepers, setExistingHousekeepers] = useState<HousekeeperWithCode[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<string[]>([]);
  const [isLoadingHousekeepers, setIsLoadingHousekeepers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [importMode, setImportMode] = useState<'update' | 'replace'>('update');
  const [existingRoomsCount, setExistingRoomsCount] = useState(0);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'a_blanc' | 'recouche'>('all');
  const [distributionMethod, setDistributionMethod] = useState<'random' | 'floor' | 'cleaning-type'>('random');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast({ variant: "destructive", title: "Fichier invalide", description: "PDF uniquement" });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf') {
        toast({ variant: "destructive", title: "Fichier invalide" });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handlePdfUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(20);
    setUploadStatus('📄 Lecture du PDF...');

    try {
      setUploadProgress(50);
      setUploadStatus('🧠 Analyse IA...');
      
      const data = await processPdf(selectedFile, hotelId);
      const lines = getLastParsedLines();
      
      setParsedLines(lines);
      setPdfData(data);
      
      setUploadProgress(100);
      setUploadStatus('✅ Terminé');
      
      setTimeout(() => {
        setIsUploading(false);
        setStep('preview');
      }, 500);
      
    } catch (error) {
      console.error("Erreur:", error);
      toast({ variant: "destructive", title: "Erreur d'analyse" });
      setIsUploading(false);
    }
  };

  const proceedFromPreview = async () => {
    if (!hotelId || !pdfData?.length) {
      loadHousekeepers();
      setStep('housekeepers');
      return;
    }

    setIsUploading(true);
    setUploadStatus('🔍 Vérification...');

    try {
      const { count } = await supabase
        .from('rooms')
        .select('id', { count: 'estimated', head: true })
        .eq('hotel_id', hotelId);
      
      setExistingRoomsCount(count || 0);
      setIsUploading(false);

      if ((count || 0) > 0) {
        setStep('import-mode');
      } else {
        await saveRooms('update');
      }
    } catch (error) {
      setIsUploading(false);
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const saveRooms = async (mode: 'update' | 'replace') => {
    if (!hotelId || !pdfData?.length) {
      loadHousekeepers();
      setStep('housekeepers');
      return;
    }

    setIsUploading(true);
    setUploadStatus('💾 Enregistrement...');

    try {
      // Filtrer selon format et registre
      const [roomFormat, inactiveRooms] = await Promise.all([
        loadHotelRoomFormat(hotelId),
        getInactiveRoomNumbers(hotelId)
      ]);
      
      let filteredData = filterRoomsByFormat(pdfData, roomFormat);
      filteredData = filterOutInactiveRooms(filteredData, inactiveRooms);

      if (mode === 'replace') {
        await RoomArchiveService.replaceAllRooms(hotelId, filteredData, selectedFile?.name || 'pdf');
      } else {
        // Upsert
        const roomsForSync = filteredData.map((room: any) => {
          const roomNumber = normalizeRoomNumber(room.roomNumber || room.number);
          let dbCleaningType = 'a_blanc';
          if (room.cleaningType === 'none') dbCleaningType = 'none';
          else if (room.cleaningType === 'recouche' || room.cleaningType === 'quick') dbCleaningType = 'recouche';
          
          return {
            hotel_id: hotelId,
            room_number: roomNumber,
            floor: room.floor ?? null,
            status: room.status || 'dirty',
            cleaning_type: dbCleaningType,
          };
        }).filter(r => !!r.room_number);

        await supabase.from('rooms').upsert(roomsForSync, { 
          onConflict: 'hotel_id,room_number', 
          ignoreDuplicates: false 
        });
      }

      toast({ title: "✅ Chambres enregistrées" });
      loadHousekeepers();
      setStep('housekeepers');
      
    } catch (error) {
      console.error("Erreur:", error);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    } finally {
      setIsUploading(false);
    }
  };

  const loadHousekeepers = async () => {
    if (!hotelId) return;
    setIsLoadingHousekeepers(true);
    try {
      const data = await UnifiedHousekeeperService.getCodesForHotel(hotelId);
      setExistingHousekeepers(data);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoadingHousekeepers(false);
    }
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setPdfData(null);
    setParsedLines([]);
    setStep('upload');
    setHousekeepers([]);
    setSelectedExisting([]);
    setPreviewFilter('all');
  };

  const completeWorkflow = () => {
    const allHousekeepers = [...new Set([...selectedExisting, ...housekeepers])];
    onWorkflowComplete(pdfData, allHousekeepers.length > 0 ? allHousekeepers : undefined, distributionMethod);
    setOpen(false);
    resetDialog();
  };

  // Stats
  const stats = useMemo(() => {
    if (!parsedLines.length) return null;
    const aBlanc = parsedLines.filter(l => l.cleaningType === 'a_blanc').length;
    const recouche = parsedLines.filter(l => l.cleaningType === 'recouche').length;
    const none = parsedLines.filter(l => l.cleaningType === 'none').length;
    return { total: parsedLines.length, aBlanc, recouche, none };
  }, [parsedLines]);

  const filteredLines = useMemo(() => {
    if (previewFilter === 'all') return parsedLines;
    return parsedLines.filter(l => l.cleaningType === previewFilter);
  }, [parsedLines, previewFilter]);

  const totalSelected = housekeepers.length + selectedExisting.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FileUp className="h-4 w-4" />
          Importer PDF
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Upload */}
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>Importer un rapport PDF</DialogTitle>
              <DialogDescription>
                L'IA analysera automatiquement votre rapport selon les règles apprises.
              </DialogDescription>
            </DialogHeader>
            
            {isUploading ? (
              <div className="py-8 text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                <p>{uploadStatus}</p>
                <Progress value={uploadProgress} />
              </div>
            ) : (
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">{selectedFile?.name || "Glissez un PDF ici"}</p>
                <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </div>
            )}
            
            <DialogFooter>
              <Button onClick={handlePdfUpload} disabled={!selectedFile || isUploading}>
                Analyser <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Preview */}
        {step === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Résultat de l'analyse
              </DialogTitle>
            </DialogHeader>
            
            {stats && (
              <div className="grid grid-cols-4 gap-2">
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </Card>
                <Card className="p-3 text-center bg-orange-50 dark:bg-orange-900/20 cursor-pointer" onClick={() => setPreviewFilter(previewFilter === 'a_blanc' ? 'all' : 'a_blanc')}>
                  <p className="text-2xl font-bold text-orange-600">{stats.aBlanc}</p>
                  <p className="text-xs text-orange-600">À blanc</p>
                </Card>
                <Card className="p-3 text-center bg-green-50 dark:bg-green-900/20 cursor-pointer" onClick={() => setPreviewFilter(previewFilter === 'recouche' ? 'all' : 'recouche')}>
                  <p className="text-2xl font-bold text-green-600">{stats.recouche}</p>
                  <p className="text-xs text-green-600">Recouche</p>
                </Card>
                <Card className="p-3 text-center bg-gray-50 dark:bg-gray-900/20">
                  <p className="text-2xl font-bold text-gray-600">{stats.none}</p>
                  <p className="text-xs text-gray-600">Aucun</p>
                </Card>
              </div>
            )}

            <ScrollArea className="h-[250px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredLines.map((line, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2 rounded flex items-center gap-3 ${
                      line.cleaningType === 'a_blanc' ? 'bg-orange-50 dark:bg-orange-900/20' :
                      line.cleaningType === 'recouche' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted'
                    }`}
                  >
                    <Badge variant="outline" className="font-mono font-bold">{line.roomNumber}</Badge>
                    <Badge className={
                      line.cleaningType === 'a_blanc' ? 'bg-orange-500' :
                      line.cleaningType === 'recouche' ? 'bg-green-500' : 'bg-gray-400'
                    }>
                      {line.cleaningType === 'a_blanc' ? '🔶 À blanc' : 
                       line.cleaningType === 'recouche' ? '🔄 Recouche' : '⏸️ Aucun'}
                    </Badge>
                    {line.guestName && <span className="text-xs text-muted-foreground">{line.guestName}</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Retour</Button>
              <Button onClick={proceedFromPreview} disabled={isUploading}>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continuer <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Import Mode */}
        {step === 'import-mode' && (
          <>
            <DialogHeader>
              <DialogTitle>Mode d'import</DialogTitle>
              <DialogDescription>
                {existingRoomsCount} chambres existent déjà.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              <Card 
                className={`p-4 cursor-pointer ${importMode === 'update' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setImportMode('update')}
              >
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Mettre à jour</p>
                    <p className="text-sm text-muted-foreground">Ajouter/modifier les chambres</p>
                  </div>
                </div>
              </Card>
              
              <Card 
                className={`p-4 cursor-pointer ${importMode === 'replace' ? 'ring-2 ring-destructive' : ''}`}
                onClick={() => setImportMode('replace')}
              >
                <div className="flex items-center gap-3">
                  <Replace className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Remplacer tout</p>
                    <p className="text-sm text-muted-foreground">Supprimer et remplacer</p>
                  </div>
                </div>
              </Card>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('preview')}>Retour</Button>
              <Button 
                onClick={() => saveRooms(importMode)} 
                variant={importMode === 'replace' ? 'destructive' : 'default'}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmer
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Housekeepers */}
        {step === 'housekeepers' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Femmes de chambre
              </DialogTitle>
              <DialogDescription>
                {pdfData?.length} chambres à distribuer
              </DialogDescription>
            </DialogHeader>
            
            {/* Existantes */}
            {isLoadingHousekeepers ? (
              <div className="py-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : existingHousekeepers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Sélectionner :</p>
                <div className="flex flex-wrap gap-2">
                  {existingHousekeepers.map(hk => (
                    <Badge 
                      key={hk.id}
                      variant={selectedExisting.includes(hk.name) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setSelectedExisting(prev => 
                        prev.includes(hk.name) ? prev.filter(n => n !== hk.name) : [...prev, hk.name]
                      )}
                    >
                      {selectedExisting.includes(hk.name) && <CheckCircle className="h-3 w-3 mr-1" />}
                      {hk.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Ajouter nouvelle */}
            <div className="flex gap-2">
              <Input
                placeholder="Ajouter une nouvelle..."
                value={newHousekeeperName}
                onChange={(e) => setNewHousekeeperName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newHousekeeperName.trim()) {
                    setHousekeepers(prev => [...prev, newHousekeeperName.trim()]);
                    setNewHousekeeperName('');
                  }
                }}
              />
              <Button 
                variant="outline" 
                onClick={() => {
                  if (newHousekeeperName.trim()) {
                    setHousekeepers(prev => [...prev, newHousekeeperName.trim()]);
                    setNewHousekeeperName('');
                  }
                }}
              >
                Ajouter
              </Button>
            </div>

            {housekeepers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {housekeepers.map((name, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {name}
                    <button onClick={() => setHousekeepers(prev => prev.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {totalSelected > 0 && (
              <Alert>
                <AlertDescription>
                  {totalSelected} femme(s) de chambre sélectionnée(s) pour {pdfData?.length} chambres
                </AlertDescription>
              </Alert>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('preview')}>Retour</Button>
              <Button onClick={() => totalSelected > 0 ? setStep('distribution') : completeWorkflow()}>
                {totalSelected > 0 ? 'Continuer' : 'Terminer sans distribution'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Distribution */}
        {step === 'distribution' && (
          <>
            <DialogHeader>
              <DialogTitle>Méthode de distribution</DialogTitle>
              <DialogDescription>
                Comment répartir les {pdfData?.length} chambres entre {totalSelected} femme(s) de chambre ?
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              {[
                { value: 'random', label: 'Équitable', desc: 'Répartition égale' },
                { value: 'floor', label: 'Par étage', desc: 'Regrouper par étage' },
                { value: 'cleaning-type', label: 'Par type', desc: 'À blanc vs Recouche' },
              ].map(opt => (
                <Card 
                  key={opt.value}
                  className={`p-4 cursor-pointer ${distributionMethod === opt.value ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setDistributionMethod(opt.value as any)}
                >
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-sm text-muted-foreground">{opt.desc}</p>
                </Card>
              ))}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('housekeepers')}>Retour</Button>
              <Button onClick={completeWorkflow}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Distribuer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
