import { useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, X, Sparkles, Send, AlertCircle, Play, ChevronRight } from 'lucide-react';
import { IncidentReportDialogSimple } from '@/components/incident/IncidentReportDialogSimple';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ActionLogService } from '@/services/actionLogService';

interface Room {
  id: string;
  room_number: string;
  status: string;
  notes?: string;
  cleaning_priority?: number;
  cleaning_type?: string;
}

interface RoomCardEnhancedProps {
  room: Room;
  hotelId: string;
  onUpdateStatus: (roomId: string, status: string, notes?: string) => void;
  onUnassign: (roomId: string, roomNumber: string) => void;
}

export const RoomCardEnhanced = ({ room, hotelId, onUpdateStatus, onUnassign }: RoomCardEnhancedProps) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);
  const [swipeStartTime, setSwipeStartTime] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  const isActionable = ['dirty', 'needs-cleaning', 'ready-to-clean', 'assigned'].includes(room.status);
  const isStartable = isActionable;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (room.status === 'in_progress' || isActionable) {
      touchStartX.current = e.touches[0].clientX;
      setSwipeStartTime(Date.now());
      setIsSwiping(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 200));
    }
  };

  const handleTouchEnd = async () => {
    if (!isSwiping) {
      setIsSwiping(false);
      setSwipeOffset(0);
      return;
    }

    setIsSwiping(false);
    const swipeDuration = Date.now() - swipeStartTime;

    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    if (room.status === 'in_progress' && swipeOffset > 120) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
      await onUpdateStatus(room.id, 'clean', notes || undefined);
    } else if (isActionable) {
      if (swipeOffset > 130 && swipeDuration > 500) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);
        await onUpdateStatus(room.id, 'clean', notes || undefined);
      } else if (swipeOffset > 80) {
        await onUpdateStatus(room.id, 'in_progress');
      }
    }
    
    setSwipeOffset(0);
  };

  const handleSendNote = async () => {
    if (!notes.trim()) return;
    
    setIsSendingNote(true);
    try {
      // Chercher l'assignation liée à cette chambre
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('id')
        .eq('room_id', room.id)
        .in('status', ['assigned', 'in_progress'])
        .maybeSingle();

      // Récupérer les infos de l'hôtel pour la notification
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .select('user_id, name')
        .eq('id', hotelId)
        .single();

      if (hotelError) {
        console.error('Erreur récupération hôtel:', hotelError);
        throw hotelError;
      }

      // Mettre à jour l'assignation si elle existe
      if (assignment && !assignmentError) {
        const { error: updateError } = await supabase
          .from('assignments')
          .update({ notes: notes.trim() })
          .eq('id', assignment.id);

        if (updateError) {
          console.error('Erreur mise à jour assignation:', updateError);
        }
      }

      // Toujours mettre à jour les notes de la chambre directement
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ notes: notes.trim() })
        .eq('id', room.id);

      if (roomUpdateError) {
        console.error('Erreur mise à jour chambre:', roomUpdateError);
      }

      // Créer une notification pour l'admin
      if (hotel?.user_id) {
        await supabase.from('notifications').insert({
          user_id: hotel.user_id,
          user_type: 'admin',
          hotel_id: hotelId,
          type: 'room_note',
          title: `Commentaire - Chambre ${room.room_number}`,
          description: notes.trim(),
          room_number: room.room_number,
          is_read: false
        });
      }

      // Récupérer le nom de la femme de chambre depuis le localStorage
      const housekeeperProfile = localStorage.getItem('housekeeperProfile');
      const housekeeperName = housekeeperProfile 
        ? JSON.parse(housekeeperProfile).name 
        : 'Femme de chambre';

      // Enregistrer dans le journal des actions
      await ActionLogService.logRoomRemark(
        hotelId, 
        room.room_number, 
        housekeeperName, 
        notes.trim()
      );

      toast({
        title: "Commentaire envoyé",
        description: `Le commentaire pour la chambre ${room.room_number} a été envoyé`,
      });
      
      setNotes('');
    } catch (error) {
      console.error('Erreur envoi commentaire:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'envoyer le commentaire"
      });
    } finally {
      setIsSendingNote(false);
    }
  };

  const isCompleting = swipeOffset > 120;
  const swipeProgress = Math.min((swipeOffset / 120) * 100, 100);
  const isUrgent = room.cleaning_priority && room.cleaning_priority >= 3;

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 rounded-2xl ${
        showSuccess 
          ? 'bg-gradient-to-br from-green-400 to-emerald-500 scale-95'
          : room.status === 'clean' 
          ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-400'
          : room.status === 'in_progress'
          ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-400 shadow-lg shadow-blue-200/50'
          : isUrgent 
          ? 'bg-gradient-to-br from-red-50 to-orange-100 border-2 border-red-400 shadow-lg shadow-red-200/50 animate-pulse'
          : 'bg-gradient-to-br from-slate-50 to-gray-100 border-2 border-slate-300'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: (room.status === 'in_progress' || isActionable) ? `translateX(${swipeOffset}px)` : 'none',
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out, background 0.3s ease'
      }}
    >
      {/* Success animation overlay */}
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-green-500/90">
          <div className="text-white text-center animate-scale-in">
            <CheckCircle className="h-16 w-16 mx-auto mb-2" />
            <p className="text-xl font-bold">Terminé !</p>
          </div>
        </div>
      )}

      {/* Swipe background indicator */}
      {(room.status === 'in_progress' || isActionable) && swipeOffset > 0 && (
        <div 
          className="absolute inset-0 flex items-center justify-start px-6"
          style={{
            background: `linear-gradient(to right, ${
              isCompleting ? 'rgb(34 197 94)' : 'rgb(96 165 250)'
            } ${swipeProgress}%, transparent ${swipeProgress}%)`
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <CheckCircle className={`h-12 w-12 transition-all duration-200 ${
              isCompleting ? 'text-white scale-125' : 'text-white/80 scale-100'
            }`} />
            {isCompleting && (
              <span className="text-sm font-bold text-white animate-pulse">Relâchez !</span>
            )}
          </div>
        </div>
      )}
      
      {/* Card content */}
      <div className="relative p-5" style={{ zIndex: 1 }}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-3xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  {room.room_number}
                </span>
                
                {/* Priority badge */}
                {room.cleaning_priority && room.cleaning_priority > 1 && (
                  <Badge className={`text-sm font-semibold ${
                    room.cleaning_priority === 3 
                      ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg' 
                      : 'bg-gradient-to-r from-amber-400 to-orange-400 text-white'
                  }`}>
                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                    {room.cleaning_priority === 3 ? 'URGENT' : 'Prioritaire'}
                  </Badge>
                )}
                
                {/* Cleaning type badge */}
                {room.cleaning_type && (
                  <Badge 
                    className={`text-sm font-medium ${room.cleaning_type === 'full' 
                      ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white' 
                      : 'bg-gradient-to-r from-sky-400 to-blue-500 text-white'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {room.cleaning_type === 'full' ? 'À blanc' : 'Recouche'}
                  </Badge>
                )}

                {/* Status badge */}
                <Badge 
                  variant="outline" 
                  className={`text-sm font-medium ${
                    room.status === 'clean'
                      ? 'bg-green-100 text-green-700 border-green-400'
                      : room.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700 border-blue-400'
                      : 'bg-slate-100 text-slate-600 border-slate-400'
                  }`}
                >
                  {room.status === 'clean' ? '✓ Terminée' : 
                   room.status === 'in_progress' ? '⏳ En cours' : 'En attente'}
                </Badge>
              </div>
              
              {/* Admin notes */}
              {room.notes && (
                <div className="bg-white/80 rounded-xl p-3 border border-primary/20 shadow-sm">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-primary">📝</span> {room.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Incident button */}
            {room.status !== 'clean' && (
              <IncidentReportDialogSimple 
                hotelId={hotelId} 
                userType="housekeeper"
                defaultLocation={room.room_number}
              />
            )}
          </div>

          {/* Housekeeper notes input */}
          {room.status !== 'clean' && (
            <div className="space-y-2">
              <div className="relative">
                <Textarea
                  placeholder="Ajouter un commentaire pour l'admin..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm resize-none bg-white/90 border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary pr-14 rounded-xl"
                />
                {notes.trim() && (
                  <Button
                    size="sm"
                    onClick={handleSendNote}
                    disabled={isSendingNote}
                    className="absolute bottom-2 right-2 h-9 w-9 p-0 rounded-full bg-primary hover:bg-primary/90 shadow-lg"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isStartable && (
              <>
                <Button 
                  onClick={() => onUpdateStatus(room.id, 'in_progress')}
                  className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-xl shadow-blue-300/50 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play className="h-6 w-6 mr-2 fill-current" />
                  COMMENCER
                </Button>
                <Button 
                  onClick={() => onUnassign(room.id, room.room_number)}
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-xl border-2 border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400"
                >
                  <X className="h-6 w-6" />
                </Button>
              </>
            )}
            {room.status === 'in_progress' && (
              <>
                <Button 
                  onClick={() => onUpdateStatus(room.id, 'clean', notes || undefined)}
                  className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-xl shadow-green-300/50 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CheckCircle className="h-6 w-6 mr-2" />
                  TERMINER
                </Button>
                <Button 
                  onClick={() => onUnassign(room.id, room.room_number)}
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-xl border-2 border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400"
                >
                  <X className="h-6 w-6" />
                </Button>
              </>
            )}
            {room.status === 'clean' && (
              <div className="flex items-center justify-center w-full py-4 bg-green-100/80 rounded-xl">
                <CheckCircle className="h-6 w-6 mr-2 text-green-600" />
                <span className="font-bold text-green-700 text-lg">Chambre terminée</span>
                <Sparkles className="h-5 w-5 ml-2 text-green-500" />
              </div>
            )}
          </div>

          {/* Swipe hints with animation */}
          {room.status === 'in_progress' && (
            <div className="flex items-center justify-center gap-2 pt-2 text-blue-600">
              <div className="flex items-center animate-pulse">
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </div>
              <span className="text-sm font-medium">Glissez pour terminer</span>
            </div>
          )}
          {isActionable && room.status !== 'in_progress' && (
            <div className="flex items-center justify-center gap-2 pt-2 text-slate-500">
              <div className="flex items-center">
                <ChevronRight className="h-4 w-4 animate-pulse" />
                <ChevronRight className="h-4 w-4 -ml-2 animate-pulse delay-75" />
              </div>
              <span className="text-sm">Glissez court = commencer | long = terminer</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
