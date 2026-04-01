import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  BedDouble, Users, AlertTriangle, Shield, Wrench, ClipboardList,
  Sparkles, Zap, Globe, ArrowRight, CheckCircle, Brain, Eye,
  LayoutDashboard, Package, Mail, ChevronDown, Star, Clock,
  Smartphone, MousePointerClick, Bot, Search, ShieldCheck, Brush,
  Settings, Award, MessageSquareQuote, Building2, Hotel, Crown, Download
} from 'lucide-react';

const t = {
  fr: {
    nav: { features: 'Fonctionnalités', portals: 'Portails', pricing: 'Tarifs', ai: 'Intelligence IA', contact: 'Contact', login: 'Se connecter', tryFree: 'Essayer gratuitement' },
    hero: {
      badge: 'Propulsé par l\'Intelligence Artificielle',
      title1: 'La révolution',
      title2: 'de l\'hôtellerie',
      title3: 'est arrivée.',
      subtitle: 'Nettobloc est le premier outil intelligent jamais conçu pour la gestion complète du housekeeping hôtelier. Simple. Rapide. Révolutionnaire.',
      cta: 'Commencer gratuitement',
      ctaSecondary: 'Découvrir les fonctionnalités',
      ctaDownload: 'Télécharger l\'application Android',
      stats: [
        { value: '10x', label: 'Plus rapide' },
        { value: '1 clic', label: 'Répartition' },
        { value: '24/7', label: 'Suivi temps réel' },
        { value: 'IA', label: 'Reconnaissance visuelle' },
      ]
    },
    features: {
      title: 'Tout ce dont vous avez besoin',
      subtitle: 'Une suite complète d\'outils pensés pour simplifier votre quotidien.',
      items: [
        { icon: 'bed', title: 'Gestion des chambres', desc: 'Suivez l\'état de chaque chambre en temps réel : check-out, recouche, propre, en cours. Importez vos listes PMS automatiquement.' },
        { icon: 'users', title: 'Répartition en 1 clic', desc: 'Distribuez les chambres aux femmes de chambre présentes en un seul clic. L\'algorithme intelligent équilibre la charge de travail.' },
        { icon: 'brush', title: 'Gestion de la propreté', desc: 'Suivi complet du nettoyage chambre par chambre, validation gouvernante, contrôle des standards de propreté en temps réel.' },
        { icon: 'wrench', title: 'Gestion de la maintenance', desc: 'Signalez, assignez et suivez chaque intervention technique. Historique complet, priorités et statuts pour une maintenance sans faille.' },
        { icon: 'search', title: 'Gestion des objets perdus', desc: 'Module dédié aux objets trouvés : description, photo, localisation, suivi de restitution au client. Ne perdez plus rien.' },
        { icon: 'shieldCheck', title: 'Contrôle qualité', desc: 'Inspections gouvernante, checklist de conformité, rapports d\'audit et scoring qualité pour garantir l\'excellence de service.' },
        { icon: 'brain', title: 'Recommandation IA', desc: 'Nettobloc recommande le nombre optimal de femmes de chambre nécessaires selon le volume et le type de nettoyage.' },
        { icon: 'alert', title: 'Suivi des incidents', desc: 'Signalez et suivez chaque incident avec photos, priorité et assignation. Historique complet pour chaque chambre.' },
        { icon: 'eye', title: 'Reconnaissance IA', desc: 'Identifiez automatiquement les incidents et objets trouvés grâce à l\'intelligence artificielle visuelle intégrée.' },
      ]
    },
    portals: {
      title: 'Un portail pour chaque rôle',
      subtitle: 'Chaque membre de votre équipe accède à son interface dédiée, optimisée pour son métier.',
      items: [
        { icon: 'layout', title: 'Portail Administrateur', desc: 'Vue complète de l\'établissement, rapports, statistiques, gestion des équipes et configuration avancée.', color: 'primary' },
        { icon: 'shield', title: 'Portail Gouvernante', desc: 'Inspection des chambres, suivi du personnel, validation du nettoyage et contrôle qualité en temps réel.', color: 'accent' },
        { icon: 'clipboard', title: 'Portail Femme de chambre / Équipier', desc: 'Liste des chambres assignées, marquage du nettoyage, signalement d\'incidents depuis le mobile.', color: 'success' },
        { icon: 'wrench', title: 'Portail Technicien', desc: 'Interventions assignées, suivi des réparations, historique des incidents techniques par espace.', color: 'warning' },
      ]
    },
    ai: {
      title: 'L\'IA au service de votre hôtel',
      subtitle: 'Des fonctionnalités intelligentes qui changent la donne.',
      items: [
        { title: 'Reconnaissance d\'incidents', desc: 'Prenez une photo, l\'IA identifie automatiquement le problème et pré-remplit le rapport.' },
        { title: 'Identification d\'objets trouvés', desc: 'Photographiez un objet trouvé, l\'IA le catégorise et génère la description.' },
        { title: 'Comptage intelligent du linge', desc: 'Scannez vos piles de linge, l\'IA compte automatiquement chaque pièce par type.' },
        { title: 'Répartition optimisée', desc: 'L\'algorithme analyse la charge et recommande la meilleure distribution des chambres.' },
      ]
    },
    pricing: {
      title: 'Des tarifs adaptés à votre établissement',
      subtitle: 'Choisissez le plan qui correspond à la taille et aux besoins de votre hôtel.',
      perMonth: 'HT / mois',
      rooms: 'chambres',
      unlimited: 'Chambres illimitées',
      popular: 'Populaire',
      enterprise: 'Sur mesure',
      startFree: 'Continuer gratuit',
      contact: 'Nous contacter',
      choose: 'Choisir',
      featuresLabel: 'Fonctionnalités incluses',
      threeMonthsFree: '3 mois offerts',
      euNote: 'Paiement par GoCardless. UE : HT + TVA 20%. Hors UE : HT uniquement.',
      features: {
        pdfAnalysis: 'Analyse PDF automatique',
        distribution: 'Distribution automatique',
        reports: 'Téléchargement rapports',
        rooms: 'Jusqu\'à {n} chambres',
        roomsUnlimited: 'Chambres illimitées',
        housekeeperPortal: 'Portail femme de chambre',
        governessPortal: 'Portail gouvernante',
        incidents: 'Gestion incidents',
        pmsImport: 'Import PMS automatique',
        maintenance: 'Gestion maintenance',
        lostFound: 'Objets perdus',
        qualityControl: 'Contrôle qualité',
        linen: 'Inventaire linge',
        inspection: 'Inspection chambres',
        aiRecognition: 'Reconnaissance IA',
        aiRecommendation: 'Recommandation IA',
        technicianPortal: 'Portail technicien',
        multiHotel: 'Multi-établissements',
        apiAccess: 'Accès API',
        prioritySupport: 'Support prioritaire',
      },
      planSubtitles: {
        decouverte: 'Pour tester la plateforme',
        essentiel: 'Petits établissements',
        confort: 'Établissements moyens',
        business: 'Grands établissements',
        entreprise: 'Groupes & chaînes hôtelières',
      },
    },
    testimonials: {
      title: 'Ils nous font confiance',
      subtitle: 'Découvrez pourquoi les meilleurs établissements choisissent Nettobloc.',
      items: [
        {
          quote: 'Nettobloc a transformé notre gestion quotidienne. La répartition en 1 clic nous fait gagner 45 minutes chaque matin. L\'IA de reconnaissance des incidents est bluffante.',
          name: 'Sophie Laurent',
          role: 'Directrice Housekeeping',
          hotel: 'Grand Hôtel du Palais ★★★★',
          icon: 'hotel4',
        },
        {
          quote: 'La qualité de service est notre obsession. Le module de contrôle qualité et le portail gouvernante nous permettent de maintenir nos standards 5 étoiles sans effort supplémentaire.',
          name: 'Jean-Marc Dubois',
          role: 'Directeur Général',
          hotel: 'Le Majestic Resort & Spa ★★★★★',
          icon: 'hotel5',
        },
        {
          quote: 'Déployé sur nos 12 établissements en 2 semaines. La synchronisation temps réel et les rapports consolidés sont exactement ce qu\'il nous manquait pour piloter le groupe.',
          name: 'Caroline Mercier',
          role: 'VP Opérations',
          hotel: 'Groupe Hôtelier Prestige Collection',
          icon: 'group',
        },
      ]
    },
    cta: {
      title: 'Prêt à révolutionner votre hôtel ?',
      subtitle: 'Rejoignez les établissements qui ont choisi l\'efficacité.',
      button: 'Démarrer maintenant',
    },
    footer: {
      tagline: 'L\'outil intelligent pour l\'hôtellerie moderne.',
      contact: 'Contact',
      legal: 'Mentions légales',
      privacy: 'Politique de confidentialité',
      rights: '© 2025 Nettobloc. Tous droits réservés.',
    }
  },
  en: {
    nav: { features: 'Features', portals: 'Portals', pricing: 'Pricing', ai: 'AI Intelligence', contact: 'Contact', login: 'Log in', tryFree: 'Try for free' },
    hero: {
      badge: 'Powered by Artificial Intelligence',
      title1: 'The hospitality',
      title2: 'revolution',
      title3: 'has arrived.',
      subtitle: 'Nettobloc is the first intelligent tool ever designed for complete hotel housekeeping management. Simple. Fast. Revolutionary.',
      cta: 'Get started for free',
      ctaSecondary: 'Discover features',
      stats: [
        { value: '10x', label: 'Faster' },
        { value: '1 click', label: 'Distribution' },
        { value: '24/7', label: 'Real-time tracking' },
        { value: 'AI', label: 'Visual recognition' },
      ]
    },
    features: {
      title: 'Everything you need',
      subtitle: 'A complete suite of tools designed to simplify your daily operations.',
      items: [
        { icon: 'bed', title: 'Room Management', desc: 'Track every room status in real-time: check-out, stayover, clean, in progress. Import your PMS lists automatically.' },
        { icon: 'users', title: '1-Click Distribution', desc: 'Distribute rooms to available housekeepers in a single click. The smart algorithm balances workload evenly.' },
        { icon: 'brush', title: 'Cleanliness Management', desc: 'Complete room-by-room cleaning tracking, governess validation, real-time cleanliness standards monitoring.' },
        { icon: 'wrench', title: 'Maintenance Management', desc: 'Report, assign and track every technical intervention. Full history, priorities and statuses for seamless maintenance.' },
        { icon: 'search', title: 'Lost & Found Management', desc: 'Dedicated module for found items: description, photo, location, return tracking to guests. Never lose anything again.' },
        { icon: 'shieldCheck', title: 'Quality Control', desc: 'Governess inspections, compliance checklists, audit reports and quality scoring to guarantee service excellence.' },
        { icon: 'brain', title: 'AI Recommendation', desc: 'Nettobloc recommends the optimal number of housekeepers needed based on volume and cleaning type.' },
        { icon: 'alert', title: 'Incident Tracking', desc: 'Report and track every incident with photos, priority and assignment. Complete history for each room.' },
        { icon: 'eye', title: 'AI Recognition', desc: 'Automatically identify incidents and found objects thanks to built-in visual artificial intelligence.' },
      ]
    },
    portals: {
      title: 'A portal for every role',
      subtitle: 'Each team member accesses their dedicated interface, optimized for their job.',
      items: [
        { icon: 'layout', title: 'Admin Portal', desc: 'Complete property overview, reports, statistics, team management and advanced configuration.', color: 'primary' },
        { icon: 'shield', title: 'Governess Portal', desc: 'Room inspection, staff tracking, cleaning validation and real-time quality control.', color: 'accent' },
        { icon: 'clipboard', title: 'Housekeeper Portal', desc: 'Assigned room list, cleaning status updates, incident reporting from mobile.', color: 'success' },
        { icon: 'wrench', title: 'Technician Portal', desc: 'Assigned interventions, repair tracking, technical incident history by space.', color: 'warning' },
      ]
    },
    ai: {
      title: 'AI at the service of your hotel',
      subtitle: 'Intelligent features that change the game.',
      items: [
        { title: 'Incident Recognition', desc: 'Take a photo, the AI automatically identifies the problem and pre-fills the report.' },
        { title: 'Found Item Identification', desc: 'Photograph a found item, the AI categorizes it and generates the description.' },
        { title: 'Smart Linen Counting', desc: 'Scan your linen piles, the AI automatically counts each piece by type.' },
        { title: 'Optimized Distribution', desc: 'The algorithm analyzes workload and recommends the best room distribution.' },
      ]
    },
    pricing: {
      title: 'Pricing tailored to your property',
      subtitle: 'Choose the plan that matches your hotel\'s size and needs.',
      perMonth: 'excl. tax / month',
      rooms: 'rooms',
      unlimited: 'Unlimited rooms',
      popular: 'Popular',
      enterprise: 'Custom',
      startFree: 'Continue free',
      contact: 'Contact us',
      choose: 'Choose',
      featuresLabel: 'Included features',
      threeMonthsFree: '3 months free',
      euNote: 'Payment via GoCardless. EU: excl. tax + 20% VAT. Non-EU: excl. tax only.',
      features: {
        pdfAnalysis: 'Automatic PDF analysis',
        distribution: 'Automatic distribution',
        reports: 'Report downloads',
        rooms: 'Up to {n} rooms',
        roomsUnlimited: 'Unlimited rooms',
        housekeeperPortal: 'Housekeeper portal',
        governessPortal: 'Governess portal',
        incidents: 'Incident management',
        pmsImport: 'Automatic PMS import',
        maintenance: 'Maintenance management',
        lostFound: 'Lost & Found',
        qualityControl: 'Quality control',
        linen: 'Linen inventory',
        inspection: 'Room inspection',
        aiRecognition: 'AI recognition',
        aiRecommendation: 'AI recommendation',
        technicianPortal: 'Technician portal',
        multiHotel: 'Multi-property',
        apiAccess: 'API access',
        prioritySupport: 'Priority support',
      },
      planSubtitles: {
        decouverte: 'To test the platform',
        essentiel: 'Small properties',
        confort: 'Medium properties',
        business: 'Large properties',
        entreprise: 'Groups & hotel chains',
      },
    },
    testimonials: {
      title: 'Trusted by the best',
      subtitle: 'Discover why leading properties choose Nettobloc.',
      items: [
        {
          quote: 'Nettobloc transformed our daily management. 1-click distribution saves us 45 minutes every morning. The AI incident recognition is stunning.',
          name: 'Sophie Laurent',
          role: 'Housekeeping Director',
          hotel: 'Grand Hôtel du Palais ★★★★',
          icon: 'hotel4',
        },
        {
          quote: 'Service quality is our obsession. The quality control module and governess portal help us maintain our 5-star standards effortlessly.',
          name: 'Jean-Marc Dubois',
          role: 'General Manager',
          hotel: 'Le Majestic Resort & Spa ★★★★★',
          icon: 'hotel5',
        },
        {
          quote: 'Deployed across our 12 properties in 2 weeks. Real-time sync and consolidated reports are exactly what we needed to manage the group.',
          name: 'Caroline Mercier',
          role: 'VP Operations',
          hotel: 'Prestige Collection Hotel Group',
          icon: 'group',
        },
      ]
    },
    cta: {
      title: 'Ready to revolutionize your hotel?',
      subtitle: 'Join the properties that chose efficiency.',
      button: 'Start now',
    },
    footer: {
      tagline: 'The intelligent tool for modern hospitality.',
      contact: 'Contact',
      legal: 'Legal notices',
      privacy: 'Privacy policy',
      rights: '© 2025 Nettobloc. All rights reserved.',
    }
  }
};

