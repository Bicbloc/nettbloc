/**
 * Netto Count - Results Page
 * Display scan results in a table with export options
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Package,
  ScanLine,
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ScanResult {
  item_name: string;
  count: number;
  confidence: number;
  source_file: string;
}

interface AggregatedResult {
  item_name: string;
  total_count: number;
  avg_confidence: number;
  sources: string[];
}

export default function NettoCountResults() {
  const navigate = useNavigate();
  const { scanId } = useParams();
  const { toast } = useToast();

  const [scan, setScan] = useState<any>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [aggregatedResults, setAggregatedResults] = useState<AggregatedResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadResults = async () => {
      if (!scanId) {
        navigate("/netto-count/scan");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/netto-count/auth");
        return;
      }

      // Load scan details
      const { data: scanData, error: scanError } = await supabase
        .from("netto_count_scans")
        .select("*")
        .eq("id", scanId)
        .eq("user_id", user.id)
        .single();

      if (scanError || !scanData) {
        toast({
          title: "Scan not found",
          description: "The requested scan could not be found",
          variant: "destructive",
        });
        navigate("/netto-count/scan");
        return;
      }

      setScan(scanData);

      // Load results
      const { data: resultsData, error: resultsError } = await supabase
        .from("netto_count_results")
        .select("*")
        .eq("scan_id", scanId)
        .eq("user_id", user.id);

      if (resultsError) {
        console.error("Error loading results:", resultsError);
      }

      setResults(resultsData || []);

      // Aggregate results by item
      const aggregated: Record<string, AggregatedResult> = {};
      (resultsData || []).forEach(result => {
        if (!aggregated[result.item_name]) {
          aggregated[result.item_name] = {
            item_name: result.item_name,
            total_count: 0,
            avg_confidence: 0,
            sources: [],
          };
        }
        aggregated[result.item_name].total_count += result.count;
        aggregated[result.item_name].sources.push(result.source_file);
      });

      // Calculate average confidence
      Object.keys(aggregated).forEach(key => {
        const itemResults = (resultsData || []).filter(r => r.item_name === key);
        const totalConfidence = itemResults.reduce((sum, r) => sum + (r.confidence || 0), 0);
        aggregated[key].avg_confidence = totalConfidence / itemResults.length;
        aggregated[key].sources = [...new Set(aggregated[key].sources)];
      });

      setAggregatedResults(Object.values(aggregated).sort((a, b) => b.total_count - a.total_count));
      setIsLoading(false);
    };

    loadResults();
  }, [scanId, navigate, toast]);

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      // Create PDF content
      const content = `
NETTO COUNT - SCAN REPORT
========================

Date: ${scan ? new Date(scan.created_at).toLocaleString() : "N/A"}
Type: ${scan?.scan_type || "N/A"}
Total Items: ${scan?.total_items_counted || 0}

RESULTS
-------

${aggregatedResults.map(r => 
  `${r.item_name}: ${r.total_count} (Confidence: ${Math.round(r.avg_confidence * 100)}%)`
).join("\n")}

DETAILED SOURCES
----------------

${aggregatedResults.map(r => 
  `${r.item_name}:\n  Sources: ${r.sources.join(", ")}`
).join("\n\n")}
      `;

      // Create blob and download
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `netto-count-report-${scanId}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export complete",
        description: "Report downloaded as text file",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: "Could not generate the report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    const data = {
      scan: {
        id: scan?.id,
        date: scan?.created_at,
        type: scan?.scan_type,
        total_items: scan?.total_items_counted,
      },
      results: aggregatedResults.map(r => ({
        item: r.item_name,
        count: r.total_count,
        confidence: r.avg_confidence,
        sources: r.sources,
      })),
      detailed_results: results,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netto-count-${scanId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: "Data exported as JSON",
    });
  };

  const exportToCSV = () => {
    const headers = ["Item", "Count", "Confidence (%)", "Sources"];
    const rows = aggregatedResults.map(r => [
      r.item_name,
      r.total_count.toString(),
      Math.round(r.avg_confidence * 100).toString(),
      r.sources.join("; "),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netto-count-${scanId}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: "Data exported as CSV",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalCount = aggregatedResults.reduce((sum, r) => sum + r.total_count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/netto-count/scan")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Scan Results</span>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Export as PDF/Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToJSON}>
                <FileJson className="mr-2 h-4 w-4" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <ScanLine className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-3xl font-bold">{totalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Item Types</p>
                  <p className="text-3xl font-bold">{aggregatedResults.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Scan Date</p>
                  <p className="text-lg font-medium">
                    {scan ? new Date(scan.created_at).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Counting Results</CardTitle>
            <CardDescription>
              Items detected by AI analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aggregatedResults.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead>Sources</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregatedResults.map((result, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{result.item_name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          {result.total_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={result.avg_confidence >= 0.8 ? "default" : "secondary"}
                        >
                          {Math.round(result.avg_confidence * 100)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {result.sources.slice(0, 3).map((source, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {source.length > 20 ? source.slice(0, 20) + "..." : source}
                            </Badge>
                          ))}
                          {result.sources.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{result.sources.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No items were detected in this scan
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => navigate("/netto-count/scan")}>
            New Scan
          </Button>
          <Button variant="outline" onClick={() => navigate("/netto-count/history")}>
            View History
          </Button>
        </div>
      </main>
    </div>
  );
}
