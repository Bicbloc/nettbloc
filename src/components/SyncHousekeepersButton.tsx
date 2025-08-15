import { Button } from '@/components/ui/button';
import { RefreshCw, Database } from 'lucide-react';
import { useHousekeeperSync } from '@/hooks/use-housekeeper-sync';

interface SyncHousekeepersButtonProps {
  className?: string;
}

export function SyncHousekeepersButton({ className }: SyncHousekeepersButtonProps) {
  const { syncHousekeepers, isSyncing } = useHousekeeperSync();

  const handleSync = async () => {
    await syncHousekeepers();
  };

  return (
    <Button
      onClick={handleSync}
      disabled={isSyncing}
      variant="outline"
      size="sm"
      className={className}
    >
      {isSyncing ? (
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Database className="h-4 w-4 mr-2" />
      )}
      {isSyncing ? 'Synchronisation...' : 'Synchroniser avec la base'}
    </Button>
  );
}