const featureIcons: Record<string, React.ReactNode> = {
  bed: <BedDouble className="w-7 h-7" />,
  users: <Users className="w-7 h-7" />,
  brain: <Brain className="w-7 h-7" />,
  alert: <AlertTriangle className="w-7 h-7" />,
  search: <Search className="w-7 h-7" />,
  eye: <Eye className="w-7 h-7" />,
  brush: <Brush className="w-7 h-7" />,
  wrench: <Wrench className="w-7 h-7" />,
  shieldCheck: <ShieldCheck className="w-7 h-7" />,
};

const portalIcons: Record<string, React.ReactNode> = {
  layout: <LayoutDashboard className="w-8 h-8" />,
  shield: <Shield className="w-8 h-8" />,
  clipboard: <ClipboardList className="w-8 h-8" />,
  wrench: <Wrench className="w-8 h-8" />,
};

const portalColors: Record<string, string> = {
  primary: 'from-primary/20 to-primary/5 border-primary/30',
  accent: 'from-accent to-accent/30 border-accent-foreground/20',
  success: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30',
  warning: 'from-amber-500/15 to-amber-500/5 border-amber-500/30',
};

const portalIconColors: Record<string, string> = {
  primary: 'text-primary',
  accent: 'text-accent-foreground',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
};

