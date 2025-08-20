import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, Check, ArrowRight } from 'lucide-react';
import { UpgradeButton } from '@/components/UpgradeButton';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionCard } from '@/components/SubscriptionCard';

const PlanSelection = () => {
  const { isAuthenticated, loading } = useAuth();
  const { plan, isPremium, isFree, loading: subscriptionLoading } = useSubscription();

  // Redirect to auth if not authenticated
  if (!loading && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const handleContinueToDashboard = () => {
    window.location.href = '/';
  };

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const freemiumFeatures = [
    "Analyse PDF automatique",
    "Distribution automatique des chambres",
    "Téléchargement des rapports",
    "Jusqu'à 5 femmes de chambre",
    "Support par email"
  ];

  const premiumFeatures = [
    "Toutes les fonctionnalités Freemium",
    "Archivage des données",
    "Gestion d'équipe avancée",
    "Femmes de chambre illimitées", 
    "Rapports personnalisés",
    "Support prioritaire",
    "API et intégrations avancées"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Commencez avec notre plan Freemium ou débloquez toutes les fonctionnalités avec Premium
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Plan Freemium */}
          <Card className={`relative transition-all duration-300 ${isFree ? 'ring-2 ring-freemium/30 bg-gradient-to-br from-freemium-light/5 to-transparent' : ''}`}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Badge 
                  variant="secondary"
                  className="bg-gradient-freemium text-freemium-foreground px-4 py-2 text-lg"
                >
                  <Zap className="mr-2 h-5 w-5" />
                  Freemium
                </Badge>
              </div>
              <CardTitle className="text-3xl">Gratuit</CardTitle>
              <CardDescription className="text-lg">
                Parfait pour les petits établissements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {freemiumFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {isPremium && (
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleContinueToDashboard}
                  >
                    Plan actuel: Premium
                  </Button>
                </div>
              )}
              {isFree && (
                <div className="pt-4">
                  <Button 
                    variant="default"
                    className="w-full bg-gradient-freemium"
                    onClick={handleContinueToDashboard}
                  >
                    Plan actuel: Freemium
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Premium */}
          <Card className={`relative transition-all duration-300 ${isPremium ? 'ring-2 ring-premium/30 bg-gradient-to-br from-premium-light/5 to-transparent' : 'border-premium/20'}`}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Badge 
                  variant="default"
                  className="bg-gradient-premium text-premium-foreground px-4 py-2 text-lg"
                >
                  <Crown className="mr-2 h-5 w-5" />
                  Premium
                </Badge>
              </div>
              <CardTitle className="text-3xl">100€ HT/mois</CardTitle>
              <CardDescription className="text-lg">
                Pour les établissements professionnels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {premiumFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-premium flex-shrink-0" />
                    <span className={index === 0 ? "font-medium" : ""}>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-4">
                {isFree && (
                  <UpgradeButton 
                    variant="default" 
                    className="w-full bg-gradient-premium hover:bg-gradient-premium/90" 
                  />
                )}
                {isPremium && (
                  <Button 
                    variant="default"
                    className="w-full bg-gradient-premium"
                    onClick={handleContinueToDashboard}
                  >
                    Plan actuel: Premium
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section de gestion d'abonnement */}
        <div className="max-w-2xl mx-auto">
          <SubscriptionCard />
        </div>

        {/* Bouton pour continuer */}
        <div className="text-center mt-8">
          <Button 
            variant="outline" 
            onClick={handleContinueToDashboard}
            className="px-8"
          >
            Continuer vers le tableau de bord
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;