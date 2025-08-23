import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Copy, Eye, EyeOff, Zap } from 'lucide-react';
import { PermanentAccessCodeService } from '@/services/permanentAccessCodeService';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface AccessCodeRegenerationToolProps {
  hotelId: string;
  onCodesUpdated?: () => void;
}

interface RegeneratedCode {
  name: string;
  code: string;
  visible: boolean;
}

export function AccessCodeRegenerationTool({ hotelId, onCodesUpdated }: AccessCodeRegenerationToolProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedCodes, setRegeneratedCodes] = useState<RegeneratedCode[]>([]);
  const [showAll, setShowAll] = useState(false);

  const handleRegenerateAll = async () => {
    try {
      setIsRegenerating(true);
      
      const results = await PermanentAccessCodeService.regenerateAllCodes(hotelId);
      
      const codesWithVisibility = results.map(result => ({
        name: result.name,
        code: result.code,
        visible: false
      }));
      
      setRegeneratedCodes(codesWithVisibility);
      
      toast({
        title: "Codes régénérés !",
        description: `${results.length} codes d'accès permanents ont été générés`,
      });

      onCodesUpdated?.();
    } catch (error) {
      console.error('Erreur régénération:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de régénérer les codes d'accès"
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const toggleCodeVisibility = (index: number) => {
    setRegeneratedCodes(prev => prev.map((item, i) => 
      i === index ? { ...item, visible: !item.visible } : item
    ));
  };

  const toggleAllVisibility = () => {
    const newShowAll = !showAll;
    setShowAll(newShowAll);
    setRegeneratedCodes(prev => prev.map(item => ({ ...item, visible: newShowAll })));
  };

  const copyCode = async (code: string) => {
    await PermanentAccessCodeService.copyCodeToClipboard(code);
  };

  const formatCode = (code: string, visible: boolean) => {
    if (visible) return code;
    const parts = code.split('-');
    return parts.map((part, index) => 
      index === 0 ? part : '•'.repeat(part.length)
    ).join('-');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Régénération des codes d'accès
        </CardTitle>
        <CardDescription>
          Génère de nouveaux codes permanents pour toutes les femmes de chambre existantes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Cette action créera de nouveaux codes permanents (sans expiration) pour remplacer les anciens codes
          </div>
          <Button
            onClick={handleRegenerateAll}
            disabled={isRegenerating}
            className="gap-2"
          >
            {isRegenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {isRegenerating ? 'Génération...' : 'Régénérer tous les codes'}
          </Button>
        </div>

        {regeneratedCodes.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-green-700">
                  ✅ {regeneratedCodes.length} codes générés avec succès
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllVisibility}
                  className="gap-2"
                >
                  {showAll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showAll ? 'Masquer tout' : 'Afficher tout'}
                </Button>
              </div>

              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {regeneratedCodes.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm font-mono text-green-700">
                        {formatCode(item.code, item.visible)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-green-100">
                        🔑 Permanent
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCodeVisibility(index)}
                        className="gap-1"
                      >
                        {item.visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyCode(item.code)}
                        className="gap-1"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <div>• Les nouveaux codes n'expirent jamais</div>
          <div>• Les anciens codes restent actifs jusqu'à désactivation manuelle</div>
          <div>• Chaque femme de chambre aura un code unique et permanent</div>
        </div>
      </CardContent>
    </Card>
  );
}