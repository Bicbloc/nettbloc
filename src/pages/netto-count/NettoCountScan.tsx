/**
 * Netto Count - Scan Page
 * Upload images/videos or use camera for AI counting
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  Camera,
  Video,
  Image as ImageIcon,
  Play,
  Pause,
  X,
  Loader2,
  Sparkles,
  Package,
  Settings,
  LogOut,
  FileImage,
  ScanLine,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ItemType {
  id: string;
  name: string;
  icon: string;
}

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  type: "image" | "video";
  status: "pending" | "processing" | "done" | "error";
}

export default function NettoCountScan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [user, setUser] = useState<any>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/netto-count/auth");
        return;
      }
      setUser(user);

      // Load item types
      const { data: items } = await supabase
        .from("netto_count_item_types")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("display_order");

      if (!items || items.length === 0) {
        navigate("/netto-count/setup");
        return;
      }

      setItemTypes(items);
      setSelectedItems(new Set(items.map(i => i.id)));
    };

    checkAuth();
  }, [navigate]);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    
    Array.from(files).forEach(file => {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      
      if (!isVideo && !isImage) return;

      const preview = URL.createObjectURL(file);
      newFiles.push({
        id: crypto.randomUUID(),
        file,
        preview,
        type: isVideo ? "video" : "image",
        status: "pending",
      });
    });

    setUploadedFiles([...uploadedFiles, ...newFiles]);
  };

  const removeFile = (id: string) => {
    const file = uploadedFiles.find(f => f.id === id);
    if (file) {
      URL.revokeObjectURL(file.preview);
    }
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setCameraStream(stream);
      setCameraActive(true);
    } catch (err) {
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedFrames([...capturedFrames, dataUrl]);
    
    toast({
      title: "Frame captured!",
      description: `${capturedFrames.length + 1} frames ready for analysis`,
    });
  };

  const analyzeImages = async () => {
    if (uploadedFiles.length === 0 && capturedFrames.length === 0) {
      toast({
        title: "No images",
        description: "Please upload images or capture frames first",
        variant: "destructive",
      });
      return;
    }

    if (selectedItems.size === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item type to count",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      // Create a scan record
      const { data: scan, error: scanError } = await supabase
        .from("netto_count_scans")
        .insert({
          user_id: user.id,
          scan_name: `Scan ${new Date().toLocaleString()}`,
          scan_type: capturedFrames.length > 0 ? "camera" : "image",
          status: "processing",
          selected_item_types: Array.from(selectedItems),
        })
        .select()
        .single();

      if (scanError) throw scanError;
      setCurrentScanId(scan.id);

      const selectedItemNames = itemTypes
        .filter(item => selectedItems.has(item.id))
        .map(item => item.name);

      // Collect all images to analyze
      const imagesToAnalyze: { base64: string; source: string }[] = [];

      // Add uploaded images
      for (const file of uploadedFiles.filter(f => f.type === "image")) {
        const base64 = await fileToBase64(file.file);
        imagesToAnalyze.push({ base64, source: file.file.name });
      }

      // Add captured frames
      capturedFrames.forEach((frame, idx) => {
        imagesToAnalyze.push({ base64: frame, source: `Camera frame ${idx + 1}` });
      });

      // Extract frames from videos
      for (const file of uploadedFiles.filter(f => f.type === "video")) {
        const frames = await extractVideoFrames(file.file, 5);
        frames.forEach((frame, idx) => {
          imagesToAnalyze.push({ base64: frame, source: `${file.file.name} - frame ${idx + 1}` });
        });
      }

      // Analyze each image
      let totalResults: Record<string, number> = {};
      
      for (let i = 0; i < imagesToAnalyze.length; i++) {
        const { base64, source } = imagesToAnalyze[i];
        setAnalysisProgress(Math.round(((i + 1) / imagesToAnalyze.length) * 100));

        const { data, error } = await supabase.functions.invoke("netto-count-analyze", {
          body: {
            imageBase64: base64,
            itemTypes: selectedItemNames,
          },
        });

        if (error) {
          console.error("Analysis error:", error);
          continue;
        }

        if (data?.counts) {
          // Aggregate results
          Object.entries(data.counts).forEach(([item, count]) => {
            totalResults[item] = (totalResults[item] || 0) + (count as number);
          });

          // Save individual results
          for (const [itemName, count] of Object.entries(data.counts)) {
            const itemType = itemTypes.find(it => it.name === itemName);
            await supabase.from("netto_count_results").insert({
              scan_id: scan.id,
              user_id: user.id,
              item_type_id: itemType?.id,
              item_name: itemName,
              count: count as number,
              confidence: data.confidence || 0.8,
              source_file: source,
            });
          }
        }
      }

      // Update scan status
      const totalCount = Object.values(totalResults).reduce((a, b) => a + b, 0);
      await supabase
        .from("netto_count_scans")
        .update({
          status: "completed",
          total_items_counted: totalCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", scan.id);

      toast({
        title: "Analysis complete!",
        description: `Found ${totalCount} items across ${imagesToAnalyze.length} images`,
      });

      // Navigate to results
      navigate(`/netto-count/results/${scan.id}`);

    } catch (err: any) {
      console.error("Analysis failed:", err);
      toast({
        title: "Analysis failed",
        description: err.message || "An error occurred during analysis",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractVideoFrames = async (file: File, numFrames: number): Promise<string[]> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const frames: string[] = [];

      video.src = URL.createObjectURL(file);
      video.muted = true;

      video.onloadedmetadata = () => {
        const duration = video.duration;
        const interval = duration / (numFrames + 1);
        let frameIndex = 0;

        const captureFrame = () => {
          if (frameIndex >= numFrames) {
            URL.revokeObjectURL(video.src);
            resolve(frames);
            return;
          }

          video.currentTime = interval * (frameIndex + 1);
        };

        video.onseeked = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          frames.push(canvas.toDataURL("image/jpeg", 0.8));
          frameIndex++;
          captureFrame();
        };

        captureFrame();
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve([]);
      };
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/netto-count/auth");
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Netto Count</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/netto-count/setup")}>
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/netto-count/history")}>
              History
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Item Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              Items to Count
            </CardTitle>
            <CardDescription>Select which items the AI should look for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {itemTypes.map(item => (
                <Badge
                  key={item.id}
                  variant={selectedItems.has(item.id) ? "default" : "outline"}
                  className="cursor-pointer py-2 px-3 text-sm"
                  onClick={() => toggleItemSelection(item.id)}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upload/Camera Tabs */}
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Files
            </TabsTrigger>
            <TabsTrigger value="camera" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Live Camera
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <FileImage className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-medium mb-1">Drop files here or click to upload</h3>
                  <p className="text-sm text-muted-foreground">
                    Supports images (JPG, PNG) and videos (MP4, MOV)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {uploadedFiles.length > 0 && (
                  <ScrollArea className="h-48 mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {uploadedFiles.map(file => (
                        <div key={file.id} className="relative group">
                          {file.type === "image" ? (
                            <img
                              src={file.preview}
                              alt="Preview"
                              className="w-full h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-24 bg-muted rounded-lg flex items-center justify-center">
                              <Video className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeFile(file.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <Badge 
                            variant="secondary" 
                            className="absolute bottom-1 left-1 text-xs"
                          >
                            {file.type === "video" ? "Video" : "Image"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="camera" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  {cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full max-h-96 rounded-lg bg-black"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                        <Button onClick={captureFrame} className="shadow-lg">
                          <Camera className="h-4 w-4 mr-2" />
                          Capture Frame
                        </Button>
                        <Button variant="destructive" onClick={stopCamera} className="shadow-lg">
                          <X className="h-4 w-4 mr-2" />
                          Stop Camera
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Camera className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-medium mb-2">Real-time Camera Scanning</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Use your camera to capture frames for analysis
                      </p>
                      <Button onClick={startCamera}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Camera
                      </Button>
                    </div>
                  )}
                </div>

                {capturedFrames.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Captured Frames ({capturedFrames.length})</h4>
                    <ScrollArea className="h-24">
                      <div className="flex gap-2">
                        {capturedFrames.map((frame, idx) => (
                          <div key={idx} className="relative flex-shrink-0">
                            <img
                              src={frame}
                              alt={`Frame ${idx + 1}`}
                              className="h-20 w-28 object-cover rounded"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-5 w-5"
                              onClick={() => setCapturedFrames(capturedFrames.filter((_, i) => i !== idx))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Analysis Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            className="px-8"
            disabled={isAnalyzing || (uploadedFiles.length === 0 && capturedFrames.length === 0)}
            onClick={analyzeImages}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing... {analysisProgress}%
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Analyze with AI
              </>
            )}
          </Button>
        </div>

        {isAnalyzing && (
          <Progress value={analysisProgress} className="w-full" />
        )}
      </main>
    </div>
  );
}
