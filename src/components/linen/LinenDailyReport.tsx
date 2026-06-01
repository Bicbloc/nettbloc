import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
// html2pdf.js is imported dynamically when generating the PDF

interface LinenEntry {
  id: string;
  linen_type_id: string;
  quantity_clean: number | null;
  quantity_dirty: number | null;
  quantity_damaged: number | null;
  ai_confidence: number | null;
  photo_url: string | null;
  counted_at: string | null;
  count_method: string | null;
}

interface LinenTask {
  id: string;
  task_date: string;
  assigned_to: string;
  status: string;
  notes: string | null;
  created_at: string;
  linen_inventory_entries: LinenEntry[];
}

interface LinenType {
  id: string;
  name: string;
  icon: string | null;
  dimensions: string | null;
}

interface LinenDailyReportProps {
  date: string;
  tasks: LinenTask[];
  linenTypes: LinenType[];
  hotelName?: string;
  getHousekeeperName: (id: string) => string;
}

export const LinenDailyReport = ({
  date,
  tasks,
  linenTypes,
  hotelName = "Hôtel",
  getHousekeeperName,
}: LinenDailyReportProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculer les totaux par type de linge pour toute la journée
  const dailyTotals = linenTypes.map((type) => {
    let totalClean = 0;
    let totalDirty = 0;
    let totalDamaged = 0;
    const entries: Array<LinenEntry & { operatorName: string; taskTime: string }> = [];

    tasks.forEach((task) => {
      const entry = task.linen_inventory_entries?.find(
        (e) => e.linen_type_id === type.id
      );
      if (entry) {
        totalClean += entry.quantity_clean || 0;
        totalDirty += entry.quantity_dirty || 0;
        totalDamaged += entry.quantity_damaged || 0;
        entries.push({
          ...entry,
          operatorName: getHousekeeperName(task.assigned_to),
          taskTime: entry.counted_at
            ? format(new Date(entry.counted_at), "HH:mm", { locale: fr })
            : format(new Date(task.created_at), "HH:mm", { locale: fr }),
        });
      }
    });

    return {
      type,
      totalClean,
      totalDirty,
      totalDamaged,
      total: totalClean + totalDirty + totalDamaged,
      entries,
    };
  }).filter((item) => item.total > 0);

  const grandTotal = dailyTotals.reduce((sum, item) => sum + item.total, 0);
  const grandClean = dailyTotals.reduce((sum, item) => sum + item.totalClean, 0);
  const grandDirty = dailyTotals.reduce((sum, item) => sum + item.totalDirty, 0);
  const grandDamaged = dailyTotals.reduce((sum, item) => sum + item.totalDamaged, 0);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const element = document.getElementById("linen-daily-report-content");
      if (!element) {
        throw new Error("Contenu du rapport non trouvé");
      }

      const opt = {
        margin: 10,
        filename: `inventaire-linge-${date}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set(opt).from(element).save();
      toast.success("Rapport PDF téléchargé");
    } catch (error) {
      console.error("Erreur génération PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const formattedDate = format(new Date(date), "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-4">
      {/* Bouton téléchargement */}
      <Button
        onClick={handleDownloadPDF}
        disabled={isGenerating || dailyTotals.length === 0}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Génération...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Télécharger le rapport PDF
          </>
        )}
      </Button>

      {/* Contenu du rapport (pour PDF) */}
      <div
        id="linen-daily-report-content"
        className="bg-white p-6 rounded-lg border"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* En-tête */}
        <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            📋 Rapport d'Inventaire Linge
          </h1>
          <p className="text-lg text-gray-600">{hotelName}</p>
          <p className="text-md text-gray-500 capitalize">{formattedDate}</p>
        </div>

        {/* Résumé global */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Résumé de la journée
          </h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-white rounded shadow-sm">
              <div className="text-2xl font-bold text-gray-800">{grandTotal}</div>
              <div className="text-xs text-gray-500">Total pièces</div>
            </div>
            <div className="p-3 bg-green-100 rounded shadow-sm">
              <div className="text-2xl font-bold text-green-700">{grandClean}</div>
              <div className="text-xs text-green-600">Propres</div>
            </div>
            <div className="p-3 bg-orange-100 rounded shadow-sm">
              <div className="text-2xl font-bold text-orange-700">{grandDirty}</div>
              <div className="text-xs text-orange-600">Sales</div>
            </div>
            <div className="p-3 bg-red-100 rounded shadow-sm">
              <div className="text-2xl font-bold text-red-700">{grandDamaged}</div>
              <div className="text-xs text-red-600">Abîmés</div>
            </div>
          </div>
        </div>

        {/* Tableau détaillé */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Détail par type de linge</h2>
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Type</th>
                <th className="border border-gray-300 p-2 text-center w-20">Propre</th>
                <th className="border border-gray-300 p-2 text-center w-20">Sale</th>
                <th className="border border-gray-300 p-2 text-center w-20">Abîmé</th>
                <th className="border border-gray-300 p-2 text-center w-20">Total</th>
                <th className="border border-gray-300 p-2 text-left">Opérateur</th>
                <th className="border border-gray-300 p-2 text-center w-16">Heure</th>
              </tr>
            </thead>
            <tbody>
              {dailyTotals.map((item) => (
                item.entries.map((entry, idx) => (
                  <tr key={`${item.type.id}-${idx}`} className="hover:bg-gray-50">
                    {idx === 0 && (
                      <td
                        className="border border-gray-300 p-2 font-medium"
                        rowSpan={item.entries.length}
                      >
                        <span className="mr-2">{item.type.icon || "📦"}</span>
                        {item.type.name}
                        {item.type.dimensions && (
                          <span className="text-xs text-gray-500 block">
                            {item.type.dimensions}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="border border-gray-300 p-2 text-center text-green-700">
                      {entry.quantity_clean || 0}
                    </td>
                    <td className="border border-gray-300 p-2 text-center text-orange-700">
                      {entry.quantity_dirty || 0}
                    </td>
                    <td className="border border-gray-300 p-2 text-center text-red-700">
                      {entry.quantity_damaged || 0}
                    </td>
                    <td className="border border-gray-300 p-2 text-center font-medium">
                      {(entry.quantity_clean || 0) +
                        (entry.quantity_dirty || 0) +
                        (entry.quantity_damaged || 0)}
                    </td>
                    <td className="border border-gray-300 p-2">{entry.operatorName}</td>
                    <td className="border border-gray-300 p-2 text-center">
                      {entry.taskTime}
                    </td>
                  </tr>
                ))
              ))}
              {/* Ligne totaux */}
              <tr className="bg-gray-200 font-bold">
                <td className="border border-gray-300 p-2">TOTAL</td>
                <td className="border border-gray-300 p-2 text-center text-green-700">
                  {grandClean}
                </td>
                <td className="border border-gray-300 p-2 text-center text-orange-700">
                  {grandDirty}
                </td>
                <td className="border border-gray-300 p-2 text-center text-red-700">
                  {grandDamaged}
                </td>
                <td className="border border-gray-300 p-2 text-center">{grandTotal}</td>
                <td className="border border-gray-300 p-2" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>


        {/* Pied de page */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
          Rapport généré le {format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr })} •
          NettBloc
        </div>
      </div>
    </div>
  );
};
