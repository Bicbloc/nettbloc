/**
 * Page Commander - Génération de commandes de personnel
 * Permet de commander des femmes de chambre avec email automatique
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  ArrowLeft, Calendar, Users, Mail, Copy, Send, 
  FileUp, CheckCircle2, Building, ExternalLink,
  Sparkles, Phone, MapPin, Save, Loader2, FileText,
  MessageCircle, UserPlus, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [recommendedCount, setRecommendedCount] = useState<number>(4);
  const [housekeeperCount, setHousekeeperCount] = useState<number>(4);
  const [supplierEmail, setSupplierEmail] = useState<string>("");
  const [hotelAddress, setHotelAddress] = useState<string>("");
  const [hotelPhone, setHotelPhone] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfAnalysisResult, setPdfAnalysisResult] = useState<{
    totalRooms: number;
    departures: number;
    stayovers: number;
    arrivals: number;
  } | null>(null);

  // Load hotel data from database
  useEffect(() => {
    if (hotelId) {
      loadHotelInfo();
      loadRecommendation();
    }
  }, [hotelId, selectedDate]);

  // Load hotel info (address, phone, supplier email) from database
  const loadHotelInfo = async () => {
    if (!hotelId) return;

    try {
      const { data: hotel, error } = await supabase
        .from('hotels')
        .select('address, phone, supplier_email')
        .eq('id', hotelId)
        .single();

      if (error) throw error;

      if (hotel) {
        setHotelAddress(hotel.address || "");
        setHotelPhone(hotel.phone || "");
        setSupplierEmail(hotel.supplier_email || "");
      }
    } catch (error) {
      console.error('Error loading hotel info:', error);
    }
  };

  // Save hotel info to database
  const saveHotelInfo = async () => {
    if (!hotelId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('hotels')
        .update({
          address: hotelAddress.trim() || null,
          phone: hotelPhone.trim() || null,
          supplier_email: supplierEmail.trim() || null,
        })
        .eq('id', hotelId);

      if (error) throw error;

      toast.success("Informations enregistrées !");
    } catch (error) {
      console.error('Error saving hotel info:', error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

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

  // Handle PDF upload and analysis using local parsing
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf')) {
      toast.error("Veuillez sélectionner un fichier PDF");
      return;
    }

    setLoadingPdf(true);
    setPdfAnalysisResult(null);

    try {
      // Import pdfjs-dist for text extraction
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      // Read file as ArrayBuffer for pdfjs
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Extract text from all pages
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      if (!fullText.trim()) {
        toast.error("Aucun texte trouvé dans le PDF");
        setLoadingPdf(false);
        return;
      }

      // Load training examples for this hotel
      const { loadTrainingExamples } = await import('@/services/trainingExamplesService');
      const trainingExamples = hotelId ? await loadTrainingExamples(hotelId) : [];

      // Call the parse-report edge function with extracted text + training
      const { data, error } = await supabase.functions.invoke('parse-report', {
        body: {
          text: fullText,
          hotelId,
          reportDate: format(selectedDate, 'yyyy-MM-dd'),
          trainingExamples: trainingExamples.length > 0 ? trainingExamples : undefined,
        },
      });

      if (error) {
        console.error('Error parsing PDF:', error);
        toast.error("Erreur lors de l'analyse du PDF");
        setLoadingPdf(false);
        return;
      }

      // Count room types from parsed data
      const rooms = data?.rooms || [];
      const departures = rooms.filter((r: any) => 
        r.cleaningType === 'a_blanc' || 
        r.cleaning_type === 'a_blanc'
      ).length;
      const stayovers = rooms.filter((r: any) => 
        r.cleaningType === 'recouche' || 
        r.cleaning_type === 'recouche'
      ).length;
      const arrivals = rooms.filter((r: any) => 
        r.arrivalDate || r.arrival_date
      ).length;

      const totalRooms = rooms.length;
      
      // Calculate recommendation: departures are heavier (1.5x), stayovers normal
      const weightedRooms = departures * 1.5 + stayovers + (totalRooms - departures - stayovers);
      const recommended = Math.max(1, Math.ceil(weightedRooms / 11));

      setPdfAnalysisResult({
        totalRooms,
        departures,
        stayovers,
        arrivals,
      });

      setRecommendedCount(recommended);
      setHousekeeperCount(recommended);

      toast.success(`PDF analysé : ${totalRooms} chambres détectées`);
    } catch (error) {
      console.error('Error handling PDF:', error);
      toast.error("Erreur lors de l'analyse du PDF");
    } finally {
      setLoadingPdf(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Generate email content
  const emailContent = useMemo(() => {
    const displayHotelName = hotelName || "Notre hôtel";
    const formattedDate = format(selectedDate, "EEEE d MMMM yyyy", { locale: fr });
    
    let roomDetails = "";
    if (pdfAnalysisResult) {
      roomDetails = `\n\nDétail des chambres :\n- ${pdfAnalysisResult.departures} départs (à blanc)\n- ${pdfAnalysisResult.stayovers} recouches\n- Total : ${pdfAnalysisResult.totalRooms} chambres`;
    }
    
    return `Bonjour,\n\nC'est l'hôtel ${displayHotelName}${hotelAddress ? `, situé au ${hotelAddress}` : ""}.\n\nNous souhaiterions vous commander ${housekeeperCount} femme${housekeeperCount > 1 ? 's' : ''} de chambre pour le ${formattedDate}.${roomDetails}\n\nMerci de nous confirmer la disponibilité.\n\nCordialement,\n\n${displayHotelName}\n${hotelAddress ? `📍 ${hotelAddress}` : ""}\n${hotelPhone ? `📞 ${hotelPhone}` : ""}\n\n---\nGéré via NettoBloc\n🔗 https://nettobloc.bicbloc.eu`;
  }, [hotelName, selectedDate, housekeeperCount, hotelAddress, hotelPhone, pdfAnalysisResult]);

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

  // Send directly via NettoBloc edge function
  const handleSendViaBicBloc = async () => {
    if (!supplierEmail) {
      toast.error("Veuillez renseigner l'email du fournisseur");
      return;
    }

    setSending(true);
    try {
      const subject = `Commande personnel - ${hotelName || 'Hôtel'} - ${format(selectedDate, "d MMMM yyyy", { locale: fr })}`;
      
      const { data: hotel } = await supabase
        .from('hotels')
        .select('email')
        .eq('id', hotelId)
        .single();
      
      const { data, error } = await supabase.functions.invoke('send-order-email', {
        body: {
          supplierEmail,
          subject,
          body: emailContent,
          hotelName: hotelName || 'Hôtel',
          hotelEmail: hotel?.email
        }
      });

      if (error) throw error;

      toast.success("✅ Email envoyé avec succès !");
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error("Erreur lors de l'envoi. Utilisez le client email.");
    } finally {
      setSending(false);
    }
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
                Analysez votre PDF et générez une demande
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* PDF Analysis Card - First */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Analyse du rapport PMS
            </CardTitle>
            <CardDescription>
              Importez le PDF du jour pour calculer automatiquement le nombre de femmes de chambre
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              ref={fileInputRef}
              className="hidden"
            />
            
            <Button
              variant="outline"
              className="w-full h-20 border-dashed border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingPdf}
            >
              {loadingPdf ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Analyse en cours...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileUp className="h-8 w-8 text-primary" />
                  <span>Cliquez pour importer votre rapport PDF</span>
                </div>
              )}
            </Button>

            {pdfAnalysisResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card rounded-lg p-3 text-center border">
                  <div className="text-2xl font-bold text-primary">
                    {pdfAnalysisResult.totalRooms}
                  </div>
                  <div className="text-xs text-muted-foreground">Total chambres</div>
                </div>
                <div className="bg-card rounded-lg p-3 text-center border">
                  <div className="text-2xl font-bold text-orange-500">
                    {pdfAnalysisResult.departures}
                  </div>
                  <div className="text-xs text-muted-foreground">Départs (blanc)</div>
                </div>
                <div className="bg-card rounded-lg p-3 text-center border">
                  <div className="text-2xl font-bold text-blue-500">
                    {pdfAnalysisResult.stayovers}
                  </div>
                  <div className="text-xs text-muted-foreground">Recouches</div>
                </div>
                <div className="bg-card rounded-lg p-3 text-center border">
                  <div className="text-2xl font-bold text-green-500">
                    {pdfAnalysisResult.arrivals}
                  </div>
                  <div className="text-xs text-muted-foreground">Arrivées</div>
                </div>
              </div>
            )}

            {/* Recommendation based on PDF */}
            <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">Recommandation</span>
                {pdfAnalysisResult && (
                  <Badge variant="secondary" className="ml-auto">Basé sur le PDF</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge className="text-lg px-4 py-2 bg-primary">
                  {recommendedCount} femme{recommendedCount > 1 ? 's' : ''} de chambre
                </Badge>
                {!pdfAnalysisResult && (
                  <span className="text-sm text-muted-foreground">
                    (estimation basée sur {hotelName || "votre hôtel"})
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hotel Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Informations de l'hôtel
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={saveHotelInfo}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Enregistrer
              </Button>
            </div>
            <CardDescription>
              Ces informations seront pré-remplies pour vos prochaines commandes
            </CardDescription>
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

            <div className="space-y-2">
              <Label htmlFor="supplier-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email du fournisseur (enregistré)
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
                onClick={handleSendViaBicBloc}
                disabled={!supplierEmail || sending}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Envoyer via BicBloc
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BicBloc Ordering Options */}
        <Card className="bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border-primary/30">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Commander chez BicBloc
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Profitez des meilleurs tarifs pour vos prestations de nettoyage
                </p>
              </div>
              
              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* See Rates */}
                <Button 
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1"
                  onClick={() => window.open('https://bicbloc.eu/simulateur/', '_blank')}
                >
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Voir les tarifs</span>
                  <span className="text-xs text-muted-foreground">Simulateur en ligne</span>
                </Button>

                {/* Create Account */}
                <Button 
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1"
                  onClick={() => window.open('https://bicbloc.eu', '_blank')}
                >
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Créer un compte</span>
                  <span className="text-xs text-muted-foreground">bicbloc.eu</span>
                </Button>
              </div>

              <Separator />
              
              {/* Already have account section */}
              <div>
                <p className="text-sm font-medium mb-3 text-muted-foreground">
                  J'ai déjà un compte, je commande via :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* WhatsApp */}
                  <Button 
                    className="h-auto py-3 flex items-center gap-3 bg-green-600 hover:bg-green-700"
                    onClick={() => window.open('https://wa.me/message/6NVCFWNZRB75K1', '_blank')}
                  >
                    <MessageCircle className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-medium">WhatsApp</div>
                      <div className="text-xs opacity-90">Réponse rapide</div>
                    </div>
                  </Button>

                  {/* Ubeya */}
                  <Button 
                    variant="outline"
                    className="h-auto py-3 flex items-center gap-3"
                    onClick={() => window.open('https://auth.ubeya.com/login/admin', '_blank')}
                  >
                    <ExternalLink className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Ubeya</div>
                      <div className="text-xs text-muted-foreground">Plateforme de gestion</div>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Contact */}
              <div className="text-center pt-2">
                <a 
                  href="mailto:support@bicbloc.eu?subject=Demande de devis personnel" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  📧 support@bicbloc.eu
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
