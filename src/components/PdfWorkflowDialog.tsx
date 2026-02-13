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
import { FileUp, Users, ArrowRight, CheckCircle, X, Search, Loader2, RefreshCw, AlertTriangle, Replace, RotateCcw, Plug, Clock, Eye, Brain, Calendar, User, Home, Sparkles, Map as MapIcon, Zap, Settings2, UserCheck, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UnifiedHousekeeperService, HousekeeperWithCode } from "@/services/unifiedHousekeeperService";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
import { GovernessAssignmentStep } from "@/components/workflow/GovernessAssignmentStep";
import { NewRoomsConfirmationDialog } from "@/components/NewRoomsConfirmationDialog";

interface GovernessAssignment {
  governessName: string;
  governessProfileId?: string;
  assignmentType: 'floor' | 'housekeeper';
  assignedFloors: number[];
  assignedHousekeepers: string[];
}

interface DailyInstructions {
  instructions: string;
  toKnow: string;
  todoList: string;
}

interface PdfWorkflowDialogProps {
  onWorkflowComplete: (data: any, housekeepers?: string[], distributionMethod?: 'random' | 'floor' | 'cleaning-type') => void;
  hotelId?: string;
}

export function PdfWorkflowDialog({ onWorkflowComplete, hotelId }: PdfWorkflowDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'choice' | 'upload' | 'preview' | 'mapping' | 'import-mode' | 'housekeepers' | 'governess' | 'distribution' | 'linen-inventory'>('choice');
  const [pmsMapping, setPmsMapping] = useState<Record<string, string>>({});
  const [pdfData, setPdfData] = useState<any>(null);
  const [parsedLines, setParsedLines] = useState<RoomLine[]>([]);
  const [housekeepers, setHousekeepers] = useState<string[]>([]);
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingHousekeepers, setExistingHousekeepers] = useState<HousekeeperWithCode[]>([]);
  const [governessAssignments, setGovernessAssignments] = useState<GovernessAssignment[]>([]);
  const [dailyInstructions, setDailyInstructions] = useState<DailyInstructions>({ instructions: '', toKnow: '', todoList: '' });
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
  const [savedPdfData, setSavedPdfData] = useState<any>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'a_blanc' | 'recouche'>('all');
  const [showNewRoomsDialog, setShowNewRoomsDialog] = useState(false);
  const [pendingNewRooms, setPendingNewRooms] = useState<any[]>([]);
  const [registryCount, setRegistryCount] = useState(0);
  const [pendingFilteredData, setPendingFilteredData] = useState<any[]>([]);

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
      
      // Étape 2: Extraction IA avec RoomLineParser
      setUploadStatus('🧠 Analyse IA en cours...');
      setUploadProgress(40);
      const data = await processPdf(selectedFile, hotelId);
      
      // Récupérer les lignes parsées pour la prévisualisation
      const lines = getLastParsedLines();
      setParsedLines(lines);
      setPdfData(data);
      setSavedPdfData(data);
      
      setUploadProgress(70);
      setUploadStatus('✅ Extraction terminée');
      
      // Aller à l'étape de prévisualisation
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        setStep('preview');
      }, 500);
      
    } catch (error) {
      console.error("Erreur traitement PDF:", error);
      handleUploadError(error);
    }
  };

  const handleUploadError = (error: any, canRetry = true) => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatus('');
    
    // Extraire le message d'erreur réel
    const errorMessage = error?.message || error?.error || '';
    const isCreditsError = errorMessage.toLowerCase().includes('crédit') || 
                          errorMessage.includes('402') ||
                          errorMessage.toLowerCase().includes('insufficient');
    
    if (isCreditsError) {
      // Erreur de crédits AI - ne pas réessayer
      toast({
        variant: "destructive",
        title: "Crédits IA insuffisants",
        description: "Le parsing local sera utilisé. Réimportez le PDF.",
      });
      setOpen(false);
      resetDialog();
      return;
    }
    
    if (canRetry && retryCount < 3) {
      toast({
        variant: "destructive",
        title: "Erreur de traitement",
        description: errorMessage || "Problème lors du traitement. Cliquez sur Réessayer.",
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
        description: errorMessage || "Une erreur s'est produite lors du traitement du fichier PDF.",
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

      // Récupérer et valider le hotelId
      let effectiveHotelId = hotelId;
      
      if (!effectiveHotelId) {
        // Récupérer depuis le profil utilisateur
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('current_hotel_id')
            .eq('id', user.id)
            .maybeSingle();
          effectiveHotelId = profile?.current_hotel_id;
        }
      }
      
      if (!effectiveHotelId) {
        throw new Error('ID de l\'hôtel manquant. Veuillez vous reconnecter.');
      }
      
      // Vérifier que l'utilisateur a accès à cet hôtel
      const { data: hotelCheck, error: hotelError } = await supabase
        .from('hotels')
        .select('id')
        .eq('id', effectiveHotelId)
        .maybeSingle();
        
      if (hotelError || !hotelCheck) {
        throw new Error('Accès à l\'hôtel non autorisé. Veuillez vous reconnecter.');
      }

      if (mode === 'replace') {
        // Remplacer toutes les chambres
        const result = await RoomArchiveService.replaceAllRooms(effectiveHotelId, filteredData, selectedFile?.name || 'pdf_import');
        insertedCount = result.inserted;
        
        // Vérifier si des nouvelles chambres ont été détectées
        if (result.newRoomsForRegistry && result.newRoomsForRegistry.length > 0) {
          // Sauvegarder les données pour le dialog
          const regCount = await RoomArchiveService.getRegistryCount(effectiveHotelId);
          setRegistryCount(regCount);
          setPendingNewRooms(result.newRoomsForRegistry);
          setPendingFilteredData(filteredData);
          setShowNewRoomsDialog(true);
          setIsUploading(false);
          return; // Attendre la confirmation avant de continuer
        }
        
        toast({
          title: "✅ Chambres remplacées",
          description: `${result.deleted} anciennes supprimées, ${result.inserted} nouvelles ajoutées.`,
        });
      } else {
        // Mode update (upsert)
        console.log('🔄 Début enregistrement pour', filteredData.length, 'chambres');
        
        // D'abord, récupérer le registre existant pour détecter les nouvelles chambres
        const { data: existingRegistry } = await supabase
          .from('hotel_rooms_registry')
          .select('room_number')
          .eq('hotel_id', effectiveHotelId);
        
        const existingRoomNumbers = new Set(existingRegistry?.map(r => r.room_number) || []);
        
        // Préparer les données pour la table rooms (TOUJOURS)
        const roomsForSync = filteredData.map((room: any) => {
          const rawRoomNumber = room.roomNumber || room.room_number || room.number;
          const roomNumber = normalizeRoomNumber(rawRoomNumber);
          
          let dbCleaningType = 'a_blanc';
          if (room.cleaningType === 'none' || room.notUrgent === true) {
            dbCleaningType = 'none';
          } else if (room.cleaningType === 'recouche' || room.cleaningType === 'quick') {
            dbCleaningType = 'recouche';
          } else if (room.cleaningType === 'a_blanc' || room.cleaningType === 'full') {
            dbCleaningType = 'a_blanc';
          }
          
          console.log(`📝 Chambre ${roomNumber}: cleaningType=${room.cleaningType} → DB=${dbCleaningType}`);
          
          // IMPORTANT: Le statut "checkout" ne doit JAMAIS être automatique
          // Seul l'admin peut manuellement définir "client sorti"
          // On garde uniquement le cleaningType (a_blanc/recouche) pour le type de nettoyage
          let finalStatus = room.status || 'dirty';
          if (finalStatus === 'checkout' || finalStatus === 'checkout_arrival' || finalStatus === 'checkout_checkin') {
            finalStatus = 'dirty'; // Toujours "à nettoyer" par défaut
          }
          
          return {
            hotel_id: effectiveHotelId,
            room_number: roomNumber,
            floor: room.floor ?? null,
            status: finalStatus,
            room_type: room.type || room.room_type || null,
            cleaning_priority: room.priority === 'high' ? 2 : 1,
            notes: room.notes || null,
            cleaning_type: dbCleaningType
          };
        }).filter(r => !!r.room_number);

        // Dédupliquer les chambres (garder la dernière occurrence de chaque room_number)
        const deduplicatedRooms = Array.from(
          new Map(roomsForSync.map(r => [`${r.hotel_id}-${r.room_number}`, r])).values()
        );
        
        // Sauvegarder les chambres dans la table rooms
        setUploadStatus(`💾 Enregistrement de ${deduplicatedRooms.length} chambres...`);
        
        const timeout = 15000;
        const roomsResult = await Promise.race([
          supabase.from('rooms').upsert(deduplicatedRooms, { onConflict: 'hotel_id,room_number', ignoreDuplicates: false }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout rooms')), timeout))
        ]) as any;

        if (roomsResult.error) throw roomsResult.error;
        
        insertedCount = deduplicatedRooms.length;
        setUploadProgress(85);

        // Identifier les NOUVELLES chambres (pas dans le registre existant)
        const newRoomsForRegistry = filteredData
          .map((room: any) => {
            const rawRoomNumber = room.roomNumber || room.room_number || room.number;
            const roomNumber = normalizeRoomNumber(rawRoomNumber);
            if (!roomNumber || existingRoomNumbers.has(roomNumber)) {
              return null;
            }
            return {
              room_number: roomNumber,
              floor: room.floor ?? null,
              room_type: room.type || room.room_type || null,
              building: room.building || null,
              zone: room.zone || null,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
        
        // Dédupliquer
        const uniqueNewRooms = Array.from(
          new Map(newRoomsForRegistry.map(r => [r.room_number, r])).values()
        );

        console.log(`📋 ${uniqueNewRooms.length} nouvelles chambres détectées (mode update)`);

        // Si des nouvelles chambres sont détectées, demander confirmation
        if (uniqueNewRooms.length > 0) {
          const regCount = await RoomArchiveService.getRegistryCount(effectiveHotelId);
          setRegistryCount(regCount);
          setPendingNewRooms(uniqueNewRooms);
          setPendingFilteredData(filteredData);
          setUploadProgress(90);
          setShowNewRoomsDialog(true);
          setIsUploading(false);
          return; // Attendre la confirmation
        }
        
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

  // Handler pour confirmer l'ajout des nouvelles chambres au registre
  const handleConfirmNewRooms = async (selectedRooms: any[]) => {
    const effectiveHotelId = hotelId || localStorage.getItem('selectedHotelId') || localStorage.getItem('currentHotelId');
    
    if (effectiveHotelId && selectedRooms.length > 0) {
      try {
        await RoomArchiveService.addRoomsToRegistry(effectiveHotelId, selectedRooms, selectedFile?.name || 'pdf_import');
        toast({
          title: "✅ Registre mis à jour",
          description: `${selectedRooms.length} chambre(s) ajoutée(s) au registre permanent.`,
        });
      } catch (error) {
        console.error('Erreur ajout au registre:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible d'ajouter les chambres au registre.",
        });
      }
    }
    
    setShowNewRoomsDialog(false);
    setPendingNewRooms([]);
    proceedToHousekeepers(pendingFilteredData);
  };

  // Handler pour ignorer l'ajout au registre
  const handleSkipNewRooms = () => {
    setShowNewRoomsDialog(false);
    setPendingNewRooms([]);
    toast({
      title: "ℹ️ Registre inchangé",
      description: "Les nouvelles chambres sont utilisées pour aujourd'hui uniquement.",
    });
    proceedToHousekeepers(pendingFilteredData);
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
    setParsedLines([]);
    setStep('choice');
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
    setPreviewFilter('all');
    setPmsMapping({});
  };

  // Mots-clés PMS couramment utilisés
  const PMS_STATUS_KEYWORDS = [
    'INS', 'PRO', 'SAL', 'DEP', 'DIR', 'DND', 'OOO', 'VAC', 'OCC', 
    'ARR', 'STAY', 'CHECK-IN', 'CHECK-OUT', 'DIRTY', 'CLEAN', 'DUE OUT',
    'LIBRE', 'OCCUPE', 'DEPART', 'ARRIVEE', 'RECOUCHE', 'A BLANC'
  ];

  const CLEANING_TYPES = [
    { value: 'a_blanc', label: 'À blanc (Départ)', color: 'bg-orange-500' },
    { value: 'recouche', label: 'Recouche (Occupé)', color: 'bg-green-500' },
    { value: 'none', label: 'Pas de ménage', color: 'bg-gray-500' },
  ];

  // Détecter les mots-clés présents dans le rapport
  const detectedKeywords = useMemo(() => {
    const keywords = new Set<string>();
    
    parsedLines.forEach(line => {
      const rawLine = (line.fullText || line.statusCode || '').toUpperCase();
      PMS_STATUS_KEYWORDS.forEach(keyword => {
        if (rawLine.includes(keyword)) {
          keywords.add(keyword);
        }
      });
    });
    
    return Array.from(keywords);
  }, [parsedLines]);

  // Initialiser le mapping avec des valeurs par défaut intelligentes
  const initializeMapping = () => {
    const initial: Record<string, string> = {};
    detectedKeywords.forEach(keyword => {
      if (['DEP', 'DIR', 'SAL', 'CHECK-OUT', 'VAC', 'DIRTY', 'DUE OUT', 'DEPART', 'LIBRE', 'A BLANC'].includes(keyword)) {
        initial[keyword] = 'a_blanc';
      } else if (['PRO', 'INS', 'ARR', 'STAY', 'OCC', 'CHECK-IN', 'OCCUPE', 'ARRIVEE', 'RECOUCHE'].includes(keyword)) {
        initial[keyword] = 'recouche';
      } else if (['DND', 'OOO'].includes(keyword)) {
        initial[keyword] = 'none';
      } else {
        initial[keyword] = 'recouche';
      }
    });
    return initial;
  };

  // Appliquer le mapping aux chambres
  const applyMappingToRooms = (mapping: Record<string, string>) => {
    if (!pdfData || Object.keys(mapping).length === 0) return pdfData;
    
    return pdfData.map((room: any) => {
      const rawLine = (room.fullText || room.status || '').toUpperCase();
      let mappedType = room.cleaningType || 'recouche';
      
      for (const keyword of Object.keys(mapping)) {
        if (rawLine.includes(keyword)) {
          mappedType = mapping[keyword];
          break;
        }
      }
      
      return { ...room, cleaningType: mappedType };
    });
  };

  // Statistiques avec mapping appliqué
  const mappingStats = useMemo(() => {
    if (!pdfData || Object.keys(pmsMapping).length === 0) return null;
    
    const mappedRooms = applyMappingToRooms(pmsMapping);
    const aBlancCount = mappedRooms.filter((r: any) => r.cleaningType === 'a_blanc').length;
    const recoucheCount = mappedRooms.filter((r: any) => r.cleaningType === 'recouche').length;
    const noneCount = mappedRooms.filter((r: any) => r.cleaningType === 'none').length;
    
    return { aBlancCount, recoucheCount, noneCount, total: mappedRooms.length };
  }, [pdfData, pmsMapping]);

  const updatePmsMapping = (keyword: string, value: string) => {
    setPmsMapping(prev => ({ ...prev, [keyword]: value }));
  };

  const autoMapKeywords = () => {
    const newMapping = initializeMapping();
    setPmsMapping(newMapping);
    toast({
      title: "✨ Mapping automatique",
      description: "Les correspondances ont été définies automatiquement.",
    });
  };

  const proceedFromMapping = async () => {
    // Appliquer le mapping final aux données
    const mappedData = applyMappingToRooms(pmsMapping);
    setPdfData(mappedData);
    setSavedPdfData(mappedData);
    
    // Mettre à jour les parsedLines aussi pour cohérence
    const updatedLines = parsedLines.map(line => {
      const rawLine = (line.fullText || line.statusCode || '').toUpperCase();
      let mappedType = line.cleaningType || 'recouche';
      
      for (const keyword of Object.keys(pmsMapping)) {
        if (rawLine.includes(keyword)) {
          mappedType = pmsMapping[keyword] as any;
          break;
        }
      }
      
      return { ...line, cleaningType: mappedType };
    });
    setParsedLines(updatedLines);

    // Continuer vers import-mode
    if (!hotelId || !mappedData || mappedData.length === 0) {
      proceedToHousekeepers(mappedData || []);
      return;
    }

    setIsUploading(true);
    setUploadStatus('🔍 Vérification des chambres existantes...');
    setUploadProgress(50);

    try {
      const { count } = await supabase
        .from('rooms')
        .select('id', { count: 'estimated', head: true })
        .eq('hotel_id', hotelId);
      
      const existingCount = count || 0;
      setExistingRoomsCount(existingCount);

      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');

      if (existingCount > 0) {
        setStep('import-mode');
      } else {
        await saveRoomsToDatabase(mappedData, 'update');
      }
    } catch (error) {
      handleUploadError(error);
    }
  };

  // Statistiques de l'extraction IA
  const extractionStats = useMemo(() => {
    if (!parsedLines.length) return null;
    
    const aBlancCount = parsedLines.filter(l => l.cleaningType === 'a_blanc').length;
    const recoucheCount = parsedLines.filter(l => l.cleaningType === 'recouche').length;
    const noneCount = parsedLines.filter(l => l.cleaningType === 'none' || l.cleaningType === 'inspection').length;
    const avgConfidence = parsedLines.reduce((sum, l) => sum + l.confidence, 0) / parsedLines.length;
    const withGuest = parsedLines.filter(l => l.guestName).length;
    const withDates = parsedLines.filter(l => l.arrivalDate || l.departureDate).length;
    
    return {
      total: parsedLines.length,
      aBlancCount,
      recoucheCount,
      noneCount,
      avgConfidence,
      withGuest,
      withDates
    };
  }, [parsedLines]);

  // Lignes filtrées pour la prévisualisation
  const filteredLines = useMemo(() => {
    if (previewFilter === 'all') return parsedLines;
    return parsedLines.filter(l => l.cleaningType === previewFilter);
  }, [parsedLines, previewFilter]);

  const proceedFromPreview = () => {
    // Initialiser le mapping automatiquement et passer à l'étape mapping
    if (detectedKeywords.length > 0) {
      const initialMapping = initializeMapping();
      setPmsMapping(initialMapping);
      setStep('mapping');
    } else {
      // Si pas de mots-clés détectés, passer directement à import-mode
      proceedFromMapping();
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const renderChoiceStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Importer les chambres</DialogTitle>
        <DialogDescription>
          Choisissez comment importer les données de vos chambres
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-3 py-4">
        {/* Option PDF */}
        <button
          onClick={() => setStep('upload')}
          className="w-full p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <FileUp className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Télécharger un rapport PDF</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Importez un rapport depuis votre PMS (Mews, Apaleo, Opera, Protel, etc.)
              </p>
              <Badge variant="secondary" className="text-xs mt-2">
                Extraction automatique IA
              </Badge>
            </div>
          </div>
        </button>

        {/* Option API - Coming Soon */}
        <div className="w-full p-4 rounded-lg border-2 border-dashed border-border bg-muted/30 relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-muted text-muted-foreground">
              <Plug className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-muted-foreground">Connexion API directe</h3>
                <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 bg-amber-500/10">
                  <Clock className="h-3 w-3 mr-1" />
                  Bientôt disponible
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Synchronisation automatique avec votre PMS en temps réel
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background border text-xs text-muted-foreground">
                  <span className="font-medium">Mews</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background border text-xs text-muted-foreground">
                  <span className="font-medium">Apaleo</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background border text-xs text-muted-foreground">
                  <span className="font-medium">Opera</span>
                </div>
                <span className="text-xs text-muted-foreground">et plus...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

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
        <Button variant="outline" onClick={() => setStep('choice')}>
          Retour
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

  const renderPreviewStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <Badge variant="secondary" className="text-xs">Étape 2/4</Badge>
          Prévisualisation IA
        </DialogTitle>
        <DialogDescription>
          L'IA a analysé votre rapport. Vérifiez les données extraites avant de continuer.
        </DialogDescription>
      </DialogHeader>
      
      {/* Statistiques */}
      {extractionStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-700">{extractionStats.total}</p>
                <p className="text-xs text-blue-600">Chambres</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-700">{extractionStats.aBlancCount}</p>
                <p className="text-xs text-orange-600">À blanc</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">{extractionStats.recoucheCount}</p>
                <p className="text-xs text-green-600">Recouches</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-700">{extractionStats.avgConfidence.toFixed(0)}%</p>
                <p className="text-xs text-purple-600">Confiance</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2">
        <Button
          variant={previewFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPreviewFilter('all')}
        >
          Tous ({parsedLines.length})
        </Button>
        <Button
          variant={previewFilter === 'a_blanc' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPreviewFilter('a_blanc')}
          className={previewFilter === 'a_blanc' ? 'bg-orange-500 hover:bg-orange-600' : ''}
        >
          À blanc ({extractionStats?.aBlancCount || 0})
        </Button>
        <Button
          variant={previewFilter === 'recouche' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPreviewFilter('recouche')}
          className={previewFilter === 'recouche' ? 'bg-green-500 hover:bg-green-600' : ''}
        >
          Recouches ({extractionStats?.recoucheCount || 0})
        </Button>
      </div>

      {/* Liste des chambres */}
      <ScrollArea className="h-[300px] border rounded-lg">
        <div className="p-2 space-y-2">
          {filteredLines.map((line, idx) => (
            <Card 
              key={`${line.roomNumber}-${idx}`} 
              className={`p-3 ${
                line.cleaningType === 'a_blanc' 
                  ? 'border-l-4 border-l-orange-500 bg-orange-50/30' 
                  : line.cleaningType === 'recouche'
                    ? 'border-l-4 border-l-green-500 bg-green-50/30'
                    : 'border-l-4 border-l-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Numéro et type */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono font-bold text-lg px-3 py-1">
                    {line.roomNumber}
                  </Badge>
                  {line.roomType && (
                    <Badge variant="secondary" className="text-xs">
                      {line.roomType}{line.roomCategory ? `-${line.roomCategory}` : ''}
                    </Badge>
                  )}
                </div>
                
                {/* Type de nettoyage */}
                <Badge 
                  className={`${
                    line.cleaningType === 'a_blanc' 
                      ? 'bg-orange-500 text-white' 
                      : line.cleaningType === 'recouche'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-400 text-white'
                  }`}
                >
                  {line.cleaningType === 'a_blanc' ? '🔶 À blanc' : 
                   line.cleaningType === 'recouche' ? '🔄 Recouche' : 
                   '⏸️ Aucun'}
                </Badge>
              </div>
              
              {/* Détails */}
              <div className="mt-2 flex flex-wrap gap-2">
                {line.guestName && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    <User className="h-3 w-3 mr-1" />
                    {line.guestName}
                  </Badge>
                )}
                
                {line.departureDate && (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                    <Calendar className="h-3 w-3 mr-1" />
                    Départ: {line.departureDate}
                  </Badge>
                )}
                
                {line.arrivalDate && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    <Calendar className="h-3 w-3 mr-1" />
                    Arrivée: {line.arrivalDate}
                  </Badge>
                )}
                
                {line.checkOutTime && (
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Départ: {line.checkOutTime}
                  </Badge>
                )}
                
                {line.checkInTime && (
                  <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Arrivée: {line.checkInTime}
                  </Badge>
                )}
                
                {line.nightInfo && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    Nuit {line.nightInfo.current}/{line.nightInfo.total}
                  </Badge>
                )}
                
                {(line.adults || line.children) && (
                  <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                    {line.adults || 0} Ad. {line.children ? `+ ${line.children} Enf.` : ''}
                  </Badge>
                )}
                
                {line.statusCode && (
                  <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                    {line.statusCode}
                  </Badge>
                )}
              </div>
              
              {/* Raison du type de nettoyage */}
              <p className="text-xs text-muted-foreground mt-2 italic">
                {line.cleaningReason}
              </p>
            </Card>
          ))}
          
          {filteredLines.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucune chambre dans cette catégorie
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Avertissement si confiance basse */}
      {extractionStats && extractionStats.avgConfidence < 70 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            La confiance moyenne est faible ({extractionStats.avgConfidence.toFixed(0)}%). 
            Utilisez l'entraînement IA pour améliorer la reconnaissance de ce format.
          </AlertDescription>
        </Alert>
      )}
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('upload')}>
          Retour
        </Button>
        <Button
          onClick={proceedFromPreview}
          disabled={isUploading || !pdfData || pdfData.length === 0}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {uploadStatus}
            </>
          ) : (
            <>
              Valider et continuer
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );

  const renderMappingStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-primary" />
          <Badge variant="secondary" className="text-xs">Étape 3/5</Badge>
          Mapping des statuts PMS
        </DialogTitle>
        <DialogDescription>
          Ajustez les correspondances entre les codes PMS détectés et les types de nettoyage.
        </DialogDescription>
      </DialogHeader>
      
      {/* Statistiques avec mapping appliqué */}
      {mappingStats && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-700">{mappingStats.aBlancCount}</p>
              <p className="text-xs text-orange-600">À blanc</p>
            </div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">{mappingStats.recoucheCount}</p>
              <p className="text-xs text-green-600">Recouche</p>
            </div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-700">{mappingStats.noneCount}</p>
              <p className="text-xs text-gray-600">Pas de ménage</p>
            </div>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Configuration du mapping */}
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Correspondances
              </h3>
              <Button size="sm" variant="outline" onClick={autoMapKeywords}>
                <Zap className="h-4 w-4 mr-1" />
                Auto
              </Button>
            </div>
            
            {detectedKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun mot-clé de statut détecté dans les chambres.
              </p>
            ) : (
              <ScrollArea className="h-[220px]">
                <div className="space-y-3 pr-2">
                  {detectedKeywords.map(keyword => (
                    <div key={keyword} className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="font-mono font-bold">
                        {keyword}
                      </Badge>
                      <Select
                        value={pmsMapping[keyword] || 'recouche'}
                        onValueChange={(v) => updatePmsMapping(keyword, v)}
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLEANING_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${type.color}`} />
                                {type.label.split(' ')[0]}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </Card>

        {/* Aperçu des chambres avec mapping */}
        <Card>
          <div className="p-4">
            <h3 className="font-semibold mb-4">Aperçu avec mapping</h3>
            <ScrollArea className="h-[220px]">
              <div className="space-y-2">
                {pdfData?.slice(0, 20).map((room: any, idx: number) => {
                  // Appliquer le mapping pour prévisualisation
                  const rawLine = (room.fullText || room.status || '').toUpperCase();
                  let mappedType = room.cleaningType || 'recouche';
                  
                  for (const keyword of Object.keys(pmsMapping)) {
                    if (rawLine.includes(keyword)) {
                      mappedType = pmsMapping[keyword];
                      break;
                    }
                  }
                  
                  const typeConfig = CLEANING_TYPES.find(t => t.value === mappedType);
                  
                  return (
                    <div
                      key={`${room.roomNumber}-${idx}`}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span className="font-mono font-bold">{room.roomNumber || room.room_number}</span>
                      <Badge className={`${typeConfig?.color || 'bg-gray-500'} text-white text-xs`}>
                        {typeConfig?.label.split(' ')[0] || mappedType}
                      </Badge>
                    </div>
                  );
                })}
                {(pdfData?.length || 0) > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ... et {(pdfData?.length || 0) - 20} autres chambres
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </Card>
      </div>

      {/* Information */}
      <Alert>
        <Brain className="h-4 w-4" />
        <AlertDescription>
          Le mapping que vous configurez ici sera appliqué aux chambres avant l'enregistrement.
          Cela permet d'ajuster la détection automatique selon votre PMS.
        </AlertDescription>
      </Alert>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('preview')}>
          Retour
        </Button>
        <Button
          onClick={proceedFromMapping}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {uploadStatus}
            </>
          ) : (
            <>
              Appliquer et continuer
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
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

  // Calculer la recommandation du nombre de femmes de chambre
  const getHousekeeperRecommendation = () => {
    if (!pdfData || pdfData.length === 0) return { recommended: 1, totalTime: 0, fullCount: 0, quickCount: 0 };
    
    const fullCleaningTime = 30; // minutes
    const quickCleaningTime = 15; // minutes
    const averageTimePerHousekeeper = 360; // 6 heures = 360 minutes
    
    let fullCount = 0;
    let quickCount = 0;
    
    pdfData.forEach((room: any) => {
      const cleaningType = room.cleaningType || room.cleaning_type || room.type;
      if (cleaningType === 'full' || cleaningType === 'a_blanc' || cleaningType === 'départ') {
        fullCount++;
      } else if (cleaningType === 'quick' || cleaningType === 'recouche' || cleaningType === 'recoucher') {
        quickCount++;
      } else {
        // Par défaut, considérer comme nettoyage rapide
        quickCount++;
      }
    });
    
    const totalTime = (fullCount * fullCleaningTime) + (quickCount * quickCleaningTime);
    const recommended = Math.max(1, Math.ceil(totalTime / averageTimePerHousekeeper));
    
    return { recommended, totalTime, fullCount, quickCount };
  };

  const renderHousekeepersStep = () => {
    const recommendation = getHousekeeperRecommendation();
    const totalSelected = housekeepers.length + selectedExisting.length;
    
    return (
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
        {/* Recommandation basée sur l'analyse */}
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <span className="font-semibold">Recommandation</span>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-foreground font-medium text-lg">
              {recommendation.recommended} femme{recommendation.recommended > 1 ? 's' : ''} de chambre recommandée{recommendation.recommended > 1 ? 's' : ''}
            </p>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Temps total estimé : <strong>{Math.round(recommendation.totalTime / 60)}h{recommendation.totalTime % 60 > 0 ? ` ${recommendation.totalTime % 60}min` : ''}</strong>
              </p>
              <p className="text-xs">
                • {recommendation.fullCount} nettoyage{recommendation.fullCount > 1 ? 's' : ''} complet{recommendation.fullCount > 1 ? 's' : ''} (30 min/ch)
                {recommendation.quickCount > 0 && ` • ${recommendation.quickCount} recouche${recommendation.quickCount > 1 ? 's' : ''} (15 min/ch)`}
              </p>
            </div>
          </div>
          {totalSelected > 0 && (
            <div className={`mt-3 pt-3 border-t border-primary/20 text-sm ${totalSelected >= recommendation.recommended ? 'text-green-600' : 'text-amber-600'}`}>
              {totalSelected >= recommendation.recommended 
                ? `✓ ${totalSelected} sélectionnée${totalSelected > 1 ? 's' : ''} - Vous êtes dans la recommandation`
                : `⚠ ${totalSelected} sélectionnée${totalSelected > 1 ? 's' : ''} - Il en faudrait au moins ${recommendation.recommended}`
              }
            </div>
          )}
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
          onClick={() => setStep('governess')}
          disabled={selectedExisting.length === 0 && housekeepers.length === 0}
        >
          Continuer
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );
  };

  const handleGovernessComplete = async (assignments: GovernessAssignment[], instructions: DailyInstructions) => {
    setGovernessAssignments(assignments);
    setDailyInstructions(instructions);

    // Save to database
    if (hotelId) {
      const today = new Date().toISOString().split('T')[0];
      const { data: { user } } = await supabase.auth.getUser();

      // Save daily instructions
      if (instructions.instructions || instructions.toKnow || instructions.todoList) {
        await supabase.from('daily_instructions').upsert({
          hotel_id: hotelId,
          instruction_date: today,
          instructions: instructions.instructions || null,
          to_know: instructions.toKnow || null,
          todo_list: instructions.todoList || null,
          created_by: user?.id
        }, { onConflict: 'hotel_id,instruction_date' });
      }

      // Save governess assignments
      for (const assignment of assignments) {
        await supabase.from('daily_governess_assignments').upsert({
          hotel_id: hotelId,
          assignment_date: today,
          governess_name: assignment.governessName,
          governess_profile_id: assignment.governessProfileId || null,
          assignment_type: assignment.assignmentType,
          assigned_floors: assignment.assignedFloors,
          assigned_housekeepers: assignment.assignedHousekeepers,
          created_by: user?.id
        }, { onConflict: 'hotel_id,assignment_date,governess_name' });
      }
    }

    setStep('distribution');
  };

  const renderGovernessStep = () => {
    const allHousekeepers = [...selectedExisting, ...housekeepers];
    
    return (
      <GovernessAssignmentStep
        hotelId={hotelId || ''}
        housekeeperNames={allHousekeepers}
        pdfData={pdfData || []}
        onComplete={handleGovernessComplete}
        onBack={() => setStep('housekeepers')}
      />
    );
  };

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
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <FileUp className="mr-2 h-4 w-4" />
            Importer les chambres
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] mx-auto">
          {step === 'choice' && renderChoiceStep()}
          {step === 'upload' && renderUploadStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'import-mode' && renderImportModeStep()}
          {step === 'housekeepers' && renderHousekeepersStep()}
          {step === 'governess' && renderGovernessStep()}
          {step === 'distribution' && renderDistributionStep()}
          {step === 'linen-inventory' && renderLinenInventoryStep()}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation pour les nouvelles chambres */}
      <NewRoomsConfirmationDialog
        isOpen={showNewRoomsDialog}
        onClose={() => setShowNewRoomsDialog(false)}
        newRooms={pendingNewRooms}
        existingRoomsCount={registryCount}
        onConfirm={handleConfirmNewRooms}
        onSkip={handleSkipNewRooms}
      />
    </>
  );
}