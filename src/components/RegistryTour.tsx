/**
 * RegistryTour
 * Tutoriel guidé de la page "Registre des chambres".
 * Met en surbrillance les actions réelles (ajouter, organiser, plan) et
 * explique comment remplir le registre. Déclenché via ?tour=1 dans l'URL.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Layers, Filter, LayoutGrid, Check, ArrowRight, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface RegStep {
  target?: string;
  icon: React.ReactNode;
  badge?: { fr: string; en: string };
  title: { fr: string; en: string };
  desc: { fr: string; en: string };
}

const STEPS: RegStep[] = [
  {
    target: '[data-tour="reg-add"]',
    icon: <Plus className="h-6 w-6" />,
    badge: { fr: "Étape clé", en: "Key step" },
    title: { fr: "Ajouter une chambre / un espace", en: "Add a room / space" },
    desc: {
      fr: "Cliquez sur « Ajouter un espace ». Renseignez le numéro (ex. 101), l'étage (RDC, 1er…), la catégorie (Chambre, Commun, Technique) et le type (simple, double, twin…). Validez : l'espace apparaît dans le registre. Répétez pour chaque chambre.",
      en: "Click \"Add a space\". Enter the number (e.g. 101), the floor (ground, 1st…), the category (Room, Common, Technical) and the type (single, double, twin…). Confirm: the space appears in the registry. Repeat for each room.",
    },
  },
  {
    target: '[data-tour="reg-bulk"]',
    icon: <Layers className="h-6 w-6" />,
    title: { fr: "Ajout en masse / équipement", en: "Bulk add / equipment" },
    desc: {
      fr: "Pour gagner du temps, « Équipement en masse » applique le même équipement ou type à plusieurs espaces d'un coup, au lieu de les saisir un par un.",
      en: "To save time, \"Bulk equipment\" applies the same equipment or type to several spaces at once, instead of entering them one by one.",
    },
  },
  {
    target: '[data-tour="reg-filter"]',
    icon: <Filter className="h-6 w-6" />,
    title: { fr: "Organiser les espaces", en: "Organize spaces" },
    desc: {
      fr: "Classez et retrouvez vos espaces : filtrez par Chambres, Communs ou Techniques, ou utilisez la recherche. Pratique quand le registre s'agrandit.",
      en: "Sort and find your spaces: filter by Rooms, Common or Technical, or use search. Handy as the registry grows.",
    },
  },
  {
    target: '[data-tour="reg-view"]',
    icon: <LayoutGrid className="h-6 w-6" />,
    badge: { fr: "Faire un plan", en: "Build a plan" },
    title: { fr: "Créer le plan des espaces", en: "Create the floor plan" },
    desc: {
      fr: "Basculez entre 3 vues : « Plan » affiche un plan architectural par étage (idéal pour visualiser et organiser visuellement), « Grille » des cartes, « Liste » un tableau détaillé. Choisissez « Plan » pour bâtir et réorganiser le plan de votre établissement étage par étage.",
      en: "Switch between 3 views: \"Plan\" shows an architectural floor plan per floor (ideal to visualize and organize visually), \"Grid\" cards, \"List\" a detailed table. Pick \"Plan\" to build and rearrange your establishment's layout floor by floor.",
    },
  },
  {
    icon: <Check className="h-6 w-6" />,
    title: { fr: "Registre prêt ! 🎉", en: "Registry ready! 🎉" },
    desc: {
      fr: "Ajoutez vos espaces, organisez-les par catégorie et visualisez-les en mode Plan. Ce registre sert de référence pour les affectations et les imports PDF.",
      en: "Add your spaces, organize them by category and view them in Plan mode. This registry is the reference for assignments and PDF imports.",
    },
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

interface RegistryTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegistryTour({ isOpen, onClose }: RegistryTourProps) {
  const { language } = useLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = STEPS[index];
  const total = STEPS.length;
  const isLast = index === total - 1;

  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); return; }
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [step]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    let tries = 0;
    measure();
    const id = window.setInterval(() => {
      tries += 1;
      measure();
      if (tries > 6) window.clearInterval(id);
    }, 120);
    return () => window.clearInterval(id);
  }, [isOpen, index, measure]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, measure]);

  const finish = () => onClose();
  const next = () => { if (isLast) finish(); else setIndex((i) => i + 1); };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    const CARD_W = 380;
    const GAP = 16;
    if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left + rect.width + GAP;
    if (left + CARD_W > vw - 12) left = Math.max(12, rect.left - CARD_W - GAP);
    if (left < 12) left = 12;
    let top = rect.top + rect.height + GAP;
    if (top + 300 > vh) top = Math.max(12, rect.top - 300 - GAP);
    top = Math.max(12, top);
    return { top, left, width: CARD_W, maxWidth: "calc(100vw - 24px)" };
  }, [rect]);

  const content = useMemo(() => {
    if (!isOpen || !step) return null;
    const pad = 8;
    const spotlight = rect
      ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
      : null;

    return (
      <div className="fixed inset-0 z-[200] pointer-events-none">
        {/* Voile très léger (pas de flou) */}
        <div
          className="absolute inset-0 transition-all duration-300 pointer-events-auto"
          style={{
            background: "hsl(var(--foreground) / 0.12)",
            ...(spotlight
              ? {
                  clipPath: `polygon(
                    0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                    ${spotlight.left}px ${spotlight.top}px,
                    ${spotlight.left}px ${spotlight.top + spotlight.height}px,
                    ${spotlight.left + spotlight.width}px ${spotlight.top + spotlight.height}px,
                    ${spotlight.left + spotlight.width}px ${spotlight.top}px,
                    ${spotlight.left}px ${spotlight.top}px
                  )`,
                }
              : {}),
          }}
          onClick={finish}
        />

        {spotlight && (
          <div
            className="absolute rounded-xl ring-4 ring-primary ring-offset-2 ring-offset-transparent transition-all duration-300 animate-pulse pointer-events-none"
            style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }}
          />
        )}

        <div
          className="absolute rounded-2xl border bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
          style={tooltipStyle}
        >
          <div className="h-1.5 w-full overflow-hidden rounded-t-2xl bg-muted">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>

          <div className="flex items-start justify-between gap-3 p-4 border-b">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {step.icon}
              </div>
              <div className="min-w-0">
                {step.badge && (
                  <span className="inline-block mb-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
                    {step.badge[lang]}
                  </span>
                )}
                <h3 className="text-base font-semibold leading-tight truncate">{step.title[lang]}</h3>
                <span className="text-xs font-medium text-muted-foreground">
                  {lang === "fr" ? "Étape" : "Step"} {index + 1} / {total} · {Math.round(((index + 1) / total) * 100)}%
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={finish}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.desc[lang]}</p>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  title={s.title[lang]}
                  aria-label={s.title[lang]}
                  className={
                    "h-2 rounded-full transition-all " +
                    (i === index ? "w-6 bg-primary" : i < index ? "w-2 bg-primary/50" : "w-2 bg-muted hover:bg-muted-foreground/40")
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
                {isLast ? (lang === "fr" ? "Terminer" : "Finish") : (lang === "fr" ? "Suivant" : "Next")}
                {!isLast && <ArrowRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [isOpen, step, index, lang, isLast, rect, tooltipStyle, total]);

  if (!isOpen) return null;
  return createPortal(content, document.body);
}
