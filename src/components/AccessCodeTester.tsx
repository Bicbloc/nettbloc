import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TestTube, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';
import { useToast } from '@/hooks/use-toast';

export const AccessCodeTester: React.FC = () => {
  const [testCode, setTestCode] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testAccessCode = async () => {
    if (!testCode.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir un code d'accès à tester"
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      console.log('🧪 Test du code:', testCode);
      
      // Test the code
      const testResult = await HousekeeperAuthService.testAccessCode(testCode);
      
      // Try full authentication
      const authResult = await HousekeeperAuthService.authenticateWithFullCode(testCode);
      
      setResult({
        testResult,
        authResult,
        timestamp: new Date().toISOString()
      });

      if (testResult.success && authResult.success) {
        toast({
          title: "✅ Code valide",
          description: "Le code d'accès fonctionne correctement"
        });
      } else {
        toast({
          variant: "destructive",
          title: "❌ Code invalide",
          description: testResult.error || authResult.error || "Code non fonctionnel"
        });
      }

    } catch (error) {
      console.error('Erreur test:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors du test du code"
      });
    } finally {
      setTesting(false);
    }
  };

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test des codes d'accès
        </CardTitle>
        <CardDescription>
          Testez la validité des codes d'accès des femmes de chambre
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="HTL002-ALA-0835"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={testAccessCode}
            disabled={testing}
            className="flex items-center gap-2"
          >
            {testing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Tester
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            {/* Status Summary */}
            <div className="flex gap-2">
              <Badge variant={result.testResult.success ? "default" : "destructive"}>
                {result.testResult.success ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                {result.testResult.success ? "Code trouvé" : "Code non trouvé"}
              </Badge>
              
              <Badge variant={result.authResult.success ? "default" : "destructive"}>
                {result.authResult.success ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                {result.authResult.success ? "Auth réussie" : "Auth échouée"}
              </Badge>
            </div>

            {/* Error Messages */}
            {(!result.testResult.success || !result.authResult.success) && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div>
                    {!result.testResult.success && (
                      <div><strong>Test:</strong> {result.testResult.error}</div>
                    )}
                    {!result.authResult.success && (
                      <div><strong>Auth:</strong> {result.authResult.error}</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Info */}
            {result.authResult.success && result.authResult.hotel && result.authResult.user && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div>
                    <div>
                      <strong>Hôtel:</strong> {result.authResult.hotel.name} ({result.authResult.hotel.hotel_code})
                    </div>
                    <div>
                      <strong>Femme de chambre:</strong> {result.authResult.user.name}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Debug Details */}
            <details className="text-xs">
              <summary className="cursor-pointer font-medium mb-2">
                Détails techniques (Debug)
              </summary>
              <div className="space-y-2">
                <div>
                  <strong>Test Result:</strong>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                    {formatJson(result.testResult)}
                  </pre>
                </div>
                <div>
                  <strong>Auth Result:</strong>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                    {formatJson(result.authResult)}
                  </pre>
                </div>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
};