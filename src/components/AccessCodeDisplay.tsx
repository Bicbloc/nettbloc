import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSetup } from '@/hooks/use-auto-setup';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AccessCodeDisplay = () => {
  const { user, isAuthenticated } = useAuth();
  const { accessCode, generateNewAccessCode, hotel } = useAutoSetup();
  const { toast } = useToast();
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  useEffect(() => {
    if (isAuthenticated && accessCode) {
      setCodes([accessCode]);
    }
  }, [isAuthenticated, accessCode]);

  const generateAccessCodes = async () => {
    if (!hotel) return;
    
    setLoading(true);
    try {
      const newCode = await generateNewAccessCode();
      if (newCode) {
        setCodes([newCode]);
      }
    } catch (error: any) {
      console.error('Erreur génération codes:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer un nouveau code d'accès."
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copié !",
        description: "Code d'accès copié dans le presse-papiers"
      });
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de copier dans le presse-papiers"
      });
    });
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Connectez-vous pour voir les codes d'accès
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codes d'Accès</CardTitle>
        <CardDescription>
          Code d'accès pour permettre aux femmes de chambre d'accéder à l'interface mobile
          {hotel && (
            <div className="text-sm text-muted-foreground mt-1">
              Hôtel: {hotel.name}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Button
            onClick={generateAccessCodes}
            disabled={loading || !hotel}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Génération...' : 'Générer nouveau code'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowCodes(!showCodes)}
            className="flex items-center gap-2"
            disabled={!accessCode}
          >
            {showCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showCodes ? 'Masquer' : 'Afficher'}
          </Button>
        </div>

        {accessCode && showCodes && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Code d'accès actuel :
            </p>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
              <code className="font-mono text-xl font-bold text-primary">
                {accessCode}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(accessCode)}
                className="flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Copier
              </Button>
            </div>
            
            {hotel && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Instructions pour les femmes de chambre :</strong>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  1. Code de l'hôtel : <code className="bg-blue-100 px-1 rounded">{hotel.hotel_code}</code>
                </p>
                <p className="text-sm text-blue-700">
                  2. Code d'accès personnel : <code className="bg-blue-100 px-1 rounded">{accessCode}</code>
                </p>
              </div>
            )}
          </div>
        )}

        {!accessCode && !loading && (
          <p className="text-muted-foreground text-center py-8">
            Code d'accès en cours de génération automatique...
          </p>
        )}
      </CardContent>
    </Card>
  );
};