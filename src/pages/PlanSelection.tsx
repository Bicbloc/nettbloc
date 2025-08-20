import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { PlanSelectionDialog } from '@/components/PlanSelectionDialog';

const PlanSelection = () => {
  const { isAuthenticated, loading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(true);

  // Redirect to auth if not authenticated
  if (!loading && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const handlePlanSelected = (plan: 'free' | 'premium') => {
    setIsDialogOpen(false);
    // Redirect to home after plan selection
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    // Redirect to home if they close without selecting
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PlanSelectionDialog 
        isOpen={isDialogOpen}
        onClose={handleClose}
        onPlanSelected={handlePlanSelected}
      />
    </div>
  );
};

export default PlanSelection;