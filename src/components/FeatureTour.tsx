/**
 * FeatureTour
 * Tutoriel guidé affiché à la première connexion d'un compte.
 * Parcourt chaque fonctionnalité principale en changeant d'onglet
 * et en affichant une explication.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Layers, Bed, UserIcon, Key, AlertTriangle, FileText,
  Archive, ClipboardCheck, Package, Repeat, TicketCheck,
  Sparkles, ArrowRight, ArrowLeft, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TabValue } from "@/components/layout";

const TOUR_FLAG_PREFIX = "feature_tour_done_";

export const isFeatureTourDone = (hotelId?: string | null) => {
  if (!hotelId) return true;
  return localStorage.getItem(TOUR_FLAG_PREFIX + hotelId) === "true";
};

export const markFeatureTourDone = (hotelId?: string | null) => {
  if (!hotelId) return;
  localStorage.setItem(TOUR_FLAG_PREFIX + hotelId, "true");
};

interface TourStep {
  tab?: TabValue;
  icon: React.ReactNode;
  title: { fr: string; en: string };
  desc: { fr: string; en: string };
}

const STEPS: TourStep[] = [
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: { fr: "Bienvenue sur Nettobloc 👋", en: "Welcome to Nettobloc 👋" },
    desc: {
      fr: "Voici un tour rapide des fonctionnalités. Vous pouvez le passer à tout moment.",
      en: "Here's a quick tour of the features. You can skip it anytime.",
    },
  },
  {
    tab: "overview",
    icon: <Layers className="h-6 w-6" />,
    title: { fr: "Vue d'ensemble", en: "Overview" },
    desc: {
      fr: "Importez votre PDF, visualisez l'état des chambres et lancez la distribution du travail.",
      en: "Import your PDF, view room status and start distributing the work.",
    },
  },
  {
    tab: "rooms",
    icon: <Bed className="h-6 w-6" />,
    title: { fr: "Gestion des chambres", en: "Room management" },
    desc: {
      fr: "Ajoutez, modifiez et organisez vos chambres. Configuration avancée et entraînement PDF disponibles ici.",
      en: "Add, edit and organize your rooms. Advanced config and PDF training are available here.",
    },
  },
  {
    tab: "assignment",
    icon: <UserIcon className="h-6 w-6" />,
    title: { fr: "Attribution", en: "Assignment" },
    desc: {
      fr: "Répartissez les chambres entre vos femmes de chambre, automatiquement ou manuellement.",
      en: "Distribute rooms among your housekeepers, automatically or manually.",
    },
  },
  {
    tab: "access-codes",
    icon: <Key className="h-6 w-6" />,
    title: { fr: "Codes d'accès", en: "Access codes" },
    desc: {
      fr: "Générez des codes pour que votre personnel se connecte à l'application terrain.",
      en: "Generate codes so your staff can log in to the field app.",
    },
  },
  {
    tab: "tickets",
    icon: <TicketCheck className="h-6 w-6" />,
    title: { fr: "Tickets", en: "Tickets" },
    desc: {
      fr: "Suivez les demandes et tâches ponctuelles de votre équipe.",
      en: "Track your team's requests and one-off tasks.",
    },
  },
  {
    tab: "incidents",
    icon: <AlertTriangle className="h-6 w-6" />,
    title: { fr: "Incidents", en: "Incidents" },
    desc: {
      fr: "Recensez les incidents signalés dans les chambres et suivez leur résolution.",
      en: "Log incidents reported in rooms and track their resolution.",
    },
  },
  {
    tab: "inspections",
    icon: <ClipboardCheck className="h-6 w-6" />,
    title: { fr: "Inspections", en: "Inspections" },
    desc: {
      fr: "La gouvernante contrôle la qualité du nettoyage et valide les chambres.",
      en: "The governess checks cleaning quality and validates rooms.",
    },
  },
  {
    tab: "linen",
    icon: <span className="text-2xl">🧺</span>,
    title: { fr: "Inventaire du linge", en: "Linen inventory" },
    desc: {
      fr: "Scannez et comptez le linge grâce à l'IA, et suivez vos stocks.",
      en: "Scan and count linen with AI, and track your stock.",
    },
  },
  {
    tab: "lost-found",
    icon: <Package className="h-6 w-6" />,
    title: { fr: "Objets trouvés", en: "Lost & found" },
    desc: {
      fr: "Enregistrez et gérez les objets oubliés par les clients.",
      en: "Record and manage items left behind by guests.",
    },
  },
  {
    tab: "templates",
    icon: <Repeat className="h-6 w-6" />,
    title: { fr: "Templates", en: "Templates" },
    desc: {
      fr: "Créez des modèles de tâches et d'instructions récurrentes.",
      en: "Create recurring task and instruction templates.",
    },
  },
  {
    tab: "reports",
    icon: <FileText className="h-6 w-6" />,
    title: { fr: "Rapports", en: "Reports" },
    desc: {
      fr: "Générez et envoyez par e-mail vos rapports d'activité en PDF.",
      en: "Generate and email your activity reports as PDF.",
    },
  },
  {
    tab: "archives",
    icon: <Archive className="h-6 w-6" />,
    title: { fr: "Archives", en: "Archives" },
    desc: {
      fr: "Consultez l'historique de vos journées et rapports passés.",
      en: "Browse the history of your past days and reports.",
    },
  },
  {
    icon: <Check className="h-6 w-6" />,
    title: { fr: "Vous êtes prêt ! 🎉", en: "You're all set! 🎉" },
    desc: {
      fr: "Explorez librement. Bon travail avec Nettobloc !",
      en: "Explore freely. Enjoy working with Nettobloc!",
    },
  },
];

interface FeatureTourProps {
  isOpen: boolean;
  onTabChange: (tab: TabValue) => void;
  onClose: () => void;
}

export function FeatureTour({ isOpen, onTabChange, onClose }: FeatureTourProps) {
  const { language } = useLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const [index, setIndex] = useState(0);

  const step = STEPS[index];
  const total = STEPS.length;
  const isLast = index === total - 1;

  useEffect(() => {
    if (isOpen && step?.tab) {
      onTabChange(step.tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isOpen]);

  const finish = () => {
    onClose();
  };

  const next = () => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const content = useMemo(() => {
    if (!isOpen || !step) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {step.icon}
              </div>
              <h3 className="text-base font-semibold">{step.title[lang]}</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={finish}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.desc[lang]}</p>

            <div className="mt-4 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>
                {lang === "fr" ? "Étape" : "Step"} {index + 1} / {total}
              </span>
              <span>{Math.round(((index + 1) / total) * 100)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>

            <div className="mt-3 flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (i === index ? "w-6 bg-primary" : "w-1.5 bg-muted")
                  }
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 p-4 border-t">
            <Button variant="ghost" size="sm" onClick={finish}>
              {lang === "fr" ? "Passer" : "Skip"}
            </Button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <Button variant="outline" size="sm" onClick={prev}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {lang === "fr" ? "Précédent" : "Back"}
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {isLast
                  ? lang === "fr" ? "Terminer" : "Finish"
                  : lang === "fr" ? "Suivant" : "Next"}
                {!isLast && <ArrowRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [isOpen, step, index, lang, isLast]);

  if (!isOpen) return null;
  return createPortal(content, document.body);
}
