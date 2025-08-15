import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hotel, Users, Clock, BarChart3 } from 'lucide-react';

export default function Index() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-6">
            NettBloc
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Solution complète de gestion du nettoyage hôtelier. 
            Optimisez la productivité de votre équipe avec notre système intelligent.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')}>
              Commencer
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/housekeeper')}>
              Accès femme de chambre
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader className="text-center">
              <Hotel className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Gestion Hôtelière</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Interface admin complète pour gérer vos chambres et votre équipe de nettoyage
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Équipe Mobile</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Application mobile simple pour que vos femmes de chambre gèrent leurs tâches
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Attribution Intelligente</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Algorithme d'attribution automatique pour optimiser les temps de nettoyage
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Traçabilité Complète</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Suivi en temps réel et rapports détaillés de productivité
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Prêt à optimiser votre nettoyage ?</CardTitle>
              <CardDescription>
                Commencez dès maintenant avec notre solution simple et efficace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" onClick={() => navigate('/auth')}>
                  Créer un compte admin
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/housekeeper')}>
                  Je suis femme de chambre
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}