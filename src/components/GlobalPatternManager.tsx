import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Database, 
  Star, 
  StarOff, 
  Check, 
  X, 
  RefreshCw, 
  Send, 
  FileText,
  Users,
  Sparkles,
  AlertCircle
} from "lucide-react";

interface Hotel {
  id: string;
  name: string;
  hotel_code: string | null;
  email: string;
  created_at: string;
}

interface TrainingPattern {
  id: string;
  hotel_id: string;
  assigned_to_hotel_id: string | null;
  report_name: string;
  pattern_name: string | null;
  pms_type: string | null;
  validated: boolean;
  is_default: boolean | null;
  accuracy_score: number | null;
  created_at: string;
  updated_at: string;
  attribution_reason: string | null;
  extracted_data: any;
}

export const GlobalPatternManager = ({ hotelId }: { hotelId: string }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [patterns, setPatterns] = useState<TrainingPattern[]>([]);
  const [selectedHotelFilter, setSelectedHotelFilter] = useState<string>("all");
  
  // Dialog pour assigner un pattern
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [patternToAssign, setPatternToAssign] = useState<TrainingPattern | null>(null);
  const [targetHotelId, setTargetHotelId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger TOUS les hôtels (pour un super admin) ou les hôtels de l'utilisateur
      const { data: hotelsData, error: hotelsError } = await supabase
        .from('hotels')
        .select('id, name, hotel_code, email, created_at')
        .order('name');

      if (hotelsError) throw hotelsError;
      setHotels(hotelsData || []);

      // Charger TOUS les patterns validés
      const { data: patternsData, error: patternsError } = await supabase
        .from('report_training_patterns')
        .select('*')
        .eq('validated', true)
        .order('updated_at', { ascending: false });

      if (patternsError) throw patternsError;
      setPatterns(patternsData || []);

    } catch (error) {
      console.error('Erreur chargement:', error);
      toast({ title: "Erreur", description: "Impossible de charger les données", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getHotelName = (hotelId: string | null) => {
    if (!hotelId) return "Non attribué";
    const hotel = hotels.find(h => h.id === hotelId);
    return hotel?.name || "Hôtel inconnu";
  };

  const getHotelCode = (hotelId: string | null) => {
    if (!hotelId) return null;
    const hotel = hotels.find(h => h.id === hotelId);
    return hotel?.hotel_code;
  };

  const openAssignDialog = (pattern: TrainingPattern) => {
    setPatternToAssign(pattern);
    setTargetHotelId(pattern.assigned_to_hotel_id || "");
    setShowAssignDialog(true);
  };

  const assignPatternToHotel = async () => {
    if (!patternToAssign) return;

    setIsAssigning(true);
    try {
      const targetHotel = hotels.find(h => h.id === targetHotelId);
      
      const { error } = await supabase
        .from('report_training_patterns')
        .update({
          assigned_to_hotel_id: targetHotelId || null,
          attribution_reason: targetHotelId 
            ? `Attribué à ${targetHotel?.name || 'établissement'} par l'administrateur`
            : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', patternToAssign.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: targetHotelId
          ? `Modèle attribué à ${targetHotel?.name}`
          : "Attribution retirée"
      });

      setShowAssignDialog(false);
      loadData();
    } catch (error) {
      console.error('Erreur attribution:', error);
      toast({ title: "Erreur", description: "Impossible d'attribuer le modèle", variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  };

  const toggleDefaultPattern = async (pattern: TrainingPattern) => {
    try {
      // Retirer le défaut des autres patterns du même type PMS pour cet hôtel
      if (!pattern.is_default && pattern.assigned_to_hotel_id) {
        await supabase
          .from('report_training_patterns')
          .update({ is_default: false })
          .eq('assigned_to_hotel_id', pattern.assigned_to_hotel_id)
          .eq('pms_type', pattern.pms_type);
      }

      const { error } = await supabase
        .from('report_training_patterns')
        .update({
          is_default: !pattern.is_default,
          updated_at: new Date().toISOString()
        })
        .eq('id', pattern.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: pattern.is_default
          ? "Ce modèle n'est plus le modèle par défaut"
          : "Ce modèle est maintenant le modèle par défaut"
      });

      loadData();
    } catch (error) {
      console.error('Erreur toggle défaut:', error);
      toast({ title: "Erreur", description: "Impossible de modifier le statut", variant: "destructive" });
    }
  };

  const filteredPatterns = selectedHotelFilter === "all"
    ? patterns
    : selectedHotelFilter === "unassigned"
      ? patterns.filter(p => !p.assigned_to_hotel_id)
      : patterns.filter(p => p.assigned_to_hotel_id === selectedHotelFilter || p.hotel_id === selectedHotelFilter);

  const getRoomsCount = (pattern: TrainingPattern) => {
    if (Array.isArray(pattern.extracted_data)) {
      return pattern.extracted_data.length;
    }
    return 0;
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Chargement des données...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Établissements</p>
              <p className="text-2xl font-bold">{hotels.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Database className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Modèles validés</p>
              <p className="text-2xl font-bold">{patterns.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Non attribués</p>
              <p className="text-2xl font-bold">{patterns.filter(p => !p.assigned_to_hotel_id).length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Liste des établissements */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Établissements inscrits
            </h3>
            <p className="text-sm text-muted-foreground">
              Tous les établissements bénéficient des modèles entraînés
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Établissement</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Modèles attribués</TableHead>
              <TableHead className="text-center">Modèle par défaut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hotels.map(hotel => {
              const assignedPatterns = patterns.filter(p => p.assigned_to_hotel_id === hotel.id);
              const defaultPattern = assignedPatterns.find(p => p.is_default);
              
              return (
                <TableRow key={hotel.id}>
                  <TableCell className="font-medium">{hotel.name}</TableCell>
                  <TableCell>
                    {hotel.hotel_code ? (
                      <Badge variant="outline">{hotel.hotel_code}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{hotel.email}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={assignedPatterns.length > 0 ? "default" : "secondary"}>
                      {assignedPatterns.length}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {defaultPattern ? (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        {defaultPattern.pms_type || "Pattern"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Aucun</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Liste des modèles */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Modèles d'extraction validés
            </h3>
            <p className="text-sm text-muted-foreground">
              Attribuez les modèles entraînés aux établissements
            </p>
          </div>

          <Select value={selectedHotelFilter} onValueChange={setSelectedHotelFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrer par établissement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modèles</SelectItem>
              <SelectItem value="unassigned">Non attribués</SelectItem>
              {hotels.map(hotel => (
                <SelectItem key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredPatterns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun modèle validé trouvé</p>
            <p className="text-sm">Entraînez l'IA en uploadant des rapports PDF</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modèle</TableHead>
                <TableHead>Type PMS</TableHead>
                <TableHead>Créé par</TableHead>
                <TableHead>Attribué à</TableHead>
                <TableHead className="text-center">Chambres</TableHead>
                <TableHead className="text-center">Défaut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatterns.map(pattern => (
                <TableRow key={pattern.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{pattern.pattern_name || pattern.report_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {pattern.pms_type ? (
                      <Badge variant="secondary">{pattern.pms_type.toUpperCase()}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {getHotelName(pattern.hotel_id)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {pattern.assigned_to_hotel_id ? (
                      <Badge variant="outline" className="bg-primary/5">
                        <Building2 className="h-3 w-3 mr-1" />
                        {getHotelName(pattern.assigned_to_hotel_id)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Non attribué</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{getRoomsCount(pattern)}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDefaultPattern(pattern)}
                      disabled={!pattern.assigned_to_hotel_id}
                      className={pattern.is_default ? "text-yellow-500" : "text-muted-foreground"}
                    >
                      {pattern.is_default ? (
                        <Star className="h-4 w-4 fill-current" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAssignDialog(pattern)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Attribuer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog attribution */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribuer le modèle</DialogTitle>
            <DialogDescription>
              Sélectionnez l'établissement qui utilisera ce modèle d'extraction
            </DialogDescription>
          </DialogHeader>

          {patternToAssign && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{patternToAssign.pattern_name || patternToAssign.report_name}</p>
                <p className="text-sm text-muted-foreground">
                  Type: {patternToAssign.pms_type || "Non défini"} • 
                  {getRoomsCount(patternToAssign)} chambres extraites
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Établissement destinataire
                </label>
                <Select value={targetHotelId} onValueChange={setTargetHotelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un établissement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      <span className="text-muted-foreground">Aucun (retirer l'attribution)</span>
                    </SelectItem>
                    {hotels.map(hotel => (
                      <SelectItem key={hotel.id} value={hotel.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {hotel.name}
                          {hotel.hotel_code && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {hotel.hotel_code}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Annuler
            </Button>
            <Button onClick={assignPatternToHotel} disabled={isAssigning}>
              {isAssigning ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
