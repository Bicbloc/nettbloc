import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { Room } from "@/services/pdfService";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportCSVDialogProps {
  onImportRooms: (rooms: Room[]) => void;
  existingRooms: Room[];
}

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  roomNumber: string;
  cleaningType: string;
  status: string;
  floor: string;
}

const cleaningTypeMap: Record<string, Room['cleaningType']> = {
  'a blanc': 'a_blanc',
  'à blanc': 'a_blanc',
  'blanc': 'a_blanc',
  'depart': 'a_blanc',
  'départ': 'a_blanc',
  'checkout': 'a_blanc',
  'full': 'a_blanc',
  'recouche': 'recouche',
  'stay': 'recouche',
  'occupé': 'recouche',
  'occupe': 'recouche',
  'occupied': 'recouche',
  'quick': 'recouche',
  'none': 'none',
  'aucun': 'none',
};

const statusMap: Record<string, string> = {
  'sale': 'DIRTY',
  'dirty': 'DIRTY',
  'propre': 'CLEAN',
  'clean': 'CLEAN',
  'depart': 'DEPARTURE',
  'départ': 'DEPARTURE',
  'departure': 'DEPARTURE',
  'arrivee': 'ARRIVAL',
  'arrivée': 'ARRIVAL',
  'arrival': 'ARRIVAL',
  'occupe': 'STAY',
  'occupé': 'STAY',
  'occupied': 'STAY',
  'stay': 'STAY',
  'libre': 'VACANT',
  'vacant': 'VACANT',
  'maintenance': 'MAINTENANCE',
  'ooo': 'OOO',
  'hors service': 'OOO',
};

