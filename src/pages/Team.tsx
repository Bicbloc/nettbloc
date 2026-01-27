import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { SubAccountsManager } from '@/components/SubAccountsManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import UserMenu from '@/components/UserMenu';

const Team = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Gestion de l'équipe</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto py-6 px-4">
        <SubAccountsManager />
      </main>
    </div>
  );
};

export default Team;
