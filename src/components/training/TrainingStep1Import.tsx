import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Sparkles, ClipboardPaste } from "lucide-react";
import { TrainingData } from "./TrainingWizard";
import { universalParse } from "@/services/training/UniversalParser";
import { pmsAdapterFactory } from "@/services/pms";
import { loadHotelReportConfig } from "@/services/reportConfigService";
import * as pdfjsLib from "pdfjs-dist";
import Papa from "papaparse";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface TrainingStep1ImportProps {
  hotelId: string;
  onComplete: (data: TrainingData) => void;
}

export const TrainingStep1Import = ({ hotelId, onComplete }: TrainingStep1ImportProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [activeTab, setActiveTab] = useState<string>("file");

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY: number | null = null;
      let lineBuffer = "";
      
      for (const item of textContent.items as any[]) {
        const currentY = item.transform[5];
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          fullText += lineBuffer.trim() + "\n";
          lineBuffer = "";
        }
        lineBuffer += item.str + " ";
        lastY = currentY;
      }
      
      if (lineBuffer.trim()) {
        fullText += lineBuffer.trim() + "\n";
      }
      fullText += "\n";
    }
    
    return fullText;
  };

  const extractTextFromCsv = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          const text = results.data
            .map((row: any) => (Array.isArray(row) ? row.join('\t') : String(row)))
            .join('\n');
          resolve(text);
        },
        error: (error: any) => reject(error),
      });
    });
  };

  const processText = async (text: string, sourceName: string) => {
    // Load hotel-specific status mappings for better accuracy
    let customMappings: Record<string, string> | undefined;
    try {
      const config = await loadHotelReportConfig(hotelId);
      if (config?.status_mappings && typeof config.status_mappings === 'object') {
        customMappings = config.status_mappings as unknown as Record<string, string>;
      }
    } catch (e) {
    }

    // 1) Try PMS-specific detection first (handles Mews guest-name logic, connected rooms, etc.)
    const detection = pmsAdapterFactory.detectPms(text);
    let extractedRooms: any[] = [];
    let detectedPmsType = 'universal';

    if (detection.detection.confidence >= 50) {
      const pmsRooms = detection.adapter.extractRooms(text);
      if (pmsRooms.length > 0) {
        extractedRooms = pmsRooms.map(r => ({
          roomNumber: r.roomNumber,
          cleaningType: r.cleaningType as any,
          status: r.status || '',
          originalText: r.originalText || '',
          validated: r.validated ?? true,
          guestName: r.guestName || undefined,
          arrivalDate: r.arrivalDate || undefined,
          departureDate: r.departureDate || undefined,
          roomType: r.roomType || undefined,
          confidence: r.confidence ?? 0.5,
          isConnected: r.isConnected,
          linkedRooms: r.linkedRooms,
        }));
        detectedPmsType = detection.detection.pmsType;
      }
    }

    // 2) Fallback to UniversalParser if PMS adapter found nothing
    if (extractedRooms.length === 0) {
      const universalResult = universalParse(text, customMappings);

      extractedRooms = universalResult.rows.map(row => ({
        roomNumber: row.roomNumber,
        cleaningType: (row.detectedCleaningType === 'out_of_service' ? 'none' : row.detectedCleaningType === 'unknown' ? 'quick' : row.detectedCleaningType) as any,
        status: row.statusIndicator || row.cleaningStatus || '',
        originalText: row.rawLine,
        validated: row.detectedCleaningType !== 'unknown',
        guestName: row.guestName || undefined,
        arrivalDate: row.arrivalDate || undefined,
        departureDate: row.departureDate || undefined,
        roomType: row.roomType || undefined,
        confidence: row.confidence,
      }));
    }

    const trainingData: TrainingData = {
      reportName: sourceName,
      rawText: text,
      extractedRooms,
      detectedPmsType,
      validatedCount: 0,
    };

    if (extractedRooms.length === 0) {
      toast({
        title: "Aucune chambre détectée",
        description: "Passez à l'étape suivante pour configurer manuellement.",
      });
    } else {
      const mappedCount = extractedRooms.filter(r => r.validated).length;
      toast({
        title: "Import réussi",
        description: `${extractedRooms.length} chambres détectées (${mappedCount} avec statut connu, confiance: ${universalResult.confidence}%)`,
      });
    }

    onComplete(trainingData);
  };

  const processFile = async (file: File) => {
    setUploading(true);

    try {
      let text = "";
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'pdf' || file.type.includes("pdf")) {
        text = await extractTextFromPdf(file);
      } else if (ext === 'csv' || file.type.includes("csv")) {
        text = await extractTextFromCsv(file);
      } else if (ext === 'txt' || ext === 'tsv' || file.type.includes("text")) {
        text = await file.text();
      } else {
        toast({
          title: "Format non supporté",
          description: "Formats acceptés : PDF, CSV, TXT",
          variant: "destructive",
        });
        return;
      }

      await processText(text, file.name);
    } catch (error) {
      console.error("Erreur lors du traitement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de lire le fichier",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      toast({ title: "Collez du texte d'abord", variant: "destructive" });
      return;
    }
    processText(pastedText, "Texte collé");
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file" className="gap-2">
            <Upload className="h-4 w-4" />
            Importer un fichier
          </TabsTrigger>
          <TabsTrigger value="paste" className="gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Coller du texte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="mt-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
                <p className="text-lg font-medium">Analyse du rapport en cours...</p>
                <p className="text-sm text-muted-foreground">
                  Extraction du texte et détection automatique du format
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Glissez votre rapport ici
                </h3>
                <p className="text-muted-foreground mb-2">
                  ou cliquez pour sélectionner un fichier
                </p>
                <div className="flex justify-center gap-2 mb-4">
                  <Badge variant="secondary">PDF</Badge>
                  <Badge variant="secondary">CSV</Badge>
                  <Badge variant="secondary">TXT</Badge>
                </div>
                <input
                  type="file"
                  accept=".pdf,.csv,.txt,.tsv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="paste" className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Copiez le contenu de votre rapport PMS et collez-le ci-dessous. 
              Le système détectera automatiquement le format.
            </p>
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={"Collez ici le texte de votre rapport...\n\nExemple:\n101  TWS  DIR  Jean Dupont  05/05/2025\n102  DBL  INS  Marie Martin  06/05/2025\n103  SGL  SAL  Pierre Durand"}
              className="min-h-[250px] font-mono text-sm"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {pastedText.split('\n').filter(l => l.trim()).length} lignes
              </span>
              <Button onClick={handlePasteSubmit} disabled={!pastedText.trim()} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Analyser le texte
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Détection automatique universelle</p>
            <p className="text-sm text-muted-foreground">
              Le système reconnaît automatiquement tous les PMS (Opera, Mews, Apaleo, Protel, Fidelio, Clock...) 
              et les rapports multilingues (FR, EN, DE, ES, IT, PT). Si le format est reconnu à plus de 90%, 
              vous pourrez sauver directement.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Conseil</p>
            <p className="text-sm text-muted-foreground">
              Utilisez un rapport avec plusieurs types de chambres (départs, recouches, arrivées) 
              pour un meilleur entraînement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
