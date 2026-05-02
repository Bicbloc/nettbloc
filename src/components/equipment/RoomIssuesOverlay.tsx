import { AlertTriangle, Wrench } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EquipmentIssue, IssueType } from '@/hooks/use-equipment';

interface RoomIssuesOverlayProps {
  issues: EquipmentIssue[];
  roomNumber?: string;
  onResolve?: (issueId: string) => void;
  compact?: boolean;
}

const TYPE_LABEL: Record<IssueType, string> = {
  to_repair: 'À réparer',
  to_replace: 'À remplacer',
  missing: 'Manquant',
  damaged: 'Endommagé',
  other: 'Autre',
};

const TYPE_COLOR: Record<IssueType, string> = {
  to_repair: 'bg-amber-500',
  to_replace: 'bg-orange-500',
  missing: 'bg-red-500',
  damaged: 'bg-rose-500',
  other: 'bg-slate-500',
};

export function RoomIssuesOverlay({ issues, roomNumber, onResolve, compact }: RoomIssuesOverlayProps) {
  if (!issues.length) return null;

  const count = issues.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`absolute top-1 right-1 z-10 flex items-center gap-1 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition ${compact ? 'h-5 w-5 justify-center' : 'px-2 py-0.5 text-xs'}`}
          aria-label={`${count} problème(s) en cours`}
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          {!compact && <span className="font-semibold">{count}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-3 py-2 bg-red-50 dark:bg-red-950/30">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-red-600" />
            <span className="font-semibold text-sm">
              {roomNumber ? `Chambre ${roomNumber}` : 'Problèmes en cours'} ({count})
            </span>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {issues.map((issue) => (
            <div key={issue.id} className="p-3 space-y-1">
              <div className="flex items-start gap-2">
                <Badge className={`${TYPE_COLOR[issue.issue_type]} text-white text-[10px] px-1.5 py-0`}>
                  {TYPE_LABEL[issue.issue_type]}
                </Badge>
                <span className="font-medium text-sm flex-1">{issue.title}</span>
              </div>
              {issue.description && (
                <p className="text-xs text-muted-foreground">{issue.description}</p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(issue.reported_at).toLocaleDateString()}
                  {issue.reported_by_name ? ` · ${issue.reported_by_name}` : ''}
                </span>
                {onResolve && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={() => onResolve(issue.id)}
                  >
                    Résoudre
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
