import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BackButton from '@/components/BackButton';

export default function HousekeeperAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    // Rediriger vers le système de codes d'accès plus simple
    navigate('/housekeeper/login');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-4 text-gray-600">Redirection...</p>
      </div>
    </div>
  );
}
