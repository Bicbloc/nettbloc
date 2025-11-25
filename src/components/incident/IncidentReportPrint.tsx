import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface IncidentReportPrintProps {
  hotelId: string;
}

export function IncidentReportPrint({ hotelId }: IncidentReportPrintProps) {
  const [startDate, setStartDate] = useState<string>(
    format(new Date(new Date().setDate(new Date().getDate() - 30)), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const { data: types = [] } = useQuery({
    queryKey: ["incident-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_types")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: incidents = [], refetch } = useQuery({
    queryKey: ["incidents-for-print", hotelId, startDate, endDate, selectedType, selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from("incidents")
        .select(`
          *,
          type:incident_types(name, color),
          category:incident_categories(name, icon),
          item:incident_items(name)
        `)
        .eq("hotel_id", hotelId)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59")
        .order("created_at", { ascending: false });

      if (selectedType !== "all") {
        query = query.eq("type_id", selectedType);
      }

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handlePrint = () => {
    if (incidents.length === 0) {
      toast.error("Aucun incident à imprimer pour les critères sélectionnés");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const statusLabels = {
      new: "Nouveau",
      in_progress: "En cours",
      resolved: "Résolu",
    };

    const priorityLabels = {
      low: "Faible",
      medium: "Moyen",
      high: "Élevé",
      urgent: "Urgent",
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapport d'incidents - ${format(new Date(startDate), "dd/MM/yyyy")} au ${format(
      new Date(endDate),
      "dd/MM/yyyy"
    )}</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 1200px;
              margin: 0 auto;
            }
            h1 {
              color: #1a1a1a;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 10px;
            }
            .meta {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .meta p {
              margin: 5px 0;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 12px;
              text-align: left;
            }
            th {
              background: #3b82f6;
              color: white;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background: #f9fafb;
            }
            .status-new { color: #ef4444; font-weight: bold; }
            .status-in_progress { color: #f59e0b; font-weight: bold; }
            .status-resolved { color: #22c55e; font-weight: bold; }
            .priority-low { color: #3b82f6; }
            .priority-medium { color: #f59e0b; }
            .priority-high { color: #ef4444; }
            .priority-urgent { color: #dc2626; font-weight: bold; }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>📋 Rapport d'incidents</h1>
          
          <div class="meta">
            <p><strong>Période:</strong> ${format(new Date(startDate), "dd MMMM yyyy", {
              locale: fr,
            })} au ${format(new Date(endDate), "dd MMMM yyyy", { locale: fr })}</p>
            <p><strong>Type de problème:</strong> ${
              selectedType === "all"
                ? "Tous"
                : types.find((t) => t.id === selectedType)?.name || "N/A"
            }</p>
            <p><strong>Statut:</strong> ${
              selectedStatus === "all" ? "Tous" : statusLabels[selectedStatus] || "N/A"
            }</p>
            <p><strong>Nombre total d'incidents:</strong> ${incidents.length}</p>
            <p><strong>Date d'impression:</strong> ${format(new Date(), "dd/MM/yyyy à HH:mm", {
              locale: fr,
            })}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Titre</th>
                <th>Localisation</th>
                <th>Type</th>
                <th>Catégorie</th>
                <th>Priorité</th>
                <th>Statut</th>
                <th>Signalé par</th>
              </tr>
            </thead>
            <tbody>
              ${incidents
                .map(
                  (incident) => `
                <tr>
                  <td>${format(new Date(incident.created_at), "dd/MM/yy HH:mm")}</td>
                  <td><strong>${incident.title}</strong></td>
                  <td>${incident.location_type === "room" ? `Chambre ${incident.location_reference}` : incident.location_type === "common_area" ? `Zone commune - ${incident.location_reference}` : "N/A"}</td>
                  <td>${incident.type?.name || "N/A"}</td>
                  <td>${incident.category?.icon || ""} ${incident.category?.name || "N/A"}</td>
                  <td class="priority-${incident.priority}">${priorityLabels[incident.priority] || "N/A"}</td>
                  <td class="status-${incident.status}">${statusLabels[incident.status] || "N/A"}</td>
                  <td>${incident.reported_by_name}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="footer">
            <p>Ce rapport a été généré automatiquement par HotelFlow</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleDownload = () => {
    if (incidents.length === 0) {
      toast.error("Aucun incident à télécharger");
      return;
    }

    const statusLabels = {
      new: "Nouveau",
      in_progress: "En cours",
      resolved: "Résolu",
    };

    const priorityLabels = {
      low: "Faible",
      medium: "Moyen",
      high: "Élevé",
      urgent: "Urgent",
    };

    const csv = [
      ["Date", "Titre", "Localisation", "Type", "Catégorie", "Priorité", "Statut", "Signalé par"],
      ...incidents.map((incident) => [
        format(new Date(incident.created_at), "dd/MM/yyyy HH:mm"),
        incident.title,
        incident.location_type === "room"
          ? `Chambre ${incident.location_reference}`
          : incident.location_type === "common_area"
            ? `Zone commune - ${incident.location_reference}`
            : "N/A",
        incident.type?.name || "N/A",
        incident.category?.name || "N/A",
        priorityLabels[incident.priority] || "N/A",
        statusLabels[incident.status] || "N/A",
        incident.reported_by_name,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `incidents_${startDate}_${endDate}.csv`;
    link.click();

    toast.success("Rapport téléchargé en CSV");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Imprimer un rapport d'incidents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Date de début</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">Date de fin</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type de problème</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Statut</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="new">Nouveau</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="resolved">Résolu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {incidents.length} incident(s) trouvé(s)
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={incidents.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger CSV
            </Button>
            <Button onClick={handlePrint} disabled={incidents.length === 0}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