const testimonialIcons: Record<string, React.ReactNode> = {
  hotel4: <Hotel className="w-6 h-6" />,
  hotel5: <Crown className="w-6 h-6" />,
  group: <Building2 className="w-6 h-6" />,
};

interface PricingPlan {
  plan_name: string;
  price_monthly: number;
  max_rooms: number | null;
  is_active: boolean;
}

const planDisplayNames: Record<string, Record<string, string>> = {
  fr: {
    decouverte: 'Découverte',
    essentiel: 'Essentiel',
    confort: 'Confort',
    business: 'Business',
    entreprise: 'Entreprise',
    manual_entry: 'Saisie Manuelle',
  },
  en: {
    decouverte: 'Discovery',
    essentiel: 'Essential',
    confort: 'Comfort',
    business: 'Business',
    entreprise: 'Enterprise',
    manual_entry: 'Manual Entry',
  }
};

const Landing = () => {
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const navigate = useNavigate();
  const c = t[lang];

  useEffect(() => {
    supabase
      .from('pricing_config')
      .select('plan_name, price_monthly, max_rooms, is_active')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true })
      .then(({ data }) => {
        if (data) setPlans(data as PricingPlan[]);
      });
  }, []);

  const popularPlan = 'confort';

  // Feature availability per plan tier
  const planFeatures: Record<string, string[]> = {
    decouverte: ['pdfAnalysis', 'distribution', 'reports', 'rooms', 'housekeeperPortal'],
    manual_entry: ['pdfAnalysis', 'distribution', 'reports', 'rooms', 'housekeeperPortal'],
    essentiel: ['pdfAnalysis', 'distribution', 'reports', 'rooms', 'housekeeperPortal', 'governessPortal', 'incidents', 'pmsImport'],
    confort: ['pdfAnalysis', 'distribution', 'reports', 'rooms', 'housekeeperPortal', 'governessPortal', 'incidents', 'pmsImport', 'maintenance', 'lostFound', 'qualityControl', 'linen', 'inspection'],
    business: ['pdfAnalysis', 'distribution', 'reports', 'rooms', 'housekeeperPortal', 'governessPortal', 'incidents', 'pmsImport', 'maintenance', 'lostFound', 'qualityControl', 'linen', 'inspection', 'aiRecognition', 'aiRecommendation', 'technicianPortal'],
    entreprise: ['pdfAnalysis', 'distribution', 'reports', 'rooms', 'housekeeperPortal', 'governessPortal', 'incidents', 'pmsImport', 'maintenance', 'lostFound', 'qualityControl', 'linen', 'inspection', 'aiRecognition', 'aiRecommendation', 'technicianPortal', 'multiHotel', 'apiAccess', 'prioritySupport'],
  };

  const allFeatureKeys = ['pdfAnalysis', 'distribution', 'reports', 'rooms', 'housekeeperPortal', 'governessPortal', 'incidents', 'pmsImport', 'maintenance', 'lostFound', 'qualityControl', 'linen', 'inspection', 'aiRecognition', 'aiRecommendation', 'technicianPortal', 'multiHotel', 'apiAccess', 'prioritySupport'] as const;

  const planIcons: Record<string, React.ReactNode> = {
    decouverte: <Zap className="w-8 h-8 text-muted-foreground" />,
    essentiel: <ClipboardList className="w-8 h-8 text-muted-foreground" />,
    confort: <Star className="w-8 h-8 text-muted-foreground" />,
    business: <Award className="w-8 h-8 text-muted-foreground" />,
    entreprise: <Crown className="w-8 h-8 text-primary" />,
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Nettobloc</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{c.nav.features}</a>
            <a href="#portals" className="hover:text-foreground transition-colors">{c.nav.portals}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{c.nav.pricing}</a>
            <a href="#ai" className="hover:text-foreground transition-colors">{c.nav.ai}</a>
            <a href="#contact" className="hover:text-foreground transition-colors">{c.nav.contact}</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="gap-1.5">
              <Globe className="w-4 h-4" />
              {lang === 'fr' ? 'EN' : 'FR'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>{c.nav.login}</Button>
            <Button size="sm" onClick={() => navigate('/auth')} className="bg-primary hover:bg-primary/90 text-primary-foreground">{c.nav.tryFree}</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium gap-2 bg-primary/10 text-primary border-primary/20">
            <Bot className="w-4 h-4" />
            {c.hero.badge}
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            {c.hero.title1}{' '}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">{c.hero.title2}</span>
            <br />{c.hero.title3}
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">{c.hero.subtitle}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" onClick={() => navigate('/auth')} className="text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 gap-2">
              {c.hero.cta}<ArrowRight className="w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-base px-8 py-6 gap-2">
              {c.hero.ctaSecondary}<ChevronDown className="w-5 h-5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {c.hero.stats.map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-2xl bg-card border border-border/50 shadow-sm">
                <div className="text-2xl md:text-3xl font-extrabold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{c.features.title}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{c.features.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {c.features.items.map((item, i) => (
              <Card key={i} className="border border-border/60 bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    {featureIcons[item.icon]}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PMS Compatibility */}
      <section className="py-12 md:py-16 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              {lang === 'fr' ? 'Compatible avec tous les PMS' : 'Compatible with all PMS'}
            </h2>
            <p className="text-muted-foreground">
              {lang === 'fr' ? 'Importez vos rapports depuis n\'importe quel logiciel hôtelier' : 'Import your reports from any hotel software'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
            {['Mews', 'Opera', 'Opera Cloud', 'Medialog', 'Misterbooking', 'Jazz Hotel', 'Hotel Easy', 'Protel', 'Apaleo', 'FOLS', 'HotSoft', 'Clock PMS', 'RMS', 'Fidelio'].map((pms) => (
              <Badge key={pms} variant="secondary" className="px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 border border-border/50">
                {pms}
              </Badge>
            ))}
            <Badge variant="outline" className="px-4 py-2 text-sm font-medium text-primary border-primary/30">
              {lang === 'fr' ? '+ bien d\'autres' : '+ many more'}
            </Badge>
          </div>
        </div>
      </section>

      {/* Portals */}
      <section id="portals" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{c.portals.title}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{c.portals.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {c.portals.items.map((item, i) => (
              <div key={i} className={`relative rounded-2xl border p-8 bg-gradient-to-br ${portalColors[item.color]} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}>
                <div className={`w-14 h-14 rounded-2xl bg-background/80 flex items-center justify-center mb-5 ${portalIconColors[item.color]}`}>
                  {portalIcons[item.icon]}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - synced with DB */}
      <section id="pricing" className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{c.pricing.title}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{c.pricing.subtitle}</p>
          </div>
          {plans.length > 0 ? (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 max-w-7xl mx-auto">
                {plans.map((plan) => {
                  const isPopular = plan.plan_name === popularPlan;
                  const isEnterprise = plan.plan_name === 'entreprise';
                  const isFree = plan.price_monthly === 0;
                  const isPaid = plan.price_monthly > 0;
                  const displayName = planDisplayNames[lang]?.[plan.plan_name] || plan.plan_name;
                  const subtitle = (c.pricing as any).planSubtitles?.[plan.plan_name] || '';
                  const featuresList = planFeatures[plan.plan_name] || [];

                  return (
                    <div
                      key={plan.plan_name}
                      className={`relative rounded-2xl border p-6 bg-card flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                        isPopular ? 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20' : isEnterprise ? 'border-primary/40' : 'border-border/60'
                      }`}
                    >
                      {isPopular ? (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          <Badge className="bg-primary text-primary-foreground px-2 py-0.5 text-xs">
                            {c.pricing.popular}
                          </Badge>
                          <Badge className="bg-amber-500 text-white px-2 py-0.5 text-xs">
                            {(c.pricing as any).threeMonthsFree}
                          </Badge>
                        </div>
                      ) : isPaid && !isEnterprise ? (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-3 py-0.5 text-xs whitespace-nowrap">
                          {(c.pricing as any).threeMonthsFree}
                        </Badge>
                      ) : null}

                      <div className="mb-3">
                        {planIcons[plan.plan_name] || <Zap className="w-8 h-8 text-muted-foreground" />}
                      </div>

                      <h3 className="text-xl font-bold mb-0.5">{displayName}</h3>
                      <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>

                      <div className="mb-5">
                        {isFree ? (
                          <span className="text-3xl font-extrabold">{lang === 'fr' ? 'Gratuit' : 'Free'}</span>
                        ) : (
                          <>
                            <span className="text-3xl font-extrabold">{plan.price_monthly}€</span>
                            <div className="text-xs text-muted-foreground">{c.pricing.perMonth}</div>
                          </>
                        )}
                      </div>

                      <div className="mb-6 space-y-2 flex-1">
                        {allFeatureKeys.map((fk) => {
                          const included = featuresList.includes(fk);
                          let label = (c.pricing.features as Record<string, string>)[fk] || fk;
                          if (fk === 'rooms') {
                            if (plan.max_rooms) {
                              label = label.replace('{n}', String(plan.max_rooms));
                            } else {
                              label = (c.pricing.features as Record<string, string>)['roomsUnlimited'] || c.pricing.unlimited;
                            }
                          }
                          return (
                            <div key={fk} className={`flex items-center gap-2 text-xs ${included ? 'text-foreground' : 'text-muted-foreground/40 line-through'}`}>
                              {included ? (
                                <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              ) : (
                                <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center text-muted-foreground/30">✕</span>
                              )}
                              {label}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-auto">
                        <Button
                          className="w-full gap-2"
                          variant={isPopular ? 'default' : 'outline'}
                          onClick={() => isEnterprise ? window.location.href = 'mailto:support@bicbloc.eu' : navigate('/auth')}
                        >
                          {isFree ? c.pricing.startFree : isEnterprise ? c.pricing.contact : c.pricing.choose}
                          {!isFree && !isEnterprise && <ArrowRight className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-8">
                {(c.pricing as any).euNote}
              </p>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Clock className="w-6 h-6 mx-auto mb-2 animate-spin" />
              {lang === 'fr' ? 'Chargement des tarifs...' : 'Loading pricing...'}
            </div>
          )}
        </div>
      </section>

      {/* AI Section */}
      <section id="ai" className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-primary/10 text-primary border-primary/20 gap-2">
              <Sparkles className="w-4 h-4" />
              AI-Powered
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{c.ai.title}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{c.ai.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {c.ai.items.map((item, i) => (
              <div key={i} className="flex gap-4 p-6 rounded-2xl bg-card border border-border/60 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mt-0.5">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{c.testimonials.title}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{c.testimonials.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {c.testimonials.items.map((item, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card p-8 flex flex-col hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <MessageSquareQuote className="w-8 h-8 text-primary/40 mb-4" />
                <p className="text-sm leading-relaxed text-muted-foreground mb-6 flex-1 italic">
                  "{item.quote}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    {testimonialIcons[item.icon]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.role}</div>
                    <div className="text-xs text-primary font-medium">{item.hotel}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-12 md:p-16 text-primary-foreground shadow-2xl shadow-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{c.cta.title}</h2>
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">{c.cta.subtitle}</p>
            <Button size="lg" onClick={() => navigate('/auth')} className="bg-background text-foreground hover:bg-background/90 text-base px-10 py-6 shadow-lg gap-2">
              {c.cta.button}<ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-border/50 bg-muted/30 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold">Nettobloc</span>
              </div>
              <p className="text-sm text-muted-foreground">{c.footer.tagline}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">{c.footer.contact}</h4>
              <a href="mailto:support@bicbloc.eu" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <Mail className="w-4 h-4" />support@bicbloc.eu
              </a>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <div className="space-y-2">
                <a href="/legal/mentions-legales" className="block text-sm text-muted-foreground hover:text-primary transition-colors">{c.footer.legal}</a>
                <a href="/legal/politique-de-confidentialite" className="block text-sm text-muted-foreground hover:text-primary transition-colors">{c.footer.privacy}</a>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">{c.footer.rights}</div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
