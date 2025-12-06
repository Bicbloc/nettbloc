import { Badge } from "@/components/ui/badge";
import { Room } from "@/services/pdfService";
import { Checkbox } from "@/components/ui/checkbox";
import { Bed, AlertCircle, Clock, Layers, Check, MoreVertical, UserX, ArrowRight, Trash2, Link, Wrench, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DeleteRoomDialog } from "@/components/DeleteRoomDialog";
import { LinkRoomsDialog } from "@/components/LinkRoomsDialog";
import { RoomIncidentsDialog } from "@/components/incident/RoomIncidentsDialog";

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
  const [dragging, setDragging] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showIncidentsDialog, setShowIncidentsDialog] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs-cleaning':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">À Nettoyer</Badge>;
      case 'ready-to-clean':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-100">Prêt à Nettoyer</Badge>;
      case 'clean':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Propre</Badge>;
      case 'occupied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Occupé</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getCleaningTypeBadge = (type: string) => {
    switch (type) {
      case 'full':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">🚪 Départ</Badge>;
      case 'quick':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">🛏️ Recouche</Badge>;
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

  const setCleaningType = (type: 'full' | 'quick') => {
    onUpdate({
      ...room,
      cleaningType: type,
      status: 'needs-cleaning'
    });
    
    toast({
      description: `Chambre ${room.number} : ${type === 'full' ? '🚪 Départ' : '🛏️ Recouche'}`
    });
  };

  // Détermine l'étage à partir du numéro de chambre
  const floor = room.floor !== undefined ? room.floor : (room.number ? parseInt(room.number[0]) : 0);
  const floorDisplay = floor === 0 ? "RDC" : `${floor}`;

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
          room.notUrgent ? 'border-green-500 bg-green-50' : 
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
          {room.cleaningType !== 'none' && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
              room.cleaningType === 'full' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {room.cleaningType === 'full' ? 'B' : 'R'}
            </span>
          )}
          {room.status === 'clean' && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5">
              <Check className="h-2 w-2" /> Propre
            </span>
          )}
          {isInProgress && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5 animate-badge-pulse">
              <Loader2 className="h-2 w-2 animate-spin" /> En cours
            </span>
          )}
          {room.isTwin && <Bed className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
          {room.status === 'needs-attention' && room.remark && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5">
              <AlertCircle className="h-2 w-2" /> Remarque
            </span>
          )}
          {room.status === 'ready-to-clean' && (
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              🚪
            </span>
          )}
          <span className="text-xs text-muted-foreground font-medium flex-shrink-0 ml-auto">{floorDisplay}</span>
        </div>
        
        {/* Afficher les notes/commentaires de la femme de chambre */}
        {room.notes && (
          <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md truncate" title={room.notes}>
            💬 {room.notes}
          </div>
        )}
        
        {/* Boutons de changement rapide et menu réassignation */}
        {showActions && (
          <div className="ml-2 flex items-center gap-1 flex-shrink-0">
            <button 
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-purple-100 text-purple-700 transition-colors font-semibold text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setCleaningType('full');
              }}
              title="À Blanc"
            >
              B
            </button>
            <button 
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-blue-100 text-blue-700 transition-colors font-semibold text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setCleaningType('quick');
              }}
              title="Recouche"
            >
              R
            </button>
            <button
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-green-100 text-green-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({
                  ...room,
                  status: 'clean'
                });
                toast({
                  description: `Chambre ${room.number} marquée comme propre`
                });
              }}
              title="Marquer comme propre"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-orange-100 text-orange-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({
                  ...room,
                  status: 'ready-to-clean'
                });
                toast({
                  description: `Chambre ${room.number} marquée comme prête à nettoyer (client sorti)`
                });
              }}
              title="Client sorti - Prêt à nettoyer"
            >
              🚪
            </button>
            
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
                title={incidentCount > 0 ? `${incidentCount} incident(s)` : "Voir les incidents"}
              >
                <Wrench className="h-3 w-3" />
                {incidentCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
                    {incidentCount}
                  </span>
                )}
              </button>
            )}
            
            {/* Boutons de gestion des chambres en mode compact */}
            {onLinkRooms && (
              <button
                className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-blue-100 text-blue-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLinkDialog(true);
                }}
                title="Lier avec d'autres chambres"
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
                title="Supprimer la chambre"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            
            {/* Menu de réassignation si la chambre est assignée */}
            {room.assignedTo && onReassign && housekeeperNames.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="Options de réassignation"
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
                    Désassigner
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
                          description: `Chambre ${room.number} réassignée à ${name}`
                        });
                      }}
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Réassigner à {name}
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
      </div>
    );
  }

  return (
    <div 
      ref={cardRef}
      className={`p-4 border rounded-lg transition-all duration-200 ${
        dragging ? 'opacity-50' : ''
      } ${
        isSelected ? 'bg-blue-100 border-blue-500 border-2' :
        room.isUrgent ? 'border-red-500 border-2 shadow-md' : 
        room.notUrgent ? 'border-green-500 border-2' : 'border-gray-200 shadow-sm'
      } ${
        selectable ? 'cursor-pointer' : ''
      }`}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <h3 className="text-lg font-bold">{room.number}</h3>
          <Badge variant="outline" className="bg-gray-100 text-gray-700">
            <Layers className="h-3 w-3 mr-1" /> {floorDisplay}
          </Badge>
          {room.status === 'needs-attention' && room.remark && (
            <Badge variant="outline" className="bg-red-100 text-red-800">
              <AlertCircle className="h-3 w-3 mr-1" /> Remarque
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {getStatusBadge(room.status)}
          {getCleaningTypeBadge(room.cleaningType)}
        </div>
      </div>
      
      {/* Afficher la remarque si présente */}
      {room.status === 'needs-attention' && room.remark && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Remarque signalée :</p>
              <p className="text-sm text-red-700 mt-1">{room.remark}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* New Cleaning Type Selection */}
      <div className="mb-3 mt-2 p-2 border border-gray-200 rounded-md bg-gray-50">
        <p className="text-xs font-medium mb-2 text-gray-700">Type de nettoyage:</p>
        <RadioGroup 
          value={room.cleaningType} 
          className="flex gap-2"
          onValueChange={(value) => setCleaningType(value as 'full' | 'quick')}
        >
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="full" id={`full-${room.number}`} />
            <Label 
              htmlFor={`full-${room.number}`}
              className="flex items-center text-xs gap-1 cursor-pointer text-purple-800"
            >
              🚪 Départ
            </Label>
          </div>
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="quick" id={`quick-${room.number}`} />
            <Label 
              htmlFor={`quick-${room.number}`}
              className="flex items-center text-xs gap-1 cursor-pointer text-blue-800"
            >
              🛏️ Recouche
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="flex flex-col gap-2 mt-3">
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
            Prioritaire <AlertCircle className="h-4 w-4" />
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
            Pas urgent <Clock className="h-4 w-4" />
          </label>
        </div>
      </div>

      {/* Boutons de gestion des chambres */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
        {room.linkedRooms && room.linkedRooms.length > 0 && (
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">Chambres liées:</p>
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
          {/* Bouton incidents en mode non-compact */}
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
              title={incidentCount > 0 ? `${incidentCount} incident(s)` : "Voir les incidents"}
            >
              <Wrench className="h-3 w-3" />
              Incidents
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
              title="Lier avec d'autres chambres"
            >
              <Link className="h-3 w-3" />
              Lier
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
              title="Supprimer la chambre"
            >
              <Trash2 className="h-3 w-3" />
              Supprimer
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
    </div>
  );
}
