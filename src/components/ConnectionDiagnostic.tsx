import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { ConnectionManager, SyncService } from '@/services/connectionManager';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ConnectionDiagnosticProps {
  hotelId?: string;
}

export const ConnectionDiagnostic: React.FC<ConnectionDiagnosticProps> = ({ hotelId }) => {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [realtimeStatus, setRealtimeStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [diagnosticResults, setDiagnosticResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const connectionManager = ConnectionManager.getInstance();

  // Test de connexion Supabase
  const testConnection = async (): Promise<boolean> => {
    try {
      const connected = await connectionManager.checkConnection();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      return connected;
    } catch (error) {
      setConnectionStatus('disconnected');
      return false;
    }
  };

  // Test de connexion temps réel
  const testRealtimeConnection = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      const testChannel = supabase
        .channel('connection_test')
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected');
            supabase.removeChannel(testChannel);
            resolve(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setRealtimeStatus('disconnected');
            supabase.removeChannel(testChannel);
            resolve(false);
          }
        });
      
      // Timeout après 10 secondes
      setTimeout(() => {
        setRealtimeStatus('disconnected');
        supabase.removeChannel(testChannel);
        resolve(false);
      }, 10000);
    });
  };

  // Test de session utilisateur
  const testUserSession = async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setSessionStatus('invalid');
        return false;
      }
      setSessionStatus('valid');
      return true;
    } catch (error) {
      setSessionStatus('invalid');
      return false;
    }
  };

  // Diagnostic complet
  const runDiagnostic = async () => {
    setIsRunning(true);
    setDiagnosticResults([]);
    const results: string[] = [];

    try {
      results.push('🔍 Démarrage du diagnostic...');
      setDiagnosticResults([...results]);

      // Test 1: Connexion de base
      results.push('1️⃣ Test de connexion Supabase...');
      setDiagnosticResults([...results]);
      const connectionOk = await testConnection();
      results.push(connectionOk ? '✅ Connexion Supabase OK' : '❌ Échec connexion Supabase');
      setDiagnosticResults([...results]);

      // Test 2: Session utilisateur
      results.push('2️⃣ Vérification session utilisateur...');
      setDiagnosticResults([...results]);
      const sessionOk = await testUserSession();
      results.push(sessionOk ? '✅ Session utilisateur valide' : '❌ Session utilisateur invalide');
      setDiagnosticResults([...results]);

      // Test 3: Temps réel
      results.push('3️⃣ Test connexion temps réel...');
      setDiagnosticResults([...results]);
      const realtimeOk = await testRealtimeConnection();
      results.push(realtimeOk ? '✅ Connexion temps réel OK' : '❌ Échec connexion temps réel');
      setDiagnosticResults([...results]);

      // Test 4: Hotel ID
      if (hotelId) {
        results.push('4️⃣ Vérification Hotel ID...');
        setDiagnosticResults([...results]);
        
        try {
          const { data: hotel, error } = await supabase
            .from('hotels')
            .select('id, name')
            .eq('id', hotelId)
            .single();
          
          if (error || !hotel) {
            results.push('❌ Hotel ID invalide ou inaccessible');
          } else {
            results.push(`✅ Hôtel trouvé: ${hotel.name}`);
          }
        } catch (error) {
          results.push('❌ Erreur lors de la vérification de l\'hôtel');
        }
        setDiagnosticResults([...results]);
      }

      // Test 5: Permissions
      results.push('5️⃣ Test des permissions...');
      setDiagnosticResults([...results]);
      
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id')
          .limit(1);
        
        if (error) {
          results.push(`❌ Erreur permissions: ${error.message}`);
        } else {
          results.push('✅ Permissions OK');
        }
      } catch (error) {
        results.push('❌ Erreur lors du test des permissions');
      }
      setDiagnosticResults([...results]);

      // Résumé
      results.push('');
      results.push('📊 RÉSUMÉ:');
      results.push(`• Connexion: ${connectionOk ? '✅' : '❌'}`);
      results.push(`• Session: ${sessionOk ? '✅' : '❌'}`);
      results.push(`• Temps réel: ${realtimeOk ? '✅' : '❌'}`);
      
      if (connectionOk && sessionOk && realtimeOk) {
        results.push('');
        results.push('🎉 Tous les tests sont réussis !');
      } else {
        results.push('');
        results.push('⚠️ Des problèmes ont été détectés');
      }

    } catch (error) {
      results.push(`❌ Erreur lors du diagnostic: ${error}`);
    } finally {
      setDiagnosticResults(results);
      setIsRunning(false);
    }
  };

  // Auto-diagnostic au montage
  useEffect(() => {
    runDiagnostic();
  }, [hotelId]);

  // Réparation automatique
  const attemptRepair = async () => {
    try {
      toast({
        title: "🔧 Tentative de réparation",
        description: "Reconnexion en cours..."
      });

      // Forcer la reconnexion
      await connectionManager.attemptReconnection();
      
      // Attendre un peu puis relancer le diagnostic
      setTimeout(() => {
        runDiagnostic();
      }, 2000);
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Échec de la réparation",
        description: "Impossible de réparer automatiquement"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disconnected':
      case 'invalid':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
      case 'valid':
        return <Badge variant="default" className="bg-green-500">OK</Badge>;
      case 'disconnected':
      case 'invalid':
        return <Badge variant="destructive">Erreur</Badge>;
      default:
        return <Badge variant="secondary">Test...</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {connectionStatus === 'connected' ? 
            <Wifi className="h-5 w-5 text-green-500" /> : 
            <WifiOff className="h-5 w-5 text-red-500" />
          }
          Diagnostic de Connexion
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status général */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(connectionStatus)}
                <span className="text-sm font-medium">Connexion</span>
              </div>
              {getStatusBadge(connectionStatus)}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(realtimeStatus)}
                <span className="text-sm font-medium">Temps réel</span>
              </div>
              {getStatusBadge(realtimeStatus)}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(sessionStatus)}
                <span className="text-sm font-medium">Session</span>
              </div>
              {getStatusBadge(sessionStatus)}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostic} 
              disabled={isRunning}
              size="sm"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Relancer le diagnostic
            </Button>

            <Button 
              onClick={attemptRepair} 
              variant="outline"
              size="sm"
              disabled={connectionStatus === 'connected' && realtimeStatus === 'connected'}
            >
              🔧 Tenter une réparation
            </Button>
          </div>

          {/* Résultats détaillés */}
          {diagnosticResults.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Résultats détaillés :</h4>
              <div className="text-xs space-y-1 font-mono">
                {diagnosticResults.map((result, index) => (
                  <div key={index}>{result}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};