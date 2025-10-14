import { Building2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeroHeaderProps {
  hotelName?: string;
  isPremium?: boolean;
}

export function HeroHeader({ hotelName, isPremium }: HeroHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 mb-8">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
      
      <div className="relative px-8 py-12">
        <div className="max-w-4xl">
          {/* Badge */}
          {isPremium && (
            <Badge variant="secondary" className="mb-4 bg-gradient-premium text-premium-foreground border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
          
          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-display font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {hotelName || "Bienvenue"}
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Gérez votre établissement avec efficacité. Assignation automatique, suivi en temps réel, et rapports détaillés.
          </p>
          
          {/* Stats */}
          <div className="flex gap-8 mt-8">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-muted-foreground">Temps réel</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Solution complète</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
