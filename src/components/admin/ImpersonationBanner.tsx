import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'admin_impersonation';

interface ImpersonationState {
  adminAccessToken: string;
  adminRefreshToken: string;
  targetEmail: string;
  startedAt: number;
}

export function getImpersonationState(): ImpersonationState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null);
  const [exiting, setExiting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setState(getImpersonationState());
    const onStorage = () => setState(getImpersonationState());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!state) return null;

  const exitImpersonation = async () => {
    setExiting(true);
    try {
      await supabase.auth.setSession({
        access_token: state.adminAccessToken,
        refresh_token: state.adminRefreshToken,
      });
      localStorage.removeItem(STORAGE_KEY);
      toast({ title: 'Session admin restaurée' });
      window.location.href = '/admin';
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
      setExiting(false);
    }
  };

  return (
    <div className="sticky top-0 left-0 right-0 z-[10000] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className="h-4 w-4" />
        <span>Mode impersonation — connecté en tant que <strong>{state.targetEmail}</strong></span>
      </div>
      <Button size="sm" variant="outline" onClick={exitImpersonation} disabled={exiting} className="bg-white">
        <LogOut className="h-3 w-3 mr-1" />
        {exiting ? 'Sortie...' : 'Quitter'}
      </Button>
    </div>
  );
}
