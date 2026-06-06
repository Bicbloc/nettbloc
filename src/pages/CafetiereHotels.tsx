import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, LogOut, Loader2, CheckCircle2, Coffee } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { storageService } from '@/services/storageService';
import { UserTypeGuard } from '@/hooks/use-user-type-guard';

function CafetiereHotelsContent() {
  const [profile, setProfile] = useState<any>(null);
  const [hotels, setHotels] = useState<any[]>([]);
  const [hotelCode, setHotelCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingHotel, setIsAddingHotel] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/cafetiere/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('cafetiere_profiles')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      if (profileError || !profileData) {
        toast({ variant: 'destructive', title: 'Profil non trouvé', description: 'Veuillez créer un compte' });
        navigate('/cafetiere/signup');
        return;
      }

      setProfile(profileData);

      const { data: approvedHotels } = await supabase
        .rpc('get_approved_hotels_for_cafetiere' as any, { p_cafetiere_profile_id: profileData.id });

      const hotelsArray = approvedHotels as Array<{ hotel_id: string; hotel_name: string; hotel_code: string; approved_at: string }> | null;

      if (hotelsArray && hotelsArray.length > 0) {
        setHotels(hotelsArray.map((h) => ({
          id: h.hotel_id,
          name: h.hotel_name,
          hotel_code: h.hotel_code,
          approved_at: h.approved_at,
        })));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHotel = async () => {
    if (!hotelCode.trim()) {
      toast({ variant: 'destructive', title: 'Code requis', description: "Veuillez entrer un code d'établissement" });
      return;
    }
    setIsAddingHotel(true);
    try {
      const { data: hotelData, error: hotelError } = await supabase
        .rpc('search_hotel_by_code', { p_code: hotelCode.trim() })
        .maybeSingle();

      if (hotelError) throw new Error("Erreur lors de la recherche de l'établissement");
      if (!hotelData) throw new Error("Code d'établissement introuvable. Vérifiez le code auprès de votre responsable.");

      const { data: existingRequest } = await supabase
        .from('cafetiere_access_requests')
        .select('id, status')
        .eq('cafetiere_profile_id', profile.id)
        .eq('hotel_id', hotelData.id)
        .maybeSingle();

      if (existingRequest?.status === 'pending') throw new Error("Une demande d'accès est déjà en attente pour cet établissement");
      if (existingRequest?.status === 'approved') throw new Error('Vous êtes déjà approuvé pour cet établissement');

      const { error: requestError } = await supabase
        .from('cafetiere_access_requests')
        .insert({
          cafetiere_profile_id: profile.id,
          hotel_id: hotelData.id,
          hotel_code: hotelCode.trim().toUpperCase(),
          status: 'pending',
          requested_at: new Date().toISOString(),
        });

      if (requestError) throw requestError;

      toast({ title: 'Demande envoyée ! 📤', description: `Votre demande pour ${hotelData.name} est en attente d'approbation` });
      setHotelCode('');
      setShowAddDialog(false);
      checkUser();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message || "Code d'établissement invalide" });
    } finally {
      setIsAddingHotel(false);
    }
  };

  const handleSelectHotel = (hotel: any) => {
    storageService.saveHotel({ id: hotel.id, name: hotel.name, code: hotel.hotel_code });
    localStorage.setItem('lastSelectedHotelId', hotel.id);
    toast({ title: 'Établissement sélectionné ! 🏨', description: `Vous travaillez maintenant pour ${hotel.name}` });
    navigate(`/cafetiere/work?hotel=${hotel.id}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    storageService.clearHotel();
    navigate('/cafetiere/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-3 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="bg-amber-100 p-3 rounded-full flex-shrink-0"><Coffee className="h-6 w-6 text-amber-600" /></div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate">{profile?.name}</CardTitle>
                  <CardDescription className="truncate">{profile?.email}</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="w-full sm:w-auto">
                <LogOut className="h-4 w-4 mr-2" />Déconnexion
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><Building2 className="h-5 w-5" />Mes établissements</CardTitle>
                <CardDescription className="text-sm">Sélectionnez un établissement pour déclarer les petits-déjeuners</CardDescription>
              </div>
              <Button onClick={() => setShowAddDialog(true)} size="sm" className="w-full sm:w-auto bg-amber-700 hover:bg-amber-800">
                <Plus className="h-4 w-4 mr-2" />Ajouter un établissement
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {hotels.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Building2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-base sm:text-lg mb-2">Aucun établissement enregistré</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 px-4">
                  Ajoutez votre premier établissement avec le code fourni par votre responsable
                </p>
                <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto bg-amber-700 hover:bg-amber-800">
                  <Plus className="h-4 w-4 mr-2" />Ajouter un établissement
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 sm:gap-3">
                {hotels.map((hotel: any) => (
                  <button
                    key={hotel.id}
                    onClick={() => handleSelectHotel(hotel)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-2 rounded-lg hover:bg-accent transition-all text-left gap-3 border-border"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="p-2 rounded flex-shrink-0 bg-amber-100 dark:bg-amber-900">
                        <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{hotel.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">Code: {hotel.hotel_code}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un établissement</DialogTitle>
            <DialogDescription>Entrez le code d'établissement fourni par votre responsable</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hotelCode">Code d'établissement</Label>
              <Input id="hotelCode" value={hotelCode} onChange={(e) => setHotelCode(e.target.value.toUpperCase())} placeholder="Ex: HOTEL123" className="uppercase" />
            </div>
            <Button onClick={handleAddHotel} disabled={isAddingHotel || !hotelCode.trim()} className="w-full bg-amber-700 hover:bg-amber-800">
              {isAddingHotel ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi en cours...</>) : (<><Plus className="h-4 w-4 mr-2" />Demander l'accès</>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CafetiereHotels() {
  return (
    <UserTypeGuard expectedType="cafetiere">
      <CafetiereHotelsContent />
    </UserTypeGuard>
  );
}
