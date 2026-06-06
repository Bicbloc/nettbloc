import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { Checkbox } from "@/components/ui/checkbox";
import { Bed, AlertCircle, Clock, Layers, Check, MoreVertical, UserX, ArrowRight, Trash2, Link, Wrench, Loader2, MessageSquare, ShieldCheck, Star, X, Moon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DeleteRoomDialog } from "@/components/DeleteRoomDialog";
import { LinkRoomsDialog } from "@/components/LinkRoomsDialog";
import { RoomIncidentsDialog } from "@/components/incident/RoomIncidentsDialog";
import { EditRoomNoteDialog } from "@/components/EditRoomNoteDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { RoomCardIssuesOverlay } from "@/components/equipment/RoomCardIssuesOverlay";

interface RoomCardProps {
  room: Room;
  onUpdate: (room: Room) => void;
  onAssign?: (room: Room, housekeeperName: string) => void;
  onUnassign?: (room: Room) => void;
  onReassign?: (room: Room, newHousekeeper: string | null) => void;
  onDelete?: (roomNumber: string) => void;
  onLinkRooms?: (roomNumber: string, linkedRoomNumbers: string[]) => void;
  housekeeperNames?: string[];
  allRooms?: Room[];
  draggable?: boolean;
  compact?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (room: Room) => void;
  showActions?: boolean;
  hotelId?: string;
  incidentCount?: number;
}

