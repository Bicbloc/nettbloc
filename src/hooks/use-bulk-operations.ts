import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';

interface BulkOperation {
  id: string;
  operation: string;
  table: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

interface BulkOperationResult {
  success: boolean;
  completed: number;
  failed: number;
  errors: string[];
}

export function useBulkOperations() {
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add operation to queue
  const queueOperation = useCallback((operation: string, table: string, data: any) => {
    const op: BulkOperation = {
      id: crypto.randomUUID(),
      operation,
      table,
      data,
      status: 'pending',
    };

    setOperations(prev => [...prev, op]);
    return op.id;
  }, []);

  // Process all queued operations
  const processOperations = useCallback(async (): Promise<BulkOperationResult> => {
    if (isProcessing || operations.length === 0) {
      return { success: true, completed: 0, failed: 0, errors: [] };
    }

    setIsProcessing(true);
    const result: BulkOperationResult = {
      success: true,
      completed: 0,
      failed: 0,
      errors: [],
    };

    try {
      const pendingOps = operations.filter(op => op.status === 'pending');
      
      // Mark all as processing
      setOperations(prev => prev.map(op => 
        op.status === 'pending' ? { ...op, status: 'processing' as const } : op
      ));

      // Process operations in batches
      const batchSize = 10;
      for (let i = 0; i < pendingOps.length; i += batchSize) {
        const batch = pendingOps.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (op) => {
          try {
            let supabaseQuery;
            
            switch (op.operation) {
              case 'insert':
                supabaseQuery = (supabase as any).from(op.table).insert(op.data);
                break;
              case 'update':
                supabaseQuery = (supabase as any).from(op.table).update(op.data.updates).eq('id', op.data.id);
                break;
              case 'delete':
                supabaseQuery = (supabase as any).from(op.table).delete().eq('id', op.data.id);
                break;
              case 'upsert':
                supabaseQuery = (supabase as any).from(op.table).upsert(op.data);
                break;
              default:
                throw new Error(`Unknown operation: ${op.operation}`);
            }

            const { error } = await supabaseQuery;
            if (error) throw error;

            // Mark as completed
            setOperations(prev => prev.map(prevOp => 
              prevOp.id === op.id ? { ...prevOp, status: 'completed' as const } : prevOp
            ));
            
            result.completed++;
            return { success: true, id: op.id };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Mark as failed
            setOperations(prev => prev.map(prevOp => 
              prevOp.id === op.id ? { 
                ...prevOp, 
                status: 'failed' as const, 
                error: errorMessage 
              } : prevOp
            ));
            
            result.failed++;
            result.errors.push(`${op.operation} on ${op.table}: ${errorMessage}`);
            return { success: false, id: op.id, error: errorMessage };
          }
        });

        await Promise.all(batchPromises);
      }

      if (result.failed > 0) {
        result.success = false;
        toast({
          variant: "destructive",
          title: "Opérations partiellement échouées",
          description: `${result.completed} réussies, ${result.failed} échouées`,
        });
      } else {
        toast({
          title: "Opérations terminées",
          description: `${result.completed} opération(s) réussie(s)`,
        });
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      toast({
        variant: "destructive",
        title: "Erreur lors du traitement",
        description: "Une erreur est survenue pendant le traitement des opérations",
      });
    } finally {
      setIsProcessing(false);
    }

    return result;
  }, [operations, isProcessing]);

  // Clear completed operations
  const clearCompleted = useCallback(() => {
    setOperations(prev => prev.filter(op => op.status !== 'completed'));
  }, []);

  // Clear all operations
  const clearAll = useCallback(() => {
    setOperations([]);
  }, []);

  // Retry failed operations
  const retryFailed = useCallback(() => {
    setOperations(prev => prev.map(op => 
      op.status === 'failed' ? { ...op, status: 'pending' as const, error: undefined } : op
    ));
  }, []);

  // Bulk room updates
  const bulkUpdateRooms = useCallback((roomUpdates: Array<{ id: string; status: string; housekeeper_id?: string }>) => {
    roomUpdates.forEach(update => {
      queueOperation('update', 'rooms', { id: update.id, updates: update });
    });
  }, [queueOperation]);

  // Bulk housekeeper creation
  const bulkCreateHousekeepers = useCallback((housekeepers: Array<{ name: string; hotel_id: string }>) => {
    housekeepers.forEach(housekeeper => {
      queueOperation('insert', 'housekeepers', housekeeper);
    });
  }, [queueOperation]);

  // Statistics
  const stats = {
    total: operations.length,
    pending: operations.filter(op => op.status === 'pending').length,
    processing: operations.filter(op => op.status === 'processing').length,
    completed: operations.filter(op => op.status === 'completed').length,
    failed: operations.filter(op => op.status === 'failed').length,
  };

  return {
    operations,
    stats,
    isProcessing,
    queueOperation,
    processOperations,
    clearCompleted,
    clearAll,
    retryFailed,
    bulkUpdateRooms,
    bulkCreateHousekeepers,
  };
}
