import { useState, useRef } from "react";
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
import { processPdf } from "@/services/pdfService";
import { FileUp, Users, ArrowRight, CheckCircle, X, Search, Loader2, RefreshCw, AlertTriangle, Replace, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UnifiedHousekeeperService, HousekeeperWithCode } from "@/services/unifiedHousekeeperService";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { RoomArchiveService } from "@/services/roomArchiveService";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export function PdfWorkflowDialog({ onWorkflowComplete, hotelId }: PdfWorkflowDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'import-mode' | 'housekeepers' | 'distribution' | 'linen-inventory'>('upload');
  const [pdfData, setPdfData] = useState<any>(null);
  const [housekeepers, setHousekeepers] = useState<string[]>([]);
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingHousekeepers, setExistingHousekeepers] = useState<HousekeeperWithCode[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<string[]>([]);
  const [isLoadingHousekeepers, setIsLoadingHousekeepers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllExisting, setShowAllExisting] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [linenInventoryHousekeeper, setLinenInventoryHousekeeper] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'update' | 'replace'>('update');
  const [existingRoomsCount, setExistingRoomsCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [savedPdfData, setSavedPdfData] = useState<any>(null); // Sauvegarde locale pour retry

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast({
          variant: "destructive",
          title: "Type de fichier invalide",
          description: "Veuillez téléverser un fichier PDF",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf') {
        toast({
          variant: "destructive",
          title: "Type de fichier invalide",
          description: "Veuillez téléverser un fichier PDF",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handlePdfUpload = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Aucun fichier sélectionné",
        description: "Veuillez sélectionner un fichier PDF à téléverser",
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setRetryCount(0);
      
      // Étape 1: Lecture du PDF
      setUploadStatus('📄 Lecture du PDF...');
      setUploadProgress(20);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Étape 2: Extraction des données avec règles personnalisées
      setUploadStatus('🔍 Extraction des chambres...');
      setUploadProgress(40);
      const data = await processPdf(selectedFile, hotelId);
      setPdfData(data);
      setSavedPdfData(data); // Sauvegarder pour retry
      
      // Étape 3: Vérification rapide (estimation)
      setUploadProgress(55);
      
      let existingCount = 0;
      if (hotelId) {
        // Estimation rapide sans bloquer
        const { count } = await supabase
          .from('rooms')
          .select('id', { count: 'estimated', head: true })
          .eq('hotel_id', hotelId);
        existingCount = count || 0;
        setExistingRoomsCount(existingCount);
      }
      
      // Si des chambres existent, demander le mode d'import
      if (existingCount > 0) {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        setStep('import-mode');
        return;
      }
      
      // Pas de chambres existantes, continuer directement
      await saveRoomsToDatabase(data, 'update');
      
    } catch (error) {
      console.error("Erreur traitement PDF:", error);
      handleUploadError(error);
    }
  };

  const handleUploadError = (error: any, canRetry = true) => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatus('');
    
    if (canRetry && retryCount < 3) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Problème de connexion au serveur. Cliquez sur Réessayer.",
        action: (
          <Button variant="outline" size="sm" onClick={() => retrySave()}>
            <RotateCcw className="h-4 w-4 mr-1" /> Réessayer
          </Button>
        ),
      });
    } else {
      toast({
        variant: "destructive",
        title: "Échec du traitement",
        description: error?.message || "Une erreur s'est produite lors du traitement du fichier PDF.",
      });
      setOpen(false);
      resetDialog();
    }
  };

  const retrySave = async () => {
    if (!savedPdfData) return;
    
    setRetryCount(prev => prev + 1);
    setIsUploading(true);
    setUploadProgress(60);
    setUploadStatus(`🔄 Nouvelle tentative (${retryCount + 1}/3)...`);
    
    try {
      await saveRoomsToDatabase(savedPdfData, importMode);
    } catch (error) {
      handleUploadError(error, retryCount < 2);
    }
  };

  const saveRoomsToDatabase = async (data: any[], mode: 'update' | 'replace') => {
    if (!hotelId || data.length === 0) {
      proceedToHousekeepers(data);
      return;
    }

    setIsUploading(true);
    setUploadStatus('🔍 Vérification du format et du registre...');
    setUploadProgress(55);

    try {
      // Charger le format appris et les chambres inactives en parallèle
      const [roomFormatConfig, inactiveRooms] = await Promise.all([
        loadHotelRoomFormat(hotelId),
        getInactiveRoomNumbers(hotelId)
      ]);
      
      // Filtrer les chambres selon le format appris
      let filteredData = filterRoomsByFormat(data, roomFormatConfig);
      
      // Filtrer les chambres désactivées dans le registre
      filteredData = filterOutInactiveRooms(filteredData, inactiveRooms);
      
      const excludedCount = data.length - filteredData.length;
      if (excludedCount > 0) {
        console.log(`📋 ${excludedCount} chambres exclues (format ou registre)`);
        toast({
          title: "ℹ️ Chambres filtrées",
          description: `${excludedCount} chambres exclues (format non conforme ou désactivées).`,
        });
      }
      
      if (filteredData.length === 0) {
        toast({
          variant: "destructive",
          title: "Aucune chambre valide",
          description: "Toutes les chambres ont été exclues par les filtres.",
        });
        setIsUploading(false);
        return;
      }
      
      setUploadStatus(mode === 'replace' ? '🗑️ Suppression des anciennes chambres...' : '💾 Enregistrement des chambres...');
      setUploadProgress(60);

      let insertedCount = 0;

      if (mode === 'replace') {
        // Remplacer toutes les chambres
        const result = await RoomArchiveService.replaceAllRooms(hotelId, filteredData, selectedFile?.name || 'pdf_import');
        insertedCount = result.inserted;
        
        toast({
          title: "✅ Chambres remplacées",
          description: `${result.deleted} anciennes supprimées, ${result.inserted} nouvelles ajoutées.`,
        });
      } else {
        // Mode update (upsert)
        console.log('🔄 Début enregistrement dans hotel_rooms_registry pour', filteredData.length, 'chambres');
        
        const roomsData = filteredData.map((room: any) => {
          const rawRoomNumber = room.roomNumber || room.room_number || room.number;
          // Normaliser le numéro (05 → 5, 01 → 1, etc.)
          const roomNumber = normalizeRoomNumber(rawRoomNumber);
          return {
            hotel_id: hotelId,
            room_number: roomNumber,
            floor: room.floor ?? null,
            room_type: room.type || room.room_type || null,
            building: room.building || null,
            zone: room.zone || null,
            source: 'pdf_import',
            imported_from: selectedFile?.name || 'pdf_import',
            metadata: { status: room.status, raw_data: room },
          };
        }).filter(r => !!r.room_number);

        // Préparer les données pour la table rooms
        const roomsForSync = filteredData.map((room: any) => {
          const rawRoomNumber = room.roomNumber || room.room_number || room.number;
          // Normaliser le numéro (05 → 5, 01 → 1, etc.)
          const roomNumber = normalizeRoomNumber(rawRoomNumber);
          return {
            hotel_id: hotelId,
            room_number: roomNumber,
            floor: room.floor ?? null,
            status: room.status || 'dirty',
            room_type: room.type || room.room_type || null,
            cleaning_priority: room.priority === 'high' ? 2 : 1,
            notes: room.notes || null
          };
        }).filter(r => !!r.room_number);

        // Exécuter les deux upserts EN PARALLÈLE avec timeout court
        setUploadStatus(`💾 Enregistrement de ${roomsData.length} chambres...`);
        
        const timeout = 15000;
        
        const [registryResult, roomsResult] = await Promise.all([
          Promise.race([
            supabase.from('hotel_rooms_registry').upsert(roomsData, { onConflict: 'hotel_id,room_number' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout registry')), timeout))
          ]),
          Promise.race([
            supabase.from('rooms').upsert(roomsForSync, { onConflict: 'hotel_id,room_number', ignoreDuplicates: false }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout rooms')), timeout))
          ])
        ]) as any[];

        if (registryResult.error) throw registryResult.error;
        if (roomsResult.error) throw roomsResult.error;
        
        insertedCount = roomsData.length;
        setUploadProgress(90);

        toast({
          title: "✅ Analyse terminée",
          description: `${insertedCount} chambres enregistrées.`,
        });
      }

      proceedToHousekeepers(filteredData);

    } catch (err: any) {
      console.error('❌ Erreur enregistrement:', err);
      throw err;
    }
  };

  const proceedToHousekeepers = (data: any[]) => {
    setUploadProgress(100);
    setUploadStatus('✅ Terminé !');
    
    setTimeout(() => {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      setStep('housekeepers');
      loadExistingHousekeepers();
    }, 500);
  };

  const addHousekeeper = () => {
    if (newHousekeeperName.trim() && !housekeepers.includes(newHousekeeperName.trim())) {
      setHousekeepers([...housekeepers, newHousekeeperName.trim()]);
      setNewHousekeeperName('');
    }
  };

  const removeHousekeeper = (index: number) => {
    setHousekeepers(housekeepers.filter((_, i) => i !== index));
  };

  const loadExistingHousekeepers = async (attempt = 1): Promise<boolean> => {
    // Validation et fallback du hotelId
    const effectiveHotelId = hotelId || localStorage.getItem('selectedHotelId') || localStorage.getItem('currentHotelId');
    
    if (!effectiveHotelId) {
      console.error('❌ HotelId manquant pour charger les housekeepers');
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "ID de l'hôtel manquant"
      });
      return false;
    }
    
    try {
      setIsLoadingHousekeepers(true);
      console.log(`🔄 Tentative ${attempt}/2 de chargement des housekeepers...`);
      
      const housekeepersData = await UnifiedHousekeeperService.getCodesForHotel(effectiveHotelId);
      setExistingHousekeepers(housekeepersData);
      console.log(`✅ ${housekeepersData.length} housekeepers chargés`);
      
      toast({
        title: "Femmes de chambre chargées",
        description: `${housekeepersData.length} femme(s) de chambre disponible(s)`
      });
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur tentative ${attempt}:`, error);
      
      // Retry avec délai réduit (1s, 2s au lieu de 2s, 4s, 8s)
      if (attempt < 2) {
        const delay = attempt * 1000; // 1s, 2s
        console.log(`⏳ Nouvelle tentative dans ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return loadExistingHousekeepers(attempt + 1);
      }
      
      toast({
        variant: "destructive",
        title: "Erreur de chargement",
        description: "Impossible de charger les femmes de chambre. Vous pouvez en ajouter manuellement."
      });
      return false;
    } finally {
      setIsLoadingHousekeepers(false);
    }
  };

  const toggleExistingHousekeeper = (name: string) => {
    setSelectedExisting(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setPdfData(null);
    setSavedPdfData(null);
    setStep('upload');
    setHousekeepers([]);
    setNewHousekeeperName('');
    setSelectedExisting([]);
    setExistingHousekeepers([]);
    setSearchQuery('');
    setShowAllExisting(false);
    setLinenInventoryHousekeeper(null);
    setImportMode('update');
    setExistingRoomsCount(0);
    setRetryCount(0);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const renderUploadStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Étape 1/3</Badge>
          Importer un Rapport PDF
        </DialogTitle>
        <DialogDescription>
          Téléversez un rapport PDF exporté depuis votre PMS pour analyser les chambres.
        </DialogDescription>
      </DialogHeader>
      
      {isUploading && (
        <div className="space-y-4 py-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium">{uploadStatus}</p>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}
      
      {!isUploading && (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={triggerFileInput}
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <FileUp className="h-10 w-10 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {selectedFile ? selectedFile.name : "Glissez et déposez votre fichier ici"}
              </p>
              {!selectedFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Fichiers PDF uniquement, jusqu'à 10MB
                </p>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFileInput();
                }}
              >
                Sélectionner un fichier
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button
          onClick={handlePdfUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? "Analyse en cours..." : "Analyser le PDF"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderImportModeStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Mode d'import</Badge>
          Chambres existantes détectées
        </DialogTitle>
        <DialogDescription>
          {existingRoomsCount} chambres existent déjà. Comment souhaitez-vous procéder avec les {pdfData?.length} nouvelles chambres ?
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{existingRoomsCount}</strong> chambres sont déjà enregistrées pour cet hôtel.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Card 
            className={`p-4 cursor-pointer transition-all ${importMode === 'update' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
            onClick={() => setImportMode('update')}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${importMode === 'update' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                {importMode === 'update' && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
              </div>
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Mettre à jour les chambres existantes
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Les chambres avec le même numéro seront mises à jour. Les nouvelles chambres seront ajoutées.
                </p>
                <Badge variant="outline" className="mt-2">Recommandé</Badge>
              </div>
            </div>
          </Card>

          <Card 
            className={`p-4 cursor-pointer transition-all ${importMode === 'replace' ? 'ring-2 ring-destructive bg-destructive/5' : 'hover:bg-muted/50'}`}
            onClick={() => setImportMode('replace')}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${importMode === 'replace' ? 'border-destructive bg-destructive' : 'border-muted-foreground'}`}>
                {importMode === 'replace' && <CheckCircle className="h-3 w-3 text-destructive-foreground" />}
              </div>
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2 text-destructive">
                  <Replace className="h-4 w-4" />
                  Remplacer toutes les chambres
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong className="text-destructive">Attention :</strong> Supprime les {existingRoomsCount} chambres existantes et toutes les affectations. 
                  Insère uniquement les nouvelles chambres du PDF.
                </p>
                <Badge variant="destructive" className="mt-2">Irréversible</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('upload')}>
          Retour
        </Button>
        <Button
          onClick={async () => {
            try {
              await saveRoomsToDatabase(pdfData, importMode);
            } catch (error) {
              handleUploadError(error);
            }
          }}
          variant={importMode === 'replace' ? 'destructive' : 'default'}
        >
          {importMode === 'replace' ? 'Remplacer les chambres' : 'Mettre à jour'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderHousekeepersStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Étape 2/3</Badge>
          Configurer les femmes de chambre
        </DialogTitle>
        <DialogDescription>
          {pdfData?.length} chambres détectées. Ajoutez les femmes de chambre qui seront responsables du nettoyage.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        {/* Résumé de l'étape précédente */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">PDF traité avec succès</span>
          </div>
          <p className="text-green-700 text-sm mt-1">
            {pdfData?.length} chambres analysées
          </p>
        </div>

        {/* Barre de recherche */}
        {existingHousekeepers.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Rechercher une femme de chambre existante
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou code d'accès..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Section pour les femmes de chambre existantes avec codes */}
        {(existingHousekeepers.length > 0 || isLoadingHousekeepers) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-green-700">
                ✅ Femmes de chambre existantes ({existingHousekeepers.filter((hk) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    hk.name.toLowerCase().includes(query) ||
                    (hk.access_code || '').toLowerCase().includes(query)
                  );
                }).length})
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadExistingHousekeepers()}
                  disabled={isLoadingHousekeepers}
                >
                  {isLoadingHousekeepers ? '🔄' : '🔄'} Rafraîchir
                </Button>
                {existingHousekeepers.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllExisting(!showAllExisting)}
                  >
                    {showAllExisting ? 'Masquer' : 'Voir tout'}
                  </Button>
                )}
              </div>
            </div>
            
            {isLoadingHousekeepers ? (
              <div className="text-center py-4 space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-muted-foreground">Chargement des femmes de chambre...</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsLoadingHousekeepers(false);
                    toast({
                      title: "Chargement annulé",
                      description: "Vous pouvez ajouter des femmes de chambre manuellement ci-dessous."
                    });
                  }}
                >
                  Passer cette étape
                </Button>
              </div>
            ) : existingHousekeepers.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {existingHousekeepers
                  .filter((hk) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      hk.name.toLowerCase().includes(query) ||
                      (hk.access_code || '').toLowerCase().includes(query)
                    );
                  })
                  .map((housekeeper) => (
                    <div
                      key={housekeeper.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedExisting.includes(housekeeper.name) 
                          ? 'bg-primary/10 border-primary' 
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                      onClick={() => toggleExistingHousekeeper(housekeeper.name)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedExisting.includes(housekeeper.name) ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}>
                          {selectedExisting.includes(housekeeper.name) && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{housekeeper.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Code: {housekeeper.access_code || 'Aucun code'}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant={housekeeper.is_active ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {housekeeper.is_active ? '✅ Actif' : '⏸️ Inactif'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                {existingHousekeepers.filter((hk) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    hk.name.toLowerCase().includes(query) ||
                    (hk.access_code || '').toLowerCase().includes(query)
                  );
                }).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Aucune femme de chambre trouvée
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-2">
                Aucune femme de chambre existante
              </div>
            )}

            {/* Sélection actuelle */}
            {selectedExisting.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  ✅ {selectedExisting.length} femme{selectedExisting.length > 1 ? 's' : ''} de chambre sélectionnée{selectedExisting.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Ajouter une nouvelle femme de chambre */}
        <div className="space-y-2">
          <div className="text-sm font-medium">➕ Ajouter une nouvelle femme de chambre</div>
          <div className="flex gap-2">
            <Input
              placeholder="Nom de la femme de chambre"
              value={newHousekeeperName}
              onChange={(e) => setNewHousekeeperName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addHousekeeper();
                }
              }}
            />
            <Button onClick={addHousekeeper} disabled={!newHousekeeperName.trim()}>
              <Users className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </div>

        {/* Liste des nouvelles femmes de chambre */}
        {housekeepers.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Nouvelles femmes de chambre ({housekeepers.length})</h4>
            <div className="space-y-2">
              {housekeepers.map((name, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center justify-between">
                    <span>{name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeHousekeeper(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('upload')}>
          Retour
        </Button>
        <Button
          onClick={() => setStep('distribution')}
          disabled={selectedExisting.length === 0 && housekeepers.length === 0}
        >
          Continuer
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderDistributionStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Étape 3/4</Badge>
          Méthode de distribution
        </DialogTitle>
        <DialogDescription>
          Comment souhaitez-vous distribuer les {pdfData?.length} chambres aux {selectedExisting.length + housekeepers.length} femmes de chambre ?
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        {/* Résumé */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">{selectedExisting.length + housekeepers.length} femmes de chambre configurées</span>
          </div>
          <div className="text-blue-700 text-sm mt-1 space-x-2">
            {selectedExisting.map((name, index) => (
              <Badge key={`existing-${index}`} variant="outline" className="bg-green-100">{name} ✅</Badge>
            ))}
            {housekeepers.map((name, index) => (
              <Badge key={`new-${index}`} variant="outline">{name} ➕</Badge>
            ))}
          </div>
        </div>

        {/* Options de distribution */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-auto flex flex-col items-start p-4"
            onClick={() => setStep('linen-inventory')}
          >
            <div className="font-medium">🎲 Distribution aléatoire</div>
            <div className="text-sm text-muted-foreground">Répartition équitable et aléatoire des chambres</div>
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-auto flex flex-col items-start p-4"
            onClick={() => setStep('linen-inventory')}
          >
            <div className="font-medium">🏢 Distribution par étage</div>
            <div className="text-sm text-muted-foreground">Chambres d'étages proches pour la même femme de chambre</div>
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-auto flex flex-col items-start p-4"
            onClick={() => setStep('linen-inventory')}
          >
            <div className="font-medium">🔴⚪ Distribution par type de nettoyage</div>
            <div className="text-sm text-muted-foreground">Séparer les chambres à blanc et les recouches</div>
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-auto flex flex-col items-start p-4"
            onClick={() => setStep('linen-inventory')}
          >
            <div className="font-medium">⚡ Sans distribution automatique</div>
            <div className="text-sm text-muted-foreground">Distribuer manuellement plus tard</div>
          </Button>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('housekeepers')}>
          Retour
        </Button>
      </DialogFooter>
    </>
  );

  const renderLinenInventoryStep = () => {
    const allHousekeepers = [...selectedExisting, ...housekeepers];
    
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Étape 4/4</Badge>
            Inventaire du linge
          </DialogTitle>
          <DialogDescription>
            Sélectionnez une femme de chambre pour effectuer l'inventaire du linge aujourd'hui.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Résumé */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Distribution configurée</span>
            </div>
            <p className="text-blue-700 text-sm mt-1">
              {pdfData?.length} chambres • {allHousekeepers.length} femme{allHousekeepers.length > 1 ? 's' : ''} de chambre
            </p>
          </div>

          {/* Sélection pour l'inventaire */}
          <div className="space-y-3">
            <div className="text-sm font-medium">📦 Qui va faire l'inventaire du linge ?</div>
            
            {allHousekeepers.map((name) => (
              <div
                key={name}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  linenInventoryHousekeeper === name 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-muted/50 hover:bg-muted'
                }`}
                onClick={() => setLinenInventoryHousekeeper(name)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    linenInventoryHousekeeper === name ? 'bg-primary border-primary' : 'border-muted-foreground'
                  }`}>
                    {linenInventoryHousekeeper === name && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="font-medium">{name}</div>
                </div>
              </div>
            ))}
            
            {/* Option pour passer */}
            <div
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                linenInventoryHousekeeper === 'none' 
                  ? 'bg-gray-100 border-gray-400' 
                  : 'bg-muted/50 hover:bg-muted'
              }`}
              onClick={() => setLinenInventoryHousekeeper('none')}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  linenInventoryHousekeeper === 'none' ? 'bg-gray-400 border-gray-400' : 'border-muted-foreground'
                }`}>
                  {linenInventoryHousekeeper === 'none' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <div className="font-medium">Pas d'inventaire aujourd'hui</div>
                  <div className="text-sm text-muted-foreground">Je le ferai manuellement plus tard</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setStep('distribution')}>
            Retour
          </Button>
          <Button
            onClick={async () => {
              // Créer la tâche d'inventaire si une femme de chambre est sélectionnée
              if (linenInventoryHousekeeper && linenInventoryHousekeeper !== 'none') {
                await createLinenInventoryTask(linenInventoryHousekeeper);
              }
              
              // Terminer le workflow
              const distributionMethod = step === 'linen-inventory' ? 'random' : undefined;
              onWorkflowComplete(pdfData, allHousekeepers, distributionMethod as any);
              setOpen(false);
              resetDialog();
            }}
            disabled={!linenInventoryHousekeeper}
          >
            Terminer
            <CheckCircle className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </>
    );
  };

  const createLinenInventoryTask = async (housekeeperName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Trouver l'ID du housekeeper
      const housekeeper = existingHousekeepers.find(h => h.name === housekeeperName);
      
      if (!housekeeper || !hotelId) {
        console.warn('Housekeeper ou hotelId manquant pour créer la tâche d\'inventaire');
        return;
      }
      
      const { error } = await supabase.from('linen_inventory_tasks').insert({
        hotel_id: hotelId,
        assigned_to: housekeeper.id,
        assigned_by: user?.id,
        task_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: 'Créé automatiquement lors de l\'import du rapport PDF'
      });
      
      if (error) {
        console.error('Erreur création tâche inventaire:', error);
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de créer la tâche d\'inventaire'
        });
      } else {
        toast({
          title: '📦 Tâche créée',
          description: `Inventaire assigné à ${housekeeperName}`
        });
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetDialog();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <FileUp className="mr-2 h-4 w-4" />
          Importer un Rapport
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] mx-auto">
        {step === 'upload' && renderUploadStep()}
        {step === 'import-mode' && renderImportModeStep()}
        {step === 'housekeepers' && renderHousekeepersStep()}
        {step === 'distribution' && renderDistributionStep()}
        {step === 'linen-inventory' && renderLinenInventoryStep()}
      </DialogContent>
    </Dialog>
  );
}