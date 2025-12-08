import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Building, Copy, Check, QrCode, Share2, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface HotelIdBadgeProps {
  hotelCode: string;
  hotelName?: string;
  variant?: 'compact' | 'full';
  className?: string;
}

export function HotelIdBadge({ hotelCode, hotelName, variant = 'compact', className }: HotelIdBadgeProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    await navigator.clipboard.writeText(hotelCode);
    setCopied(true);
    toast({
      title: "Code copié !",
      description: `Le code ${hotelCode} a été copié dans le presse-papiers.`
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareText = `Rejoignez mon établissement sur NettoBloc!\n\nCode d'établissement: ${hotelCode}${hotelName ? `\nNom: ${hotelName}` : ''}\n\nTéléchargez l'application et utilisez ce code pour vous connecter.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Invitation NettoBloc',
          text: shareText
        });
      } catch (err) {
        // User cancelled or error
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Texte d'invitation copié",
          description: "Partagez ce texte avec vos femmes de chambre."
        });
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast({
        title: "Texte d'invitation copié",
        description: "Partagez ce texte avec vos femmes de chambre."
      });
    }
  };

  if (variant === 'compact') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Badge 
            variant="outline" 
            className={`cursor-pointer hover:bg-accent transition-colors gap-1.5 px-3 py-1.5 ${className}`}
          >
            <Building className="h-3.5 w-3.5" />
            <span className="font-mono font-semibold">{hotelCode}</span>
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building className="h-4 w-4 text-primary" />
                ID de l'établissement
              </div>
              {hotelName && (
                <p className="text-sm text-muted-foreground">{hotelName}</p>
              )}
            </div>
            
            <div className="p-3 bg-muted rounded-lg text-center">
              <span className="font-mono text-xl font-bold tracking-wider">
                {hotelCode}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopy}
                className="w-full"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copié !" : "Copier le code"}
              </Button>
              
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleShare}
                className="w-full"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Partager l'invitation
              </Button>
            </div>

            <div className="text-xs text-muted-foreground flex items-start gap-2 p-2 bg-accent/50 rounded">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                Partagez ce code avec vos femmes de chambre pour qu'elles puissent se connecter à votre établissement.
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Variant full
  return (
    <div className={`p-4 border rounded-lg bg-card ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-primary" />
          <span className="font-medium">ID de l'établissement</span>
        </div>
      </div>
      
      {hotelName && (
        <p className="text-sm text-muted-foreground mb-3">{hotelName}</p>
      )}
      
      <div className="p-4 bg-muted rounded-lg text-center mb-4">
        <span className="font-mono text-2xl font-bold tracking-widest">
          {hotelCode}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={handleCopy}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? "Copié !" : "Copier"}
        </Button>
        
        <Button variant="secondary" onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Partager
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Partagez ce code avec votre équipe pour qu'elle puisse se connecter.
      </p>
    </div>
  );
}
