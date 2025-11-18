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
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Save, Database, Brain } from "lucide-react";
import { smartExtractionService, PmsPattern } from "@/services/smartExtractionService";

export const PmsPatternManager = ({ hotelId }: { hotelId: string }) => {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPattern, setEditingPattern] = useState<any>(null);
  const [newKeyword, setNewKeyword] = useState({ keyword: '', status: '', cleaning: 'full' });

  useEffect(() => {
    loadPatterns();
  }, [hotelId]);

  const loadPatterns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('report_training_patterns')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('pms_type', { ascending: true });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les patterns", variant: "destructive" });
      return;
    }

    setPatterns(data || []);
    setLoading(false);
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
      status_keywords: {},
      date_formats: ['dd/MM/yyyy'],
      context_window: 300,
      priority: 10
    };

    setEditingPattern({
      pms_type: pmsType,
      detection_rules: defaultPattern,
      report_name: `Pattern ${pmsType}`,
      raw_text: '',
      extracted_data: [],
      validated: false
    });
  };

  const savePattern = async () => {
    if (!editingPattern) return;

    const { error } = await supabase
      .from('report_training_patterns')
      .upsert({
        ...editingPattern,
        hotel_id: hotelId,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      });

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
      cleaning: newKeyword.cleaning
    };

    setEditingPattern({
      ...editingPattern,
      detection_rules: { ...rules, status_keywords: keywords }
    });

    setNewKeyword({ keyword: '', status: '', cleaning: 'full' });
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

  const stats = getPatternStats();

  if (loading) {
    return <div className="text-center py-8">Chargement des patterns...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestion des Patterns PMS</h2>
          <p className="text-muted-foreground">Configurez les règles d'extraction pour chaque système PMS</p>
        </div>
        <Button onClick={() => createNewPattern('custom')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Pattern
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from(stats.entries()).map(([pmsType, stat]) => (
          <Card key={pmsType} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">{pmsType}</Badge>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rapports:</span>
                <span className="font-medium">{stat.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Validés:</span>
                <span className="font-medium">{stat.validated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Précision moy.:</span>
                <span className="font-medium">{(stat.avgAccuracy * 100).toFixed(1)}%</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editingPattern && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Éditer le Pattern
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type de PMS</Label>
                <Input
                  value={editingPattern.pms_type}
                  onChange={(e) => setEditingPattern({ ...editingPattern, pms_type: e.target.value })}
                  placeholder="ex: apaleo, medialog, space"
                />
              </div>
              <div>
                <Label>Nom du Pattern</Label>
                <Input
                  value={editingPattern.report_name}
                  onChange={(e) => setEditingPattern({ ...editingPattern, report_name: e.target.value })}
                />
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
            </div>

            <div>
              <Label>Mots-clés de Statut</Label>
              <div className="space-y-2 mt-2">
                {Object.entries(editingPattern.detection_rules?.status_keywords || {}).map(([keyword, mapping]: [string, any]) => (
                  <div key={keyword} className="flex items-center gap-2 p-2 border rounded">
                    <Badge>{keyword}</Badge>
                    <span className="text-sm flex-1">→ {mapping.status} ({mapping.cleaning})</span>
                    <Button variant="ghost" size="sm" onClick={() => removeKeyword(keyword)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Mot-clé (ex: DIR)"
                    value={newKeyword.keyword}
                    onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                  />
                  <Input
                    placeholder="Statut"
                    value={newKeyword.status}
                    onChange={(e) => setNewKeyword({ ...newKeyword, status: e.target.value })}
                  />
                  <Select value={newKeyword.cleaning} onValueChange={(v) => setNewKeyword({ ...newKeyword, cleaning: v })}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full</SelectItem>
                      <SelectItem value="quick">Quick</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={addKeyword}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Patterns Existants</h3>
        {patterns.map((pattern) => (
          <Card key={pattern.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge>{pattern.pms_type}</Badge>
                <span className="font-medium">{pattern.report_name}</span>
                {pattern.validated && <Badge variant="secondary">Validé</Badge>}
                {pattern.accuracy_score > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {(pattern.accuracy_score * 100).toFixed(0)}% précision
                  </span>
                )}
              </div>
              <div className="space-x-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingPattern(pattern)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deletePattern(pattern.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
