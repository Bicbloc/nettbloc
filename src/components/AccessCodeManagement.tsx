import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { AccessCodeManagementService, AccessCodeInfo } from '@/services/accessCodeManagementService';
import { 
  Key, Copy, RefreshCw, Eye, EyeOff, UserCheck, 
  AlertTriangle, CheckCircle, Clock, Trash2 
} from 'lucide-react';

interface AccessCodeManagementProps {
  hotelId: string;
  onRefresh?: () => void;
}

export const AccessCodeManagement: React.FC<AccessCodeManagementProps> = ({ 
  hotelId, 
  onRefresh 
}) => {
  const [codes, setCodes] = useState<AccessCodeInfo[]>([]);
  const [housekeepers, setHousekeepers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [visibleCodes, setVisibleCodes] = useState<Set<string>>(new Set()); // Start with all codes visible
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [hotelId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [codesData, housekeepersData] = await Promise.all([
        AccessCodeManagementService.getHotelAccessCodes(hotelId),
        AccessCodeManagementService.getHousekeepersWithCodes(hotelId)
      ]);
      
      setCodes(codesData);
      setHousekeepers(housekeepersData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les codes d'accès",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateMissingCodes = async () => {
    setIsGenerating(true);
    try {
      await AccessCodeManagementService.fixHotelCodeConsistency(hotelId);
      const generated = await AccessCodeManagementService.generateMissingAccessCodes(hotelId);
      
      if (generated > 0) {
        toast({
          title: "Codes générés",
          description: `${generated} code(s) d'accès générés avec succès`
        });
        await loadData();
        onRefresh?.();
      } else {
        toast({
          title: "Aucun code manquant",
          description: "Toutes les femmes de chambre ont déjà un code d'accès"
        });
      }
    } catch (error) {
      console.error('Erreur génération:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer les codes manquants",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCodeVisibility = (codeId: string) => {
    const newVisible = new Set(visibleCodes);
    if (newVisible.has(codeId)) {
      newVisible.delete(codeId);
    } else {
      newVisible.add(codeId);
    }
    setVisibleCodes(newVisible);
  };

  const formatCode = (code: string, codeId: string) => {
    // Show codes by default, hide only if explicitly hidden
    return visibleCodes.has(codeId) ? '•'.repeat(code.length) : code;
  };

  const deactivateCode = async (codeId: string) => {
    try {
      await AccessCodeManagementService.deactivateAccessCode(codeId);
      toast({
        title: "Code désactivé",
        description: "Le code d'accès a été désactivé avec succès"
      });
      await loadData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de désactiver le code",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Chargement des codes d'accès...</div>
        </CardContent>
      </Card>
    );
  }

  const activeCodes = codes.filter(c => c.is_active);
  const inactiveCodes = codes.filter(c => !c.is_active);

  return (
    <div className="space-y-6">
      {/* Header avec actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Gestion des codes d'accès
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={loadData}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
              <Button
                onClick={generateMissingCodes}
                disabled={isGenerating}
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Générer codes manquants
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{activeCodes.length}</div>
              <div className="text-sm text-muted-foreground">Codes actifs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{housekeepers.length}</div>
              <div className="text-sm text-muted-foreground">Femmes de chambre</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">{inactiveCodes.length}</div>
              <div className="text-sm text-muted-foreground">Codes inactifs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Codes actifs */}
      {activeCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Codes d'accès actifs ({activeCodes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeCodes.map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-lg font-semibold">
                        {formatCode(code.access_code, code.id)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCodeVisibility(code.id)}
                        className="p-1"
                      >
                        {visibleCodes.has(code.id) ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {code.housekeeper_name ? (
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Assigné à: {code.housekeeper_name}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          Code général (non assigné)
                        </div>
                      )}
                      <div>Créé le: {new Date(code.created_at).toLocaleDateString()}</div>
                      {code.used_at && (
                        <div>Utilisé le: {new Date(code.used_at).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => AccessCodeManagementService.copyToClipboard(code.access_code)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deactivateCode(code.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Désactiver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Femmes de chambre avec codes */}
      {housekeepers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Femmes de chambre avec codes ({housekeepers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {housekeepers.map((housekeeper) => (
                <div
                  key={housekeeper.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-semibold">{housekeeper.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Code: {housekeeper.access_code || 'Aucun'}
                    </div>
                    {housekeeper.housekeeper_access_codes?.[0] && (
                      <div className="text-xs text-muted-foreground">
                        Créé le: {new Date(housekeeper.housekeeper_access_codes[0].created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {housekeeper.access_code && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => AccessCodeManagementService.copyToClipboard(housekeeper.access_code)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copier
                      </Button>
                    )}
                    <Badge variant={housekeeper.is_active ? "default" : "secondary"}>
                      {housekeeper.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Codes inactifs */}
      {inactiveCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              Codes inactifs ({inactiveCodes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveCodes.slice(0, 5).map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between p-3 border rounded bg-gray-50"
                >
                  <div>
                    <div className="font-mono text-sm opacity-60">{code.access_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {code.housekeeper_name || 'Code général'}
                    </div>
                  </div>
                  <Badge variant="secondary">Inactif</Badge>
                </div>
              ))}
              {inactiveCodes.length > 5 && (
                <div className="text-center text-sm text-muted-foreground">
                  ... et {inactiveCodes.length - 5} autres codes inactifs
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* État vide */}
      {codes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun code d'accès</h3>
            <p className="text-muted-foreground mb-4">
              Aucun code d'accès n'a été généré pour cet hôtel.
            </p>
            <Button onClick={generateMissingCodes} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Générer les premiers codes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};