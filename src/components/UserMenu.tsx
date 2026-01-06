import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminRole } from '@/hooks/use-admin-role';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User, Settings, Shield, Crown, Building2, MessageCircle, CreditCard, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionBadge } from './SubscriptionBadge';
import { SupportTicketDialog } from './SupportTicketDialog';

const UserMenu = () => {
  const { user, signOut, isAuthenticated } = useAuth();
  const { isSuperAdmin } = useAdminRole();
  const { plan, subscribed, isPremium, isInTrial, trialDaysRemaining } = useSubscription();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Déconnexion réussie",
      description: "À bientôt !"
    });
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  const userInitials = user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className={`h-8 w-8 ${isPremium ? 'ring-2 ring-premium/50' : ''}`}>
            <AvatarFallback className={isPremium ? 'bg-gradient-premium text-premium-foreground' : ''}>
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {isPremium && (
            <Crown className="absolute -top-1 -right-1 h-3 w-3 text-premium" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div>
              <p className="text-sm font-medium leading-none">Mon compte</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
            <SubscriptionBadge 
              plan={plan}
              subscribed={subscribed}
              trialDaysRemaining={trialDaysRemaining}
              size="sm"
            />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <User className="mr-2 h-4 w-4" />
          <span>Profil</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Paramètres</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/room-registry')}>
          <Building2 className="mr-2 h-4 w-4" />
          <span>Registre des chambres</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/plans')}>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Abonnement</span>
        </DropdownMenuItem>
        <SupportTicketDialog 
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <MessageCircle className="mr-2 h-4 w-4" />
              <span>Signaler un problème</span>
            </DropdownMenuItem>
          }
        />
        {isSuperAdmin && (
          <DropdownMenuItem onClick={() => navigate('/admin')}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Administration</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleLanguage}>
          <Globe className="mr-2 h-4 w-4" />
          <span>{language === 'fr' ? 'English' : 'Français'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/auth?force=true')}>
          <User className="mr-2 h-4 w-4" />
          <span>{language === 'fr' ? 'Changer de compte' : 'Switch account'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{language === 'fr' ? 'Se déconnecter' : 'Sign out'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;