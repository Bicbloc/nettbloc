import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface CodeTestResult {
  housekeeper_id: string | null;
  access_code: string;
  housekeeper_name: string | null;
  status: 'correct' | 'missing' | 'error';
}

export const CodeAssignmentTest: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<CodeTestResult[]>([]);
  const { toast } = useToast();

  const testCodeAssignments = async () => {
    setTesting(true);
    setResults([]);

    try {
      // Récupérer tous les codes d'accès avec leurs assignations
      const { data: codes, error } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          housekeeper_id,
          access_code,
          housekeepers (
            name
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const testResults: CodeTestResult[] = codes?.map(code => ({
        housekeeper_id: code.housekeeper_id,
        access_code: code.access_code,
        housekeeper_name: code.housekeepers?.name || null,
        status: code.housekeeper_id ? 'correct' : 'missing'
      })) || [];

      setResults(testResults);

      const correctCount = testResults.filter(r => r.status === 'correct').length;
      const missingCount = testResults.filter(r => r.status === 'missing').length;

      toast({
        title: "Test d'assignation terminé",
        description: `${correctCount} codes correctement assignés, ${missingCount} codes orphelins`,
        variant: missingCount > 0 ? "destructive" : "default"
      });

    } catch (error) {
      console.error('Erreur test assignation:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de tester l'assignation des codes"
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'correct':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'missing':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'correct':
        return <Badge variant="default" className="bg-green-100 text-green-800">Assigné</Badge>;
      case 'missing':
        return <Badge variant="destructive">Non assigné</Badge>;
      default:
        return <Badge variant="secondary">Erreur</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test d'assignation des codes</CardTitle>
        <CardDescription>
          Vérifiez que tous les codes d'accès sont correctement assignés aux femmes de chambre
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={testCodeAssignments}
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Test en cours...
            </>
          ) : (
            'Tester l\'assignation des codes'
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Résultats :</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-mono text-sm">{result.access_code}</p>
                      {result.housekeeper_name && (
                        <p className="text-sm text-muted-foreground">
                          {result.housekeeper_name}
                        </p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};