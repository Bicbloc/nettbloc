import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, Clock, ChevronDown } from 'lucide-react';
import { DailyReportCloseButton } from '@/components/DailyReportCloseButton';
import { AutoCloseSettingsDialog } from '@/components/AutoCloseSettingsDialog';

interface DayClosureControlProps {
  hotelId: string;
  onReportClosed?: () => void;
}

/**
 * Contrôle unique regroupant la clôture manuelle de la journée
 * et les paramètres de clôture automatique.
 */
export function DayClosureControl({ hotelId, onReportClosed }: DayClosureControlProps) {
  const [closeOpen, setCloseOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-8 gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden xl:inline">Clôture</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setCloseOpen(true)} className="gap-2">
            <Calendar className="h-4 w-4" />
            Clôturer la journée
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAutoOpen(true)} className="gap-2">
            <Clock className="h-4 w-4" />
            Clôture automatique…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogues contrôlés, sans déclencheur visible */}
      <DailyReportCloseButton
        hotelId={hotelId}
        onReportClosed={onReportClosed}
        open={closeOpen}
        onOpenChange={setCloseOpen}
        hideTrigger
      />
      <AutoCloseSettingsDialog
        hotelId={hotelId}
        open={autoOpen}
        onOpenChange={setAutoOpen}
        hideTrigger
      />
    </>
  );
}
