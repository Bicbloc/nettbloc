/**
 * Page Commander - Génération de commandes de personnel
 * Permet de commander des femmes de chambre avec email automatique
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  ArrowLeft, Calendar, Users, Mail, Copy, Send, 
  FileDown, CheckCircle2, Building, ExternalLink,
  Sparkles, Phone, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useHotel } from "@/contexts/HotelContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export default function Order() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hotelId, hotelName, hotelCode } = useHotel();
  const { t } = useLanguage();

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [recommendedCount, setRecommendedCount] = useState<number>(4);
  const [housekeeperCount, setHousekeeperCount] = useState<number>(4);
  const [supplierEmail, setSupplierEmail] = useState<string>("");
  const [hotelAddress, setHotelAddress] = useState<string>("");
  const [hotelPhone, setHotelPhone] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  // Load hotel data
  useEffect(() => {
    if (hotelId) {
      // Load recommended count based on upcoming rooms
      loadRecommendation();
    }
  }, [hotelId, selectedDate]);

  // Calculate recommendation based on rooms for the selected date
  const loadRecommendation = async () => {
    if (!hotelId) return;

    try {
      // Get rooms count to estimate workload
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select('id, cleaning_type')
        .eq('hotel_id', hotelId);

      if (error) throw error;

      // Calculate recommendation: ~10-12 rooms per housekeeper
      const totalRooms = rooms?.length || 0;
      const recommended = Math.max(1, Math.ceil(totalRooms / 11));
      setRecommendedCount(recommended);
      setHousekeeperCount(recommended);
    } catch (error) {
      console.error('Error loading recommendation:', error);
    }
  };

  // Generate email content
  const emailContent = useMemo(() => {
    const displayHotelName = hotelName || "Notre hôtel";
    const formattedDate = format(selectedDate, "EEEE d MMMM yyyy", { locale: fr });
    
    return `Bonjour,\n\nC'est l'hôtel ${displayHotelName}${hotelAddress ? `, situé au ${hotelAddress}` : ""}.\n\nNous souhaiterions vous commander ${housekeeperCount} femme${housekeeperCount > 1 ? 's' : ''} de chambre pour le ${formattedDate}.\n\nMerci de nous confirmer la disponibilité.\n\nCordialement,\n\n${displayHotelName}\n${hotelAddress ? `📍 ${hotelAddress}` : ""}\n${hotelPhone ? `📞 ${hotelPhone}` : ""}\n\n---\nGéré via NettoBloc\n🔗 https://nettobloc.bicbloc.eu`;
  }, [hotelName, selectedDate, housekeeperCount, hotelAddress, hotelPhone]);

  // Copy email to clipboard
  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailContent);
      setCopied(true);
      toast.success("Email copié dans le presse-papier !");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erreur lors de la copie");
    }
  };

  // Send email via mailto
  const handleOpenMailClient = () => {
    const subject = encodeURIComponent(`Commande personnel - ${format(selectedDate, "d MMMM yyyy", { locale: fr })}`);
    const body = encodeURIComponent(emailContent);
    const mailto = `mailto:${supplierEmail}?subject=${subject}&body=${body}`;
    window.open(mailto, '_blank');
  };

  // Send directly via support@bicbloc.eu (edge function)
  const handleSendDirect = async () => {
    if (!supplierEmail) {
      toast.error("Veuillez renseigner l'email du fournisseur");
      return;
    }

    setSending(true);
    try {
      // For now, open mailto with CC to support
      const subject = encodeURIComponent(`Commande personnel - ${hotelName || 'Hôtel'} - ${format(selectedDate, "d MMMM yyyy", { locale: fr })}`);
      const body = encodeURIComponent(emailContent);
      const mailto = `mailto:${supplierEmail}?cc=support@bicbloc.eu&subject=${subject}&body=${body}`;
      window.open(mailto, '_blank');
      toast.success("Ouverture de votre client email...");
    } catch (error) {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  // Generate PDF for upcoming days
  const handleDownloadPDF = async () => {
    toast.info("Fonctionnalité PDF à venir - Utilisez l'export depuis les rapports pour l'instant");
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Commander du personnel</h1>
              <p className="text-sm text-muted-foreground">
                Générez une demande pour vos prestataires
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Hotel Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Informations de l'hôtel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{hotelName || "Hôtel non sélectionné"}</span>
              {hotelCode && (
                <Badge variant="outline" className="ml-auto">{hotelCode}</Badge>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Adresse
                </Label>
                <Input
                  id="address"
                  placeholder="123 Rue de Paris, 75001 Paris"
                  value={hotelAddress}
                  onChange={(e) => setHotelAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Téléphone
                </Label>
                <Input
                  id="phone"
                  placeholder="01 23 45 67 89"
                  value={hotelPhone}
                  onChange={(e) => setHotelPhone(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Configuration de la commande
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Date de la prestation</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    disabled={(date) => date < new Date()}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Recommendation */}
            <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">Recommandation intelligente</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Basé sur votre registre de {hotelName || "votre hôtel"}, nous recommandons :
              </p>
              <div className="flex items-center gap-3">
                <Badge className="text-lg px-4 py-2 bg-primary">
                  {recommendedCount} femme{recommendedCount > 1 ? 's' : ''} de chambre
                </Badge>
              </div>
            </div>

            {/* Manual Count */}
            <div className="space-y-2">
              <Label htmlFor="count" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Nombre à commander
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setHousekeeperCount(Math.max(1, housekeeperCount - 1))}
                >
                  -
                </Button>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={50}
                  value={housekeeperCount}
                  onChange={(e) => setHousekeeperCount(parseInt(e.target.value) || 1)}
                  className="w-20 text-center text-lg font-bold"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setHousekeeperCount(housekeeperCount + 1)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Supplier Email */}
            <div className="space-y-2">
              <Label htmlFor="supplier-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email du fournisseur
              </Label>
              <Input
                id="supplier-email"
                type="email"
                placeholder="contact@prestataire.com"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Aperçu de l'email
            </CardTitle>
            <CardDescription>
              Ce message sera envoyé à votre prestataire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap border">
              {emailContent}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleCopyEmail}
                className={cn(copied && "bg-green-500/10 border-green-500 text-green-600")}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copier l'email
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleOpenMailClient}
                disabled={!supplierEmail}
              >
                <Mail className="mr-2 h-4 w-4" />
                Ouvrir client email
              </Button>

              <Button
                onClick={handleSendDirect}
                disabled={!supplierEmail || sending}
                className="bg-primary"
              >
                <Send className="mr-2 h-4 w-4" />
                Envoyer via BicBloc
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BicBloc Promotion */}
        <Card className="bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border-primary/30">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Commander chez BicBloc
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Profitez des meilleurs tarifs pour vos prestations de nettoyage
                </p>
                <ul className="text-sm space-y-1 mb-4">
                  <li>✅ Personnel qualifié et vérifié</li>
                  <li>✅ Tarifs compétitifs</li>
                  <li>✅ Intégration automatique avec NettoBloc</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  onClick={() => window.open('https://www.bicbloc.eu', '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Voir les tarifs
                </Button>
                <a 
                  href="mailto:support@bicbloc.eu?subject=Demande de devis personnel" 
                  className="text-xs text-center text-muted-foreground hover:text-primary"
                >
                  support@bicbloc.eu
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Download PDF */}
        <Card>
          <CardContent className="p-4">
            <Button variant="outline" className="w-full" onClick={handleDownloadPDF}>
              <FileDown className="mr-2 h-4 w-4" />
              Télécharger le planning PDF des jours à venir
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
