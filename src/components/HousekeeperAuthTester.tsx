import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HousekeeperAuthService } from '@/services/housekeeperAuthService';

export const HousekeeperAuthTester = () => {
  const [accessCode, setAccessCode] = useState('HTL002-4480');
  const [result, setResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const testAuth = async () => {
    setTesting(true);
    setResult(null);
    
    console.log('🧪 Test authentification avec code:', accessCode);
    
    try {
      const authResult = await HousekeeperAuthService.authenticateWithFullCode(accessCode);
      setResult(authResult);
      console.log('🧪 Résultat authentification:', authResult);
    } catch (error) {
      console.error('🧪 Erreur test auth:', error);
      setResult({ success: false, error: error.message, debugInfo: { error } });
    } finally {
      setTesting(false);
    }
  };

  const formatJson = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>🧪 Test d'Authentification Housekeeper</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Code d'accès (ex: HTL002-4480)"
            className="font-mono"
          />
          <Button onClick={testAuth} disabled={testing}>
            {testing ? 'Test...' : 'Tester'}
          </Button>
        </div>

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={result.success ? 'default' : 'destructive'}>
                {result.success ? '✅ SUCCESS' : '❌ FAILED'}
              </Badge>
              {result.error && (
                <Badge variant="outline">{result.error}</Badge>
              )}
            </div>

            <details className="bg-muted p-3 rounded border">
              <summary className="cursor-pointer font-medium">
                📊 Debug Info
              </summary>
              <pre className="text-xs mt-2 overflow-auto max-h-96">
                {formatJson(result.debugInfo)}
              </pre>
            </details>

            {result.user && (
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <strong>👤 Utilisateur trouvé:</strong>
                <pre className="text-xs mt-1">{formatJson(result.user)}</pre>
              </div>
            )}

            {result.hotel && (
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <strong>🏨 Hôtel trouvé:</strong>
                <pre className="text-xs mt-1">{formatJson(result.hotel)}</pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};