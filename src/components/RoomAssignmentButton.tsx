import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { UserCheck, ChevronDown } from 'lucide-react';
import { Room } from '@/services/pdfService';

interface RoomAssignmentButtonProps {
  room: Room;
  housekeeperNames: string[];
  onAssign: (roomNumber: string, housekeeperName: string) => void;
  className?: string;
}

export function RoomAssignmentButton({ 
  room, 
  housekeeperNames, 
  onAssign, 
  className 
}: RoomAssignmentButtonProps) {
  if (housekeeperNames.length === 0) {
    return null;
  }

  const handleAssignment = (housekeeperName: string) => {
    onAssign(room.number, housekeeperName);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={`h-6 text-xs bg-primary/10 hover:bg-primary/20 border-primary/20 ${className}`}
        >
          <UserCheck className="h-3 w-3 mr-1" />
          Assigner
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {housekeeperNames.map((name) => (
          <DropdownMenuItem
            key={name}
            onClick={() => handleAssignment(name)}
            className="cursor-pointer"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}