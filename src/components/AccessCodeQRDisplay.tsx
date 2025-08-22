import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Copy, Eye, EyeOff, Smartphone, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AccessCodeQRDisplayProps {
  hotelCode: string;
  accessCodes: Array<{
    id: string;
    access_code: string;
    housekeeper_name?: string;
    is_active: boolean;
  }>;
  hotelName: string;
}

export const AccessCodeQRDisplay: React.FC<AccessCodeQRDisplayProps> = ({
  hotelCode,
  accessCodes,
  hotelName
}) => {
  const { toast } = useToast();
  const [showCodes, setShowCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const activeCodes = accessCodes.filter(code => code.is_active);
  const baseUrl = window.location.origin;
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({
        title: "Copié !",
        description: "Code copié dans le presse-papiers"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de copier le code"
      });
    }
  };

  const generateQRCodeUrl = (code: string) => {
    const guestUrl = `${baseUrl}/?mode=guest&code=${code}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(guestUrl)}`;
  };

  if (activeCodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Accès Mobile Femmes de Chambre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aucun code d'accès actif. Générez des codes d'accès pour permettre aux femmes de chambre d'utiliser l'interface mobile.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          Interface Mobile - Accès Rapide
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Codes d'accès pour l'interface mobile des femmes de chambre
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Instructions principales */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Instructions pour les femmes de chambre
          </h4>
          <div className="text-sm text-blue-800 space-y-2">
            <p><strong>Méthode 1 - Code direct :</strong></p>
            <p>• Aller sur : <code className="bg-blue-100 px-2 py-1 rounded">{baseUrl}</code></p>
            <p>• Cliquer "Mode Invité" et entrer un code ci-dessous</p>
            
            <p className="mt-3"><strong>Méthode 2 - Code hôtel + code d'accès :</strong></p>
            <p>• Code hôtel : <code className="bg-blue-100 px-2 py-1 rounded font-bold">{hotelCode}</code></p>
            <p>• Puis utiliser un code d'accès ci-dessous</p>
          </div>
        </div>

        {/* Contrôles d'affichage */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-primary border-primary">
            {activeCodes.length} code(s) actif(s)
          </Badge>
          
          <Button
            variant="outline"
            onClick={() => setShowCodes(!showCodes)}
            className="flex items-center gap-2"
          >
            {showCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showCodes ? 'Masquer' : 'Voir'} les codes
          </Button>
        </div>

        {/* Liste des codes */}
        {showCodes && (
          <div className="grid gap-4">
            {activeCodes.map((codeData) => (
              <div key={codeData.id} className="p-4 border rounded-lg bg-background">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-lg font-mono font-bold bg-primary/10 text-primary px-3 py-2 rounded border">
                        {codeData.access_code}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(codeData.access_code)}
                        className={copiedCode === codeData.access_code ? 'bg-green-50 border-green-200' : ''}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {copiedCode === codeData.access_code ? 'Copié !' : 'Copier'}
                      </Button>
                    </div>
                    
                    {codeData.housekeeper_name ? (
                      <Badge variant="secondary" className="mb-2">
                        Assigné à: {codeData.housekeeper_name}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="mb-2">
                        Code général - utilisable par toutes
                      </Badge>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      URL directe : {baseUrl}/?mode=guest&code={codeData.access_code}
                    </p>
                  </div>
                  
                  {/* QR Code */}
                  <div className="text-center">
                    <img
                      src={generateQRCodeUrl(codeData.access_code)}
                      alt={`QR Code pour ${codeData.access_code}`}
                      className="w-24 h-24 border rounded"
                    />
                    <p className="text-xs text-muted-foreground mt-1">QR Code</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions finales */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
          <p className="font-medium mb-1">💡 Conseils :</p>
          <p>• Imprimez cette page ou affichez les QR codes dans les zones de travail</p>
          <p>• Les codes restent actifs jusqu'à désactivation manuelle</p>
          <p>• Chaque utilisation est trackée dans les logs d'activité</p>
        </div>
      </CardContent>
    </Card>
  );
};