import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Save, Database, Brain, Copy, Play, Check, X, RefreshCw, FileText, Settings, Upload, Building, MapPin } from "lucide-react";
import { smartExtractionService, PmsPattern } from "@/services/smartExtractionService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface CleaningRule {
  keyword: string;
  status: string;
  cleaningType: 'full' | 'quick' | 'none';
  priority: number;
  conditions?: {
    hasGuest?: boolean;
    hasDates?: boolean;
    nightPattern?: string;
  };
}

interface HotelInfo {
  id: string;
  name: string;
  hotel_code: string | null;
}

export const PmsPatternManager = ({ hotelId }: { hotelId: string }) => {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPattern, setEditingPattern] = useState<any>(null);
  const [newKeyword, setNewKeyword] = useState({ keyword: '', status: '', cleaning: 'full', priority: 10 });
  const [activeTab, setActiveTab] = useState('patterns');
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [selectedPatternForRules, setSelectedPatternForRules] = useState<any>(null);
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  
  // Nouveau: infos hôtel et export
  const [currentHotel, setCurrentHotel] = useState<HotelInfo | null>(null);
  const [userHotels, setUserHotels] = useState<HotelInfo[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [patternToExport, setPatternToExport] = useState<any>(null);
  const [exportTargetHotelId, setExportTargetHotelId] = useState<string>('');
  const [exportAutoValidate, setExportAutoValidate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadPatterns();
    loadHotelInfo();
  }, [hotelId]);

  const loadPatterns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('report_training_patterns')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les patterns", variant: "destructive" });
      return;
    }

    setPatterns(data || []);
    setLoading(false);
  };

  const loadHotelInfo = async () => {
    // Charger les infos de l'hôtel actuel
    const { data: currentHotelData } = await supabase
      .from('hotels')
      .select('id, name, hotel_code')
      .eq('id', hotelId)
      .single();

    if (currentHotelData) {
      setCurrentHotel(currentHotelData);
    }

    // Charger tous les hôtels de l'utilisateur
    const user = await supabase.auth.getUser();
    if (user.data.user) {
      const { data: hotelsData } = await supabase
        .from('hotels')
        .select('id, name, hotel_code')
        .eq('user_id', user.data.user.id)
        .order('name');

      if (hotelsData) {
        setUserHotels(hotelsData);
      }
    }
  };

  const openExportDialog = (pattern: any) => {
    setPatternToExport(pattern);
    setExportTargetHotelId('');
    setExportAutoValidate(false);
    setShowExportDialog(true);
  };

  const exportPatternToHotel = async () => {
    if (!patternToExport || !exportTargetHotelId) {
      toast({ title: "Erreur", description: "Sélectionnez un établissement", variant: "destructive" });
      return;
    }

    if (exportTargetHotelId === hotelId) {
      toast({ title: "Erreur", description: "Sélectionnez un établissement différent", variant: "destructive" });
      return;
    }

    setIsExporting(true);

    try {
      const user = await supabase.auth.getUser();
      const targetHotel = userHotels.find(h => h.id === exportTargetHotelId);

      const newPattern = {
        hotel_id: exportTargetHotelId,
        assigned_to_hotel_id: exportTargetHotelId,
        created_by: user.data.user?.id,
        pms_type: patternToExport.pms_type,
        report_name: `${patternToExport.report_name} (depuis ${currentHotel?.name || 'autre'})`,
        pattern_name: `${patternToExport.pattern_name || patternToExport.report_name} (adapté)`,
        raw_text: patternToExport.raw_text || '',
        extracted_data: patternToExport.extracted_data || [],
        detection_rules: patternToExport.detection_rules,
        validated: exportAutoValidate,
        accuracy_score: patternToExport.accuracy_score,
        attribution_reason: `Exporté depuis ${currentHotel?.name || hotelId}`,
      };

      const { error } = await supabase
        .from('report_training_patterns')
        .insert(newPattern);

      if (error) throw error;

      toast({ 
        title: "Succès", 
        description: `Modèle exporté vers ${targetHotel?.name || 'l\'établissement'}` 
      });
      setShowExportDialog(false);
    } catch (error) {
      console.error('Erreur export:', error);
      toast({ title: "Erreur", description: "Impossible d'exporter le modèle", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const getPatternStats = () => {
    const pmsTypes = new Map<string, { count: number; validated: number; avgAccuracy: number }>();
    
    patterns.forEach(p => {
      const pmsType = p.pms_type || 'unknown';
      if (!pmsTypes.has(pmsType)) {
        pmsTypes.set(pmsType, { count: 0, validated: 0, avgAccuracy: 0 });
      }
      const stats = pmsTypes.get(pmsType)!;
      stats.count++;
      if (p.validated) stats.validated++;
      stats.avgAccuracy += p.accuracy_score || 0;
    });

    pmsTypes.forEach((stats, type) => {
      stats.avgAccuracy = stats.count > 0 ? stats.avgAccuracy / stats.count : 0;
    });

    return pmsTypes;
  };

  const createNewPattern = async (pmsType: string) => {
    const defaultPattern: Partial<PmsPattern> = {
      pms_type: pmsType,
      room_number_regex: '\\b([1-9]\\d{2})\\b',
      status_keywords: {
        'DIR': { status: 'checkout', cleaning: 'full', priority: 1 },
        'DEP': { status: 'checkout', cleaning: 'full', priority: 1 },
        'INS': { status: 'stayover', cleaning: 'quick', priority: 2 },
        'SAL': { status: 'stayover', cleaning: 'quick', priority: 2 },
        'SALE': { status: 'stayover', cleaning: 'quick', priority: 2 },
        'OOO': { status: 'out_of_order', cleaning: 'none', priority: 0 },
        'ARR': { status: 'arrival', cleaning: 'full', priority: 1 },
      },
      date_formats: ['dd/MM/yyyy'],
      context_window: 300,
      priority: 10
    };

    setEditingPattern({
      pms_type: pmsType,
      detection_rules: defaultPattern,
      report_name: `Pattern ${pmsType}`,
      pattern_name: `Pattern ${pmsType}`,
      raw_text: '',
      extracted_data: [],
      validated: false
    });
  };

  const duplicatePattern = async (pattern: any) => {
    const newPattern = {
      ...pattern,
      id: undefined,
      report_name: `${pattern.report_name} (copie)`,
      pattern_name: `${pattern.pattern_name || pattern.report_name} (copie)`,
      validated: false,
      created_at: undefined,
      updated_at: undefined
    };

    const user = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('report_training_patterns')
      .insert({
        ...newPattern,
        hotel_id: hotelId,
        created_by: user.data.user?.id,
      });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de dupliquer le pattern", variant: "destructive" });
      return;
    }

    toast({ title: "Succès", description: "Pattern dupliqué" });
    loadPatterns();
  };

  const toggleValidation = async (pattern: any) => {
    const { error } = await supabase
      .from('report_training_patterns')
      .update({ validated: !pattern.validated, updated_at: new Date().toISOString() })
      .eq('id', pattern.id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de modifier la validation", variant: "destructive" });
      return;
    }

    toast({ title: "Succès", description: pattern.validated ? "Pattern désactivé" : "Pattern validé et activé" });
    loadPatterns();
  };

  const savePattern = async () => {
    if (!editingPattern) return;

    const user = await supabase.auth.getUser();
    
    const patternToSave = {
      ...editingPattern,
      hotel_id: hotelId,
      created_by: user.data.user?.id,
      updated_at: new Date().toISOString()
    };

    const { error } = editingPattern.id 
      ? await supabase.from('report_training_patterns').update(patternToSave).eq('id', editingPattern.id)
      : await supabase.from('report_training_patterns').insert(patternToSave);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder le pattern", variant: "destructive" });
      return;
    }

    toast({ title: "Succès", description: "Pattern sauvegardé avec succès" });
    setEditingPattern(null);
    loadPatterns();
  };

  const deletePattern = async (id: string) => {
    const { error } = await supabase
      .from('report_training_patterns')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer le pattern", variant: "destructive" });
      return;
    }

    toast({ title: "Succès", description: "Pattern supprimé" });
    loadPatterns();
  };

  const addKeyword = () => {
    if (!editingPattern || !newKeyword.keyword) return;

    const rules = editingPattern.detection_rules || {};
    const keywords = rules.status_keywords || {};
    
    keywords[newKeyword.keyword.toUpperCase()] = {
      status: newKeyword.status,
      cleaning: newKeyword.cleaning,
      priority: newKeyword.priority
    };

    setEditingPattern({
      ...editingPattern,
      detection_rules: { ...rules, status_keywords: keywords }
    });

    setNewKeyword({ keyword: '', status: '', cleaning: 'full', priority: 10 });
  };

  const removeKeyword = (keyword: string) => {
    if (!editingPattern) return;

    const rules = editingPattern.detection_rules || {};
    const keywords = { ...rules.status_keywords };
    delete keywords[keyword];

    setEditingPattern({
      ...editingPattern,
      detection_rules: { ...rules, status_keywords: keywords }
    });
  };

  const testPattern = async (patternId: string) => {
    if (!testText.trim()) {
      toast({ title: "Erreur", description: "Entrez du texte à tester", variant: "destructive" });
      return;
    }

    const pattern = patterns.find(p => p.id === patternId);
    if (!pattern) return;

    setIsTesting(true);
    setTestResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('learn-pattern', {
        body: {
          mode: 'apply',
          learnedPatterns: pattern.detection_rules,
          fullText: testText,
          context: { hotelId, reportName: 'Test' }
        }
      });

      if (error) throw error;

      if (data?.extractedRooms?.rooms) {
        setTestResults(data.extractedRooms.rooms);
        toast({ title: "Test réussi", description: `${data.extractedRooms.rooms.length} chambres extraites` });
      } else if (data?.rooms) {
        setTestResults(data.rooms);
        toast({ title: "Test réussi", description: `${data.rooms.length} chambres extraites` });
      } else {
        toast({ title: "Aucun résultat", description: "Aucune chambre trouvée", variant: "destructive" });
      }
    } catch (error) {
      console.error('Erreur test pattern:', error);
      toast({ title: "Erreur", description: "Erreur lors du test", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const openRulesEditor = (pattern: any) => {
    setSelectedPatternForRules(pattern);
    setShowRulesDialog(true);
  };

  const saveRules = async () => {
    if (!selectedPatternForRules) return;

    const { error } = await supabase
      .from('report_training_patterns')
      .update({ 
        detection_rules: selectedPatternForRules.detection_rules,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedPatternForRules.id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder les règles", variant: "destructive" });
      return;
    }

    toast({ title: "Succès", description: "Règles mises à jour" });
    setShowRulesDialog(false);
    loadPatterns();
  };

  const getCleaningTypeLabel = (type: string) => {
    switch (type) {
      case 'full': return 'À blanc';
      case 'quick': return 'Recouche';
      case 'none': return 'Aucun';
      default: return type;
    }
  };

  const getCleaningTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'full': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'quick': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'none': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = getPatternStats();

  if (loading) {
    return <div className="text-center py-8">Chargement des patterns...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header avec nom établissement */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">Gestion des Modèles d'Extraction</h2>
            {currentHotel && (
              <Badge variant="secondary" className="flex items-center gap-1.5 py-1 px-3">
                <MapPin className="h-3.5 w-3.5" />
                {currentHotel.name}
                {currentHotel.hotel_code && (
                  <span className="text-muted-foreground ml-1">({currentHotel.hotel_code})</span>
                )}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Gérez, modifiez et réutilisez vos modèles appris</p>
        </div>
        <Button onClick={() => createNewPattern('custom')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Modèle
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total modèles</span>
            <Database className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{patterns.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Validés</span>
            <Check className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{patterns.filter(p => p.validated).length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Types PMS</span>
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold">{stats.size}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Précision moy.</span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">
            {patterns.length > 0 
              ? Math.round(patterns.reduce((acc, p) => acc + (p.accuracy_score || 0), 0) / patterns.length * 100)
              : 0}%
          </p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="patterns">Modèles</TabsTrigger>
          <TabsTrigger value="test">Tester un modèle</TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="space-y-4 mt-4">
          {editingPattern && (
            <Card className="p-6 border-primary">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    {editingPattern.id ? 'Modifier le Modèle' : 'Nouveau Modèle'}
                  </h3>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => setEditingPattern(null)}>
                      Annuler
                    </Button>
                    <Button onClick={savePattern}>
                      <Save className="h-4 w-4 mr-2" />
                      Sauvegarder
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Type de PMS</Label>
                    <Input
                      value={editingPattern.pms_type}
                      onChange={(e) => setEditingPattern({ ...editingPattern, pms_type: e.target.value })}
                      placeholder="ex: apaleo, medialog, mews"
                    />
                  </div>
                  <div>
                    <Label>Nom du Modèle</Label>
                    <Input
                      value={editingPattern.pattern_name || editingPattern.report_name}
                      onChange={(e) => setEditingPattern({ 
                        ...editingPattern, 
                        pattern_name: e.target.value,
                        report_name: e.target.value 
                      })}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={editingPattern.validated}
                        onCheckedChange={(checked) => setEditingPattern({ ...editingPattern, validated: checked })}
                      />
                      <Label>Validé (actif)</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Regex pour Numéros de Chambre</Label>
                  <Input
                    value={editingPattern.detection_rules?.room_number_regex || ''}
                    onChange={(e) => setEditingPattern({
                      ...editingPattern,
                      detection_rules: { ...editingPattern.detection_rules, room_number_regex: e.target.value }
                    })}
                    placeholder="\\b([1-9]\\d{2})\\b"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Expression régulière pour détecter les numéros de chambre
                  </p>
                </div>

                <div>
                  <Label>Règles de Statut et Nettoyage</Label>
                  <div className="space-y-2 mt-2">
                    {Object.entries(editingPattern.detection_rules?.status_keywords || {}).map(([keyword, mapping]: [string, any]) => (
                      <div key={keyword} className="flex items-center gap-2 p-2 border rounded bg-muted/30">
                        <Badge variant="outline" className="font-mono">{keyword}</Badge>
                        <span className="text-sm">→</span>
                        <span className="text-sm">{mapping.status}</span>
                        <Badge className={getCleaningTypeBadgeClass(mapping.cleaning)}>
                          {getCleaningTypeLabel(mapping.cleaning)}
                        </Badge>
                        {mapping.priority !== undefined && (
                          <span className="text-xs text-muted-foreground">P{mapping.priority}</span>
                        )}
                        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => removeKeyword(keyword)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <div className="flex gap-2 mt-3 p-3 border rounded bg-background">
                      <Input
                        placeholder="Mot-clé (ex: DIR)"
                        value={newKeyword.keyword}
                        onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                        className="w-28"
                      />
                      <Input
                        placeholder="Statut"
                        value={newKeyword.status}
                        onChange={(e) => setNewKeyword({ ...newKeyword, status: e.target.value })}
                        className="w-32"
                      />
                      <Select value={newKeyword.cleaning} onValueChange={(v) => setNewKeyword({ ...newKeyword, cleaning: v })}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">À blanc</SelectItem>
                          <SelectItem value="quick">Recouche</SelectItem>
                          <SelectItem value="none">Aucun</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Priorité"
                        value={newKeyword.priority}
                        onChange={(e) => setNewKeyword({ ...newKeyword, priority: parseInt(e.target.value) || 10 })}
                        className="w-20"
                      />
                      <Button onClick={addKeyword}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Liste des patterns */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Modèles Existants ({patterns.length})</h3>
            {patterns.length === 0 ? (
              <Card className="p-8 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun modèle créé pour le moment</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Importez un PDF et utilisez l'apprentissage pour créer votre premier modèle
                </p>
              </Card>
            ) : (
              patterns.map((pattern) => (
                <Card key={pattern.id} className={`p-4 ${pattern.validated ? 'border-green-500/50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Badge variant={pattern.validated ? "default" : "outline"}>
                        {pattern.pms_type}
                      </Badge>
                      <div className="flex-1">
                        <span className="font-medium">{pattern.pattern_name || pattern.report_name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          {pattern.validated && (
                            <Badge variant="secondary" className="text-green-600">
                              <Check className="h-3 w-3 mr-1" /> Actif
                            </Badge>
                          )}
                          {pattern.accuracy_score > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Précision: {(pattern.accuracy_score * 100).toFixed(0)}%
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Modifié: {new Date(pattern.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleValidation(pattern)}
                        title={pattern.validated ? "Désactiver" : "Activer"}
                      >
                        {pattern.validated ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openRulesEditor(pattern)}
                        title="Modifier les règles"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditingPattern(pattern)}
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => duplicatePattern(pattern)}
                        title="Dupliquer"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {userHotels.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openExportDialog(pattern)}
                          title="Exporter vers un autre établissement"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => deletePattern(pattern.id)}
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Play className="h-5 w-5" />
              Tester un modèle
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label>Sélectionner un modèle</Label>
                <Select onValueChange={(id) => testPattern(id)} disabled={isTesting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un modèle validé" />
                  </SelectTrigger>
                  <SelectContent>
                    {patterns.filter(p => p.validated).map(pattern => (
                      <SelectItem key={pattern.id} value={pattern.id}>
                        {pattern.pattern_name || pattern.report_name} ({pattern.pms_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Texte de test</Label>
                <Textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Collez ici un extrait de rapport pour tester..."
                  rows={6}
                />
              </div>

              {testResults.length > 0 && (
                <div>
                  <Label className="mb-2 block">Résultats ({testResults.length} chambres)</Label>
                  <div className="max-h-[300px] overflow-auto border rounded p-2">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="text-left p-2">Chambre</th>
                          <th className="text-left p-2">Statut</th>
                          <th className="text-left p-2">Nettoyage</th>
                          <th className="text-left p-2">Client</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.map((room, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2 font-mono">{room.roomNumber}</td>
                            <td className="p-2">{room.rawStatus || room.status}</td>
                            <td className="p-2">
                              <Badge className={getCleaningTypeBadgeClass(room.cleaningType)}>
                                {getCleaningTypeLabel(room.cleaningType)}
                              </Badge>
                            </td>
                            <td className="p-2">{room.guestName || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog pour éditer les règles avancées */}
      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Règles de Nettoyage Avancées</DialogTitle>
            <DialogDescription>
              Configurez les règles de détection pour {selectedPatternForRules?.pattern_name || selectedPatternForRules?.report_name}
            </DialogDescription>
          </DialogHeader>

          {selectedPatternForRules && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Règles de priorité</h4>
                <p className="text-sm text-muted-foreground">
                  Les règles avec une priorité plus basse (0, 1, 2...) sont appliquées en premier.
                  Utilisez cela pour gérer les cas complexes.
                </p>
              </div>

              <div className="space-y-2">
                {Object.entries(selectedPatternForRules.detection_rules?.status_keywords || {})
                  .sort((a: any, b: any) => (a[1].priority || 10) - (b[1].priority || 10))
                  .map(([keyword, mapping]: [string, any]) => (
                    <div key={keyword} className="flex items-center gap-2 p-3 border rounded">
                      <Badge variant="outline" className="font-mono text-base">{keyword}</Badge>
                      <span className="mx-2">→</span>
                      <div className="flex-1">
                        <Input
                          value={mapping.status}
                          onChange={(e) => {
                            const newRules = { ...selectedPatternForRules.detection_rules };
                            newRules.status_keywords[keyword].status = e.target.value;
                            setSelectedPatternForRules({ ...selectedPatternForRules, detection_rules: newRules });
                          }}
                          className="h-8 w-32 inline-block mr-2"
                          placeholder="Statut"
                        />
                        <Select 
                          value={mapping.cleaning}
                          onValueChange={(v) => {
                            const newRules = { ...selectedPatternForRules.detection_rules };
                            newRules.status_keywords[keyword].cleaning = v;
                            setSelectedPatternForRules({ ...selectedPatternForRules, detection_rules: newRules });
                          }}
                        >
                          <SelectTrigger className="h-8 w-28 inline-flex">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">À blanc</SelectItem>
                            <SelectItem value="quick">Recouche</SelectItem>
                            <SelectItem value="none">Aucun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        type="number"
                        value={mapping.priority || 10}
                        onChange={(e) => {
                          const newRules = { ...selectedPatternForRules.detection_rules };
                          newRules.status_keywords[keyword].priority = parseInt(e.target.value) || 10;
                          setSelectedPatternForRules({ ...selectedPatternForRules, detection_rules: newRules });
                        }}
                        className="h-8 w-16"
                        placeholder="Priorité"
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRulesDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveRules}>
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder les règles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour exporter vers un autre établissement */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Exporter le modèle
            </DialogTitle>
            <DialogDescription>
              Copier ce modèle vers un autre établissement
            </DialogDescription>
          </DialogHeader>

          {patternToExport && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <Badge>{patternToExport.pms_type}</Badge>
                  <span className="font-medium">
                    {patternToExport.pattern_name || patternToExport.report_name}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Depuis : {currentHotel?.name || 'Établissement actuel'}
                </div>
              </div>

              <div>
                <Label>Vers quel établissement ?</Label>
                <Select value={exportTargetHotelId} onValueChange={setExportTargetHotelId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner un établissement" />
                  </SelectTrigger>
                  <SelectContent>
                    {userHotels
                      .filter(h => h.id !== hotelId)
                      .map(hotel => (
                        <SelectItem key={hotel.id} value={hotel.id}>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {hotel.name}
                            {hotel.hotel_code && (
                              <span className="text-muted-foreground">({hotel.hotel_code})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-validate"
                  checked={exportAutoValidate}
                  onCheckedChange={(checked) => setExportAutoValidate(checked === true)}
                />
                <Label htmlFor="auto-validate" className="text-sm cursor-pointer">
                  Valider automatiquement le modèle après export
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={exportPatternToHotel} 
              disabled={!exportTargetHotelId || isExporting}
            >
              {isExporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Export...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Exporter le modèle
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