export function RoomCard({ 
  room, 
  onUpdate, 
  onAssign, 
  onUnassign,
  onReassign,
  onDelete,
  onLinkRooms,
  housekeeperNames = [],
  allRooms = [],
  draggable = false, 
  compact = false, 
  selectable = false,
  isSelected = false,
  onSelect,
  showActions = false,
  hotelId,
  incidentCount = 0
}: RoomCardProps) {
  const { t } = useLanguage();
  const [dragging, setDragging] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showIncidentsDialog, setShowIncidentsDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [, setTick] = useState(0); // Force re-render for timer
  const cardRef = useRef<HTMLDivElement>(null);

  // Helper function to calculate elapsed time
  const getElapsedTime = (startTime: string | Date): string => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}min`;
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h${mins > 0 ? `${mins.toString().padStart(2, '0')}` : ''}`;
  };

  // Update timer every minute for in-progress rooms
  useEffect(() => {
    const isInProgressRoom = room.status === 'in_progress' || room.status === 'in-progress';
    if (!isInProgressRoom || !room.cleaningStartedAt) return;
    
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [room.status, room.cleaningStartedAt]);

  // Add animation effect when dragging
  useEffect(() => {
    if (!cardRef.current) return;
    
    if (dragging) {
      cardRef.current.classList.add('scale-105', 'shadow-lg');
    } else {
      cardRef.current.classList.remove('scale-105', 'shadow-lg');
    }
  }, [dragging]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(room));
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a custom drag image
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      e.dataTransfer.setDragImage(cardRef.current, rect.width / 2, rect.height / 2);
    }
    
    setDragging(true);
  };

  const handleDragEnd = () => {
    setDragging(false);
  };

  const isDeparture =
    room.cleaningType === 'a_blanc' ||
    room.cleaningType === 'full' ||
    room.status === 'checkout' ||
    room.status === 'ready-to-clean';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs-cleaning':
        // Une chambre "à blanc" est un départ (client sorti), même si elle est encore à nettoyer
        if (isDeparture) {
          return <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-100">{t.rooms.departure}</Badge>;
        }
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{t.rooms.dirty}</Badge>;
      case 'ready-to-clean':
      case 'checkout':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-100">{t.rooms.departure}</Badge>;
      case 'clean':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">{t.rooms.clean}</Badge>;
      case 'occupied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">{t.rooms.occupied}</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  
  const getCleaningTypeBadge = (type: string) => {
    switch (type) {
      case 'full':
      case 'a_blanc':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">🚪 {t.rooms.fullClean}</Badge>;
      case 'quick':
      case 'recouche':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">🛏️ {t.rooms.quickClean}</Badge>;
      case 'none':
        return null;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const toggleTwin = () => {
    onUpdate({
      ...room,
      isTwin: !room.isTwin
    });
  };

  const toggleDnd = () => {
    const next = !room.doNotDisturb;
    onUpdate({
      ...room,
      doNotDisturb: next
    });
    toast({
      description: `${t.rooms.room} ${room.number} — ${next ? `🌙 ${t.rooms.doNotDisturb}` : `✅ ${t.rooms.doNotDisturb} ✕`}`
    });
  };

  const toggleUrgent = () => {
    onUpdate({
      ...room,
      isUrgent: !room.isUrgent,
      notUrgent: false,
      priority: !room.isUrgent ? 'high' : 'medium'
    });
  };

  const toggleNotUrgent = () => {
    onUpdate({
      ...room,
      notUrgent: !room.notUrgent,
      isUrgent: false,
      priority: !room.notUrgent ? 'low' : 'medium'
    });
  };

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(room);
    }
  };

  const setCleaningType = (type: 'a_blanc' | 'recouche') => {
    onUpdate({
      ...room,
      cleaningType: type,
      status: 'needs-cleaning'
    });
    
    toast({
      description: `${t.rooms.room} ${room.number} : ${type === 'a_blanc' ? `🚪 ${t.rooms.fullClean}` : `🛏️ ${t.rooms.quickClean}`}`
    });
  };

  // Determine floor from room number
  const floor = room.floor !== undefined ? room.floor : (room.number ? parseInt(room.number[0]) : 0);
  const floorDisplay = floor === 0 ? t.rooms.groundFloor : `${floor}`;

  // Détecte si la chambre est en cours de nettoyage
  const isInProgress = room.status === 'in_progress' || room.status === 'in-progress';

  if (compact) {
    return (
      <div 
        ref={cardRef}
        className={`px-3 py-2 text-xs border rounded-xl bg-card shadow-modern flex flex-col gap-1 transition-all duration-300 ${
          dragging ? 'opacity-50' : ''
        } ${
          isInProgress ? 'border-blue-500 border-2 bg-blue-50/50 animate-pulse-cleaning' :
          isSelected ? 'bg-gradient-primary text-primary-foreground border-2' :
          room.isUrgent ? 'border-destructive border-2 bg-destructive/5' : 
          room.status === 'clean' ? 'border-green-400 bg-green-50/50' : 'border-border hover:shadow-modern-md'
        } ${
          selectable ? 'cursor-pointer hover:scale-[1.02]' : ''
        } animate-fade-in`}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-semibold text-sm whitespace-nowrap">{room.number}</span>
          {room.doNotDisturb && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-0.5">
              <Moon className="h-2.5 w-2.5" /> {t.rooms.doNotDisturb}
            </span>
          )}
          {(room.cleaningType === 'full' || room.cleaningType === 'a_blanc') && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap bg-purple-100 text-purple-700 border border-purple-200">
              {t.rooms.fullCleanShort}
            </span>
          )}
          {(room.cleaningType === 'quick' || room.cleaningType === 'recouche') && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap bg-blue-100 text-blue-700 border border-blue-200">
              {t.rooms.quickCleanShort}
            </span>
          )}
          {room.status === 'clean' && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5">
              <Check className="h-2 w-2" /> {t.rooms.clean}
            </span>
          )}
          {room.status === 'clean' && room.inspectedAt && (
            <span 
              className="text-xs bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5 border border-emerald-400"
              title={`${t.rooms.inspectionOk} ✓`}
            >
              <Star className="h-2.5 w-2.5 fill-emerald-600 text-emerald-600" /> OK
            </span>
          )}
          {room.status === 'needs-cleaning' && room.inspectedAt === null && room.remark && (
            <span 
              className="text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5 border border-red-400"
              title={t.rooms.inspectionFailed}
            >
              <Star className="h-2.5 w-2.5 fill-red-600 text-red-600" /> KO
            </span>
          )}
          {isInProgress && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5 animate-badge-pulse">
              <Loader2 className="h-2 w-2 animate-spin" /> {t.rooms.inProgress}
              {room.cleaningStartedAt && (
                <span className="ml-1 font-medium">
                  ({getElapsedTime(room.cleaningStartedAt)})
                </span>
              )}
            </span>
          )}
          {room.isTwin && <Bed className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
          {room.status === 'needs-attention' && room.remark && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5">
              <AlertCircle className="h-2 w-2" /> {t.rooms.remark}
            </span>
          )}
          {(room.status === 'ready-to-clean' || room.status === 'checkout') && (
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              🚪
            </span>
          )}
          <span className="text-xs text-muted-foreground font-medium flex-shrink-0 ml-auto">{floorDisplay}</span>
        </div>
        
        {/* Notes/comments display - clickable to edit */}
        {room.notes ? (
          <button 
            className="text-xs bg-purple-100 text-purple-800 border border-purple-300 px-2 py-1.5 rounded-lg text-left w-full hover:bg-purple-200 transition-colors cursor-pointer" 
            title={t.common.edit}
            onClick={(e) => {
              e.stopPropagation();
              setShowNoteDialog(true);
            }}
          >
            <span className="font-semibold">💬 {t.rooms.comment}:</span> {room.notes}
          </button>
        ) : showActions && (
          <button
            className="text-xs text-muted-foreground hover:text-purple-600 hover:bg-purple-50 px-2 py-1 rounded flex items-center gap-1 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowNoteDialog(true);
            }}
          >
            <MessageSquare className="h-3 w-3" />
            {t.rooms.addComment}
          </button>
        )}
        
        {/* Boutons de changement rapide et menu réassignation */}
        {showActions && (
          <div className="ml-2 flex items-center gap-1 flex-shrink-0">
            <button
              className={`h-6 w-6 flex items-center justify-center rounded-lg transition-colors ${
                room.doNotDisturb ? 'bg-rose-100 text-rose-700' : 'hover:bg-rose-100 text-rose-600'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleDnd();
              }}
              title={t.rooms.doNotDisturb}
            >
              <Moon className="h-3 w-3" />
            </button>
            <button 
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-purple-100 text-purple-700 transition-colors font-semibold text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setCleaningType('a_blanc');
              }}
              title={t.rooms.fullClean}
            >
              {t.rooms.fullCleanShort}
            </button>
            <button 
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-blue-100 text-blue-700 transition-colors font-semibold text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setCleaningType('recouche');
              }}
              title={t.rooms.quickClean}
            >
              {t.rooms.quickCleanShort}
            </button>
            {/* Bouton Propre / Annuler Propre */}
            {room.status === 'clean' ? (
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-red-100 text-red-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({
                    ...room,
                    status: 'needs-cleaning'
                  });
                  toast({
                    description: `❌ ${t.rooms.room} ${room.number} - ${t.rooms.cancelClean}`
                  });
                }}
                title={t.rooms.cancelClean}
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-green-100 text-green-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({
                    ...room,
                    status: 'clean'
                  });
                  toast({
                    description: `${t.rooms.room} ${room.number} ${t.rooms.markAsClean}`
                  });
                }}
                title={t.rooms.markAsClean}
              >
                <Check className="h-3 w-3" />
              </button>
            )}
            
            {/* Bouton Client Sorti / Annuler Client Sorti */}
            {room.status === 'ready-to-clean' || room.status === 'checkout' ? (
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-red-100 text-red-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({
                    ...room,
                    status: 'needs-cleaning'
                  });
                  toast({
                    description: `❌ ${t.rooms.room} ${room.number} - ${t.rooms.cancelGuestOut}`
                  });
                }}
                title={t.rooms.cancelGuestOut}
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-orange-100 text-orange-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({
                    ...room,
                     status: 'ready-to-clean',
                     cleaningType: 'a_blanc'
                  });
                  toast({
                    description: `${t.rooms.room} ${room.number} - ${t.rooms.readyToClean}`
                  });
                }}
                title={t.rooms.guestOut}
              >
                🚪
              </button>
            )}
            
            {/* Bouton incidents en mode compact */}
            {hotelId && (
              <button
                className={`h-6 w-6 flex items-center justify-center rounded-lg transition-colors relative ${
                  incidentCount > 0 
                    ? 'hover:bg-orange-100 text-orange-600' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowIncidentsDialog(true);
                }}
                title={incidentCount > 0 ? `${incidentCount} incident(s)` : t.rooms.viewIncidents}
              >
                <Wrench className="h-3 w-3" />
                {incidentCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
                    {incidentCount}
                  </span>
                )}
              </button>
            )}
            
            {/* Room management buttons in compact mode */}
            {onLinkRooms && (
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-blue-100 text-blue-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLinkDialog(true);
                }}
                title={t.rooms.linkWithRooms}
              >
                <Link className="h-3 w-3" />
              </button>
            )}
            
            {onDelete && (
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-red-100 text-red-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                title={t.rooms.deleteRoom}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            
            {/* Reassignment menu if room is assigned */}
            {room.assignedTo && onReassign && housekeeperNames.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title={t.rooms.reassignmentOptions}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onUnassign) onUnassign(room);
                    }}
                    className="text-orange-600"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    {t.rooms.unassign}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {housekeeperNames
                    .filter(name => name !== room.assignedTo)
                    .map(name => (
                    <DropdownMenuItem
                      key={name}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReassign(room, name);
                        toast({
                          description: `${t.rooms.room} ${room.number} → ${name}`
                        });
                      }}
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      {t.rooms.reassignTo} {name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        
        {/* Dialogs aussi en mode compact */}
        {showDeleteDialog && onDelete && (
          <DeleteRoomDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            room={room}
            onDeleteRoom={onDelete}
          />
        )}

        {showLinkDialog && onLinkRooms && (
          <LinkRoomsDialog
            open={showLinkDialog}
            onOpenChange={setShowLinkDialog}
            room={room}
            allRooms={allRooms}
            onLinkRooms={onLinkRooms}
          />
        )}

        {showIncidentsDialog && hotelId && (
          <RoomIncidentsDialog
            open={showIncidentsDialog}
            onOpenChange={setShowIncidentsDialog}
            hotelId={hotelId}
            roomNumber={room.number}
          />
        )}

        {showNoteDialog && hotelId && (
          <EditRoomNoteDialog
            open={showNoteDialog}
            onOpenChange={setShowNoteDialog}
            room={room}
            hotelId={hotelId}
            onNoteUpdated={(r, newNote) => {
              onUpdate({ ...r, notes: newNote || undefined });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div 
      ref={cardRef}
      className={`relative p-4 border rounded-lg transition-all duration-200 ${
        dragging ? 'opacity-50' : ''
      } ${
        isSelected ? 'bg-blue-100 border-blue-500 border-2' :
        room.isUrgent ? 'border-red-500 border-2 shadow-md' : 
        room.status === 'clean' ? 'border-green-400 border-2' : 'border-gray-200 shadow-sm'
      } ${
        selectable ? 'cursor-pointer' : ''
      }`}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      <RoomCardIssuesOverlay hotelId={hotelId} roomNumber={room.number} compact={compact} />
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <h3 className="text-lg font-bold">{room.number}</h3>
          <Badge variant="outline" className="bg-gray-100 text-gray-700">
            <Layers className="h-3 w-3 mr-1" /> {floorDisplay}
          </Badge>
          {room.status === 'needs-attention' && room.remark && (
            <Badge variant="outline" className="bg-red-100 text-red-800">
              <AlertCircle className="h-3 w-3 mr-1" /> {t.rooms.remark}
            </Badge>
          )}
          {isInProgress && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 animate-pulse gap-1">
              <Clock className="h-3 w-3" />
              {t.rooms.inProgress}
              {room.cleaningStartedAt && (
                <span className="font-semibold ml-1">
                  {getElapsedTime(room.cleaningStartedAt)}
                </span>
              )}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {room.doNotDisturb && (
            <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300 gap-1">
              <Moon className="h-3 w-3" /> {t.rooms.doNotDisturb}
            </Badge>
          )}
          {getStatusBadge(room.status)}
          {getCleaningTypeBadge(room.cleaningType)}
        </div>
      </div>
      
      {/* Display housekeeper notes/comments - clickable to edit */}
      {room.notes ? (
        <button 
          className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-md w-full text-left hover:bg-purple-100 transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowNoteDialog(true);
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">💬</span>
            <div>
              <p className="text-sm font-medium text-purple-800">{t.rooms.housekeeperComment}:</p>
              <p className="text-sm text-purple-700 mt-1">{room.notes}</p>
            </div>
          </div>
        </button>
      ) : (
        <button
          className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-600 hover:bg-purple-50 px-3 py-2 rounded-md transition-colors w-full"
          onClick={(e) => {
            e.stopPropagation();
            setShowNoteDialog(true);
          }}
        >
          <MessageSquare className="h-4 w-4" />
          {t.rooms.addComment}
        </button>
      )}
      
      {/* Display remark if present */}
      {room.status === 'needs-attention' && room.remark && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">{t.rooms.remarkReported}:</p>
              <p className="text-sm text-red-700 mt-1">{room.remark}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Cleaning Type Selection */}
      <div className="mb-3 mt-2 p-2 border border-gray-200 rounded-md bg-gray-50">
        <p className="text-xs font-medium mb-2 text-gray-700">{t.rooms.cleaningTypeLabel}:</p>
        <RadioGroup 
          value={room.cleaningType === 'full' ? 'a_blanc' : room.cleaningType === 'quick' ? 'recouche' : room.cleaningType} 
          className="flex gap-2"
          onValueChange={(value) => setCleaningType(value as 'a_blanc' | 'recouche')}
        >
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="a_blanc" id={`a_blanc-${room.number}`} />
            <Label 
              htmlFor={`a_blanc-${room.number}`}
              className="flex items-center text-xs gap-1 cursor-pointer text-purple-800"
            >
              🚪 {t.rooms.fullClean}
            </Label>
          </div>
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="recouche" id={`recouche-${room.number}`} />
            <Label 
              htmlFor={`recouche-${room.number}`}
              className="flex items-center text-xs gap-1 cursor-pointer text-blue-800"
            >
              🛏️ {t.rooms.quickClean}
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`dnd-${room.number}`}
            checked={room.doNotDisturb || false}
            onCheckedChange={toggleDnd}
          />
          <label
            htmlFor={`dnd-${room.number}`}
            className="text-sm font-medium flex items-center gap-1 cursor-pointer text-rose-600"
          >
            {t.rooms.doNotDisturb} <Moon className="h-4 w-4" />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox 
            id={`twin-${room.number}`} 
            checked={room.isTwin || false}
            onCheckedChange={toggleTwin}
          />
          <label 
            htmlFor={`twin-${room.number}`}
            className="text-sm font-medium flex items-center gap-1 cursor-pointer"
          >
            Twin <Bed className="h-4 w-4" />
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox 
            id={`urgent-${room.number}`} 
            checked={room.isUrgent || false}
            onCheckedChange={toggleUrgent}
          />
          <label 
            htmlFor={`urgent-${room.number}`}
            className="text-sm font-medium flex items-center gap-1 cursor-pointer text-red-500"
          >
            {t.rooms.priority} <AlertCircle className="h-4 w-4" />
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox 
            id={`noturgent-${room.number}`} 
            checked={room.notUrgent || false}
            onCheckedChange={toggleNotUrgent}
          />
          <label 
            htmlFor={`noturgent-${room.number}`}
            className="text-sm font-medium flex items-center gap-1 cursor-pointer text-green-500"
          >
            {t.rooms.notUrgent} <Clock className="h-4 w-4" />
          </label>
        </div>
      </div>

      {/* Room management buttons */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
        {room.linkedRooms && room.linkedRooms.length > 0 && (
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">{t.rooms.linkedRooms}:</p>
            <div className="flex flex-wrap gap-1">
              {room.linkedRooms.map(linkedRoom => (
                <Badge key={linkedRoom} variant="secondary" className="text-xs">
                  {linkedRoom}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex gap-1 flex-wrap">
          {/* Incidents button in non-compact mode */}
          {hotelId && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowIncidentsDialog(true);
              }}
              className={`flex items-center gap-1 relative ${
                incidentCount > 0 
                  ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300' 
                  : ''
              }`}
              title={incidentCount > 0 ? `${incidentCount} incident(s)` : t.rooms.viewIncidents}
            >
              <Wrench className="h-3 w-3" />
              {t.rooms.incidents}
              {incidentCount > 0 && (
                <Badge className="ml-1 bg-orange-500 text-white text-[10px] px-1.5 py-0">
                  {incidentCount}
                </Badge>
              )}
            </Button>
          )}

          {onLinkRooms && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowLinkDialog(true);
              }}
              className="flex items-center gap-1"
              title={t.rooms.linkWithRooms}
            >
              <Link className="h-3 w-3" />
              {t.rooms.link}
            </Button>
          )}
          
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              title={t.rooms.deleteRoom}
            >
              <Trash2 className="h-3 w-3" />
              {t.rooms.delete}
            </Button>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showDeleteDialog && onDelete && (
        <DeleteRoomDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          room={room}
          onDeleteRoom={onDelete}
        />
      )}

      {showLinkDialog && onLinkRooms && (
        <LinkRoomsDialog
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
          room={room}
          allRooms={allRooms}
          onLinkRooms={onLinkRooms}
        />
      )}

      {showIncidentsDialog && hotelId && (
        <RoomIncidentsDialog
          open={showIncidentsDialog}
          onOpenChange={setShowIncidentsDialog}
          hotelId={hotelId}
          roomNumber={room.number}
        />
      )}

      {showNoteDialog && hotelId && (
        <EditRoomNoteDialog
          open={showNoteDialog}
          onOpenChange={setShowNoteDialog}
          room={room}
          hotelId={hotelId}
          onNoteUpdated={(r, newNote) => {
            onUpdate({ ...r, notes: newNote || undefined });
          }}
        />
      )}
    </div>
  );
}
