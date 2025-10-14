import { Card, CardContent } from "@/components/ui/card";
import { Bed, Users, CheckCircle2, Clock } from "lucide-react";
import { Room } from "@/services/pdfService";

interface StatsOverviewProps {
  rooms: Room[];
  housekeeperCount: number;
}

export function StatsOverview({ rooms, housekeeperCount }: StatsOverviewProps) {
  const totalRooms = rooms.length;
  const roomsToClean = rooms.filter(r => r.cleaningType !== 'none' && r.status !== 'maintenance').length;
  const cleanedRooms = rooms.filter(r => r.status === 'completed').length;
  const inProgressRooms = rooms.filter(r => r.status === 'in_progress').length;
  
  const stats = [
    {
      label: "Chambres totales",
      value: totalRooms,
      icon: Bed,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      label: "À nettoyer",
      value: roomsToClean,
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    },
    {
      label: "Nettoyées",
      value: cleanedRooms,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    {
      label: "Personnel actif",
      value: housekeeperCount,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    }
  ];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50 hover:shadow-modern transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.bgColor} ${stat.color} p-2.5 rounded-lg`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
