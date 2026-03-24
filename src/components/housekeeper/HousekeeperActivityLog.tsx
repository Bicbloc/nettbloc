import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ActivityLogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface HousekeeperActivityLogProps {
  entries: ActivityLogEntry[];
  onClose: () => void;
}

export const HousekeeperActivityLog: React.FC<HousekeeperActivityLogProps> = ({ entries, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <Card className="w-full max-w-md max-h-[60vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-lg">Journal d'activité</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[calc(60vh-80px)]">
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Aucune activité</p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground whitespace-nowrap">{entry.time}</span>
                  <span className={
                    entry.type === 'success' ? 'text-green-600' :
                    entry.type === 'warning' ? 'text-yellow-600' :
                    entry.type === 'error' ? 'text-red-600' : ''
                  }>{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