export function ImportCSVDialog({ onImportRooms, existingRooms }: ImportCSVDialogProps) {
  const [open, setOpen] = useState(false);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    roomNumber: '',
    cleaningType: '',
    status: '',
    floor: '',
  });
  const [previewRooms, setPreviewRooms] = useState<Room[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): { headers: string[], data: CSVRow[] } => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données');
    }

    // Detect separator (comma or semicolon)
    const separator = lines[0].includes(';') ? ';' : ',';
    
    const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
    const data: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
      if (values.length === headers.length) {
        const row: CSVRow = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return { headers, data };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers, data } = parseCSV(text);
        setHeaders(headers);
        setCsvData(data);
        
        // Auto-detect column mapping
        const autoMapping: ColumnMapping = {
          roomNumber: headers.find(h => /chambre|room|numero|numéro|n°/i.test(h)) || '',
          cleaningType: headers.find(h => /nettoyage|cleaning|type/i.test(h)) || '',
          status: headers.find(h => /statut|status|état|etat/i.test(h)) || '',
          floor: headers.find(h => /etage|étage|floor/i.test(h)) || '',
        };
        setMapping(autoMapping);
        setErrors([]);
        setPreviewRooms([]);
        
        toast({
          title: "Fichier chargé",
          description: `${data.length} lignes détectées`,
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Erreur lors de la lecture du fichier",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const generatePreview = () => {
    if (!mapping.roomNumber) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner la colonne du numéro de chambre",
        variant: "destructive",
      });
      return;
    }

    const rooms: Room[] = [];
    const newErrors: string[] = [];

    csvData.forEach((row, index) => {
      const roomNumber = row[mapping.roomNumber]?.trim();
      if (!roomNumber) {
        newErrors.push(`Ligne ${index + 2}: Numéro de chambre manquant`);
        return;
      }

      // Check for duplicates in existing rooms
      if (existingRooms.some(r => r.number === roomNumber)) {
        newErrors.push(`Ligne ${index + 2}: Chambre ${roomNumber} existe déjà`);
        return;
      }

      // Check for duplicates in imported data
      if (rooms.some(r => r.number === roomNumber)) {
        newErrors.push(`Ligne ${index + 2}: Chambre ${roomNumber} en doublon dans le fichier`);
        return;
      }

      // Parse cleaning type
      let cleaningType: Room['cleaningType'] = 'a_blanc';
      if (mapping.cleaningType && row[mapping.cleaningType]) {
        const rawType = row[mapping.cleaningType].toLowerCase().trim();
        cleaningType = cleaningTypeMap[rawType] || 'a_blanc';
      }

      // Parse status
      let status = 'DIRTY';
      if (mapping.status && row[mapping.status]) {
        const rawStatus = row[mapping.status].toLowerCase().trim();
        status = statusMap[rawStatus] || 'DIRTY';
      }

      // Parse floor
      let floor: number | undefined;
      if (mapping.floor && row[mapping.floor]) {
        const parsedFloor = parseInt(row[mapping.floor]);
        if (!isNaN(parsedFloor)) {
          floor = parsedFloor;
        }
      } else {
        // Try to extract floor from room number
        const match = roomNumber.match(/^(\d)/);
        if (match) {
          floor = parseInt(match[1]);
        }
      }

      rooms.push({
        number: roomNumber,
        cleaningType,
        status,
        floor,
        priority: 'medium',
      });
    });

    setPreviewRooms(rooms);
    setErrors(newErrors);
  };

  const handleImport = () => {
    if (previewRooms.length === 0) {
      toast({
        title: "Erreur",
        description: "Aucune chambre à importer. Générez d'abord un aperçu.",
        variant: "destructive",
      });
      return;
    }

    onImportRooms(previewRooms);
    
    toast({
      title: "Import réussi",
      description: `${previewRooms.length} chambres importées avec succès`,
    });

    // Reset state
    setCsvData([]);
    setHeaders([]);
    setMapping({ roomNumber: '', cleaningType: '', status: '', floor: '' });
    setPreviewRooms([]);
    setErrors([]);
    setOpen(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getCleaningTypeLabel = (type: string | undefined) => {
    switch (type) {
      case 'a_blanc':
      case 'full': return 'À Blanc';
      case 'recouche':
      case 'quick': return 'Recouche';
      case 'none': return 'Aucun';
      default: return type || 'À Blanc';
    }
  };

  const isFullCleaning = (type: string | undefined) => {
    return type === 'a_blanc' || type === 'full';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Importer CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer des chambres depuis un fichier CSV</DialogTitle>
          <DialogDescription>
            Importez un fichier CSV contenant les chambres avec leur type de nettoyage.
            Format supporté: colonnes séparées par virgule ou point-virgule.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* File upload */}
          <div className="space-y-2">
            <Label>Fichier CSV</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Exemple de format: numero;type_nettoyage;statut;etage
            </p>
          </div>

          {/* Column mapping */}
          {headers.length > 0 && (
            <div className="space-y-3">
              <Label>Correspondance des colonnes</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Numéro de chambre *</Label>
                  <Select value={mapping.roomNumber} onValueChange={(v) => setMapping(prev => ({ ...prev, roomNumber: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type de nettoyage</Label>
                  <Select value={mapping.cleaningType || '__none__'} onValueChange={(v) => setMapping(prev => ({ ...prev, cleaningType: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Non défini</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Statut</Label>
                  <Select value={mapping.status || '__none__'} onValueChange={(v) => setMapping(prev => ({ ...prev, status: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Non défini</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Étage</Label>
                  <Select value={mapping.floor || '__none__'} onValueChange={(v) => setMapping(prev => ({ ...prev, floor: v === '__none__' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Auto (depuis numéro)</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generatePreview} variant="secondary" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Générer l'aperçu
              </Button>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-2">
                <AlertCircle className="h-4 w-4" />
                {errors.length} erreur(s) détectée(s)
              </div>
              <ScrollArea className="max-h-20">
                <ul className="text-xs text-destructive space-y-1">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {/* Preview */}
          {previewRooms.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-2">
                <CheckCircle className="h-4 w-4" />
                {previewRooms.length} chambre(s) prête(s) à importer
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chambre</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Étage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRooms.slice(0, 10).map((room, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{room.number}</TableCell>
                        <TableCell>
                          <Badge variant={isFullCleaning(room.cleaningType) ? 'default' : 'secondary'}>
                            {getCleaningTypeLabel(room.cleaningType)}
                          </Badge>
                        </TableCell>
                        <TableCell>{room.status}</TableCell>
                        <TableCell>{room.floor || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {previewRooms.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          ... et {previewRooms.length - 10} autres chambres
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={previewRooms.length === 0}>
            Importer {previewRooms.length} chambre(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}