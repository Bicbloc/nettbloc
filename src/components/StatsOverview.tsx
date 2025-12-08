import { Card, CardContent } from "@/components/ui/card";
import { Bed, Users, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Room } from "@/services/pdfService";
import { useEffect, useState } from "react";

interface StatsOverviewProps {
  rooms: Room[];
  housekeeperCount: number;
}

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }
    
    const startTime = Date.now();
    const startValue = displayValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (value - startValue) * easeOut);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <>{displayValue}</>;
}

export function StatsOverview({ rooms, housekeeperCount }: StatsOverviewProps) {
  const totalRooms = rooms.length;
  const roomsToClean = rooms.filter(r => r.cleaningType !== 'none' && r.status !== 'maintenance').length;
  const cleanedRooms = rooms.filter(r => r.status === 'completed' || r.status === 'clean').length;
  const inProgressRooms = rooms.filter(r => r.status === 'in_progress' || r.status === 'in-progress').length;
  
  const progressPercent = roomsToClean > 0 ? Math.round((cleanedRooms / roomsToClean) * 100) : 0;
  
  const stats = [
    {
      label: "Chambres totales",
      value: totalRooms,
      icon: Bed,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary"
    },
    {
      label: "À nettoyer",
      value: roomsToClean,
      icon: Clock,
      gradient: "from-warning/20 to-warning/5",
      iconBg: "bg-warning/15",
      iconColor: "text-warning"
    },
    {
      label: "Nettoyées",
      value: cleanedRooms,
      icon: CheckCircle2,
      gradient: "from-success/20 to-success/5",
      iconBg: "bg-success/15",
      iconColor: "text-success",
      badge: progressPercent > 0 ? `${progressPercent}%` : null
    },
    {
      label: "Personnel actif",
      value: housekeeperCount,
      icon: Users,
      gradient: "from-info/20 to-info/5",
      iconBg: "bg-info/15",
      iconColor: "text-info"
    }
  ];
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => (
        <Card 
          key={stat.label} 
          className={`relative overflow-hidden border-0 shadow-modern hover:shadow-modern-lg transition-all duration-500 hover:-translate-y-1 bg-gradient-to-br ${stat.gradient}`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={`${stat.iconBg} p-3 rounded-xl`}>
                <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
              {stat.badge && (
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-success/20 text-success flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {stat.badge}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold tracking-tight">
                <AnimatedNumber value={stat.value} />
              </p>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
