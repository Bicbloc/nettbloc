import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HotelSessionService } from '@/services/hotelSessionService';
import { CodeGenerationService } from '@/services/codeGenerationService';
import { AlertTriangle, CheckCircle, Database, RefreshCw, Trash2, Wrench } from 'lucide-react';

interface DiagnosticData {
  hotels: any[];
  housekeepers: any[];
  sessions: any[];
  accessCodes: any[];
  localStorage: {
    selectedHotelId: string | null;
    selectedHotelCode: string | null;
    selectedHotelName: string | null;
  };
}

export const DataDiagnostic: React.FC = () => {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const { toast } = useToast();

  const loadDiagnosticData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Utilisateur non connecté"
        });
        return;
      }

      // Load all relevant data
      const [hotelsResult, housekeepersResult, sessionsResult, accessCodesResult] = await Promise.all([
        supabase.from('hotels').select('*').eq('user_id', user.id),
        supabase.from('housekeepers').select('*').eq('user_id', user.id),
        supabase.from('hotel_sessions').select('*').eq('user_id', user.id),
        supabase.from('housekeeper_access_codes').select('*')
      ]);

      setData({
        hotels: hotelsResult.data || [],
        housekeepers: housekeepersResult.data || [],
        sessions: sessionsResult.data || [],
        accessCodes: accessCodesResult.data || [],
        localStorage: {
          selectedHotelId: localStorage.getItem('selectedHotelId'),
          selectedHotelCode: localStorage.getItem('selectedHotelCode'),
          selectedHotelName: localStorage.getItem('selectedHotelName')
        }
      });

    } catch (error) {
      console.error('Erreur diagnostic:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les données de diagnostic"
      });
    } finally {
      setLoading(false);
    }
  };

  const repairData = async () => {
    setRepairing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !data) {
        return;
      }

      console.log('🔧 Démarrage réparation des données...');

      // 1. Fix localStorage if needed
      if (data.hotels.length > 0 && !data.localStorage.selectedHotelId) {
        const mainHotel = data.hotels[0];
        localStorage.setItem('selectedHotelId', mainHotel.id);
        localStorage.setItem('selectedHotelCode', mainHotel.hotel_code || '');
        localStorage.setItem('selectedHotelName', mainHotel.name);
        console.log('✅ localStorage réparé:', mainHotel);
      }

      // 2. Remove duplicate housekeepers (keep the most recent)
      const housekeeperGroups = data.housekeepers.reduce((groups: any, hk: any) => {
        if (!groups[hk.name]) {
          groups[hk.name] = [];
        }
        groups[hk.name].push(hk);
        return groups;
      }, {});

      let duplicatesRemoved = 0;
      for (const [name, housekeepers] of Object.entries(housekeeperGroups) as [string, any[]][]) {
        if (housekeepers.length > 1) {
          // Sort by created_at and keep the most recent
          housekeepers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const toDelete = housekeepers.slice(1); // Remove all except the first (most recent)
          
          for (const hk of toDelete) {
            await supabase.from('housekeepers').delete().eq('id', hk.id);
            duplicatesRemoved++;
          }
        }
      }

      // 3. Fix orphaned sessions (hotel_id = null)
      let orphanedSessionsFixed = 0;
      if (data.hotels.length > 0) {
        const mainHotel = data.hotels[0];
        const orphanedSessions = data.sessions.filter(s => !s.hotel_id);
        
        for (const session of orphanedSessions) {
          await supabase
            .from('hotel_sessions')
            .update({ hotel_id: mainHotel.id })
            .eq('id', session.id);
          orphanedSessionsFixed++;
        }
      }

      // 4. Clean up orphaned access codes
      await CodeGenerationService.cleanupOrphanedCodes();

      // 5. Generate missing access codes for remaining housekeepers
      await CodeGenerationService.forceGenerateAllMissingCodes();

      toast({
        title: "Réparation terminée",
        description: `${duplicatesRemoved} doublons supprimés, ${orphanedSessionsFixed} sessions réparées, codes d'accès régénérés.`
      });

      // Reload data to show the changes
      await loadDiagnosticData();

    } catch (error) {
      console.error('❌ Erreur réparation:', error);
      toast({
        variant: "destructive",
        title: "Erreur de réparation",
        description: "Impossible de réparer toutes les données"
      });
    } finally {
      setRepairing(false);
    }
  };

  const forceResync = async () => {
    try {
      const session = await HotelSessionService.initializeSession();
      if (session) {
        toast({
          title: "Synchronisation forcée",
          description: "Session hotel réinitialisée avec succès"
        });
        await loadDiagnosticData();
      }
    } catch (error) {
      console.error('Erreur sync:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de forcer la synchronisation"
      });
    }
  };

  useEffect(() => {
    loadDiagnosticData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Diagnostic des données
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Analyse en cours...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Erreur de diagnostic</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={loadDiagnosticData}>Réessayer</Button>
        </CardContent>
      </Card>
    );
  }

  const issues = [];
  const duplicates = data.housekeepers.reduce((acc: any, hk: any) => {
    acc[hk.name] = (acc[hk.name] || 0) + 1;
    return acc;
  }, {});
  const duplicateCount = Object.values(duplicates).filter((count: any) => count > 1).length;

  if (duplicateCount > 0) {
    issues.push(`${Object.values(duplicates).reduce((sum: number, count: any) => sum + (count > 1 ? count - 1 : 0), 0)} doublons de femmes de chambre`);
  }

  const orphanedSessions = data.sessions.filter(s => !s.hotel_id).length;
  if (orphanedSessions > 0) {
    issues.push(`${orphanedSessions} sessions orphelines`);
  }

  if (!data.localStorage.selectedHotelId && data.hotels.length > 0) {
    issues.push('localStorage manquant');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Diagnostic des données
        </CardTitle>
        <CardDescription>
          Analyse et réparation des problèmes de connectivité des données
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.hotels.length}</div>
            <div className="text-sm text-muted-foreground">Hôtels</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{data.housekeepers.length}</div>
            <div className="text-sm text-muted-foreground">Femmes de chambre</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{data.sessions.length}</div>
            <div className="text-sm text-muted-foreground">Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{data.accessCodes.length}</div>
            <div className="text-sm text-muted-foreground">Codes d'accès</div>
          </div>
        </div>

        <Separator />

        {/* Issues */}
        {issues.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h4 className="font-medium">Problèmes détectés</h4>
            </div>
            {issues.map((issue, index) => (
              <Badge key={index} variant="destructive">{issue}</Badge>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span>Aucun problème détecté</span>
          </div>
        )}

        {/* Detailed Data */}
        <Separator />
        
        <div className="space-y-2">
          <h4 className="font-medium">localStorage</h4>
          <div className="text-sm space-y-1">
            <div>Hotel ID: <code className="bg-muted px-1 rounded">{data.localStorage.selectedHotelId || 'null'}</code></div>
            <div>Hotel Code: <code className="bg-muted px-1 rounded">{data.localStorage.selectedHotelCode || 'null'}</code></div>
            <div>Hotel Name: <code className="bg-muted px-1 rounded">{data.localStorage.selectedHotelName || 'null'}</code></div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Sessions orphelines</h4>
          <div className="text-sm">
            {data.sessions.filter(s => !s.hotel_id).map(session => (
              <div key={session.id} className="text-destructive">
                Session {session.id.slice(0, 8)}... (hotel_id: null)
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <Separator />
        
        <div className="flex gap-2 flex-wrap">
          <Button onClick={loadDiagnosticData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Recharger
          </Button>
          
          <Button onClick={forceResync} variant="outline" size="sm">
            <Database className="h-4 w-4 mr-2" />
            Forcer sync
          </Button>
          
          {issues.length > 0 && (
            <Button 
              onClick={repairData} 
              disabled={repairing}
              className="bg-destructive hover:bg-destructive/90"
              size="sm"
            >
              <Wrench className={`h-4 w-4 mr-2 ${repairing ? 'animate-spin' : ''}`} />
              {repairing ? 'Réparation...' : 'Réparer tout'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
