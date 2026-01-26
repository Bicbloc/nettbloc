/**
 * Netto Count - History Page
 * View past scans and their results
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Calendar,
  Package,
  ScanLine,
  ChevronRight,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Video,
  Camera,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Scan {
  id: string;
  scan_name: string;
  scan_type: string;
  status: string;
  total_items_counted: number;
  created_at: string;
  completed_at: string | null;
}

export default function NettoCountHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [scans, setScans] = useState<Scan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/netto-count/auth");
      return;
    }

    const { data, error } = await supabase
      .from("netto_count_scans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading scans:", error);
      toast({
        title: "Error",
        description: "Could not load scan history",
        variant: "destructive",
      });
    }

    setScans(data || []);
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);

    try {
      // Delete results first (cascade should handle this, but just in case)
      await supabase
        .from("netto_count_results")
        .delete()
        .eq("scan_id", deleteId);

      // Delete scan
      const { error } = await supabase
        .from("netto_count_scans")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setScans(scans.filter(s => s.id !== deleteId));
      toast({
        title: "Scan deleted",
        description: "The scan has been removed from your history",
      });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message || "Could not delete the scan",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const getScanTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4" />;
      case "camera":
        return <Camera className="h-4 w-4" />;
      default:
        return <ImageIcon className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case "processing":
        return <Badge variant="secondary">Processing</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
              <span className="font-bold text-lg">Scan History</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {scans.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <ScanLine className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No scans yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by uploading images or using your camera to count items
              </p>
              <Button onClick={() => navigate("/netto-count/scan")}>
                Start Scanning
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-3">
              {scans.map(scan => (
                <Card 
                  key={scan.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/netto-count/results/${scan.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {getScanTypeIcon(scan.scan_type)}
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {scan.scan_name || `Scan ${new Date(scan.created_at).toLocaleDateString()}`}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(scan.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {getStatusBadge(scan.status)}
                        
                        {scan.status === "completed" && (
                          <Badge variant="secondary" className="text-lg px-3">
                            {scan.total_items_counted} items
                          </Badge>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(scan.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The scan and all its results will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
