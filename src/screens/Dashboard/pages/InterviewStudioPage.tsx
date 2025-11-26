import React, { useState, useRef, useEffect } from "react";
import { Camera, Video, Download, Square, RectangleHorizontal, RectangleVertical, AspectRatio, Sparkles, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabaseClient";

const supabase = createClient();

const aspectRatios = [
  { label: "Portrait (9:16)", value: "9:16" },
  { label: "Landscape (16:9)", value: "16:9" },
  { label: "Portrait (3:4)", value: "3:4" },
  { label: "Square (1:1)", value: "1:1" },
];

export const InterviewStudioPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [prompt, setPrompt] = useState("");
  const [isFetchingPrompt, setIsFetchingPrompt] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const fetchPrompt = async () => {
    setIsFetchingPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-interview-prompt", {
        body: { previousPrompt: prompt },
      });

      if (error) throw error;
      if (data.prompt) setPrompt(data.prompt);
    } catch (error) {
      console.error("Error fetching prompt:", error);
      setPrompt("What is your greatest professional achievement?");
    } finally {
      setIsFetchingPrompt(false);
    }
  };

  useEffect(() => {
    let promptInterval: NodeJS.Timeout | null = null;
    if (isRecording) {
      fetchPrompt();
      promptInterval = setInterval(fetchPrompt, 15000);
    }
    return () => {
      if (promptInterval) clearInterval(promptInterval);
      setPrompt("");
    };
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoRef.current!.srcObject = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        setVideoUrl(URL.createObjectURL(blob));
        recordedChunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
        videoRef.current!.srcObject = null;
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setVideoUrl(null);
    } catch (err) {
      console.error("Camera access error:", err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "jobraker-interview.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(videoUrl);
  };

  const getAspectRatioIcon = (value: string) => {
    switch (value) {
      case "9:16": return <RectangleVertical className="w-4 h-4 mr-2 text-gray-400" />;
      case "16:9": return <RectangleHorizontal className="w-4 h-4 mr-2 text-gray-400" />;
      case "3:4": return <RectangleVertical className="w-4 h-4 mr-2 text-gray-400" />;
      case "1:1": return <Square className="w-4 h-4 mr-2 text-gray-400" />;
      default: return <AspectRatio className="w-4 h-4 mr-2 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-full bg-black text-white p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-300 via-green-400 to-green-500 bg-clip-text text-transparent">Interview Studio</h1>
            <p className="text-gray-400 mt-1">Record, refine, and ace your next interview.</p>
          </div>
          {isRecording && <Badge variant="destructive" className="mt-2 sm:mt-0 animate-pulse"><div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>Recording Live</Badge>}
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 w-full">
            <motion.div layout className="relative bg-black border border-green-900/50 rounded-xl overflow-hidden shadow-2xl shadow-green-500/10" style={{ aspectRatio: aspectRatio.replace(":", " / ") }}>
              <AnimatePresence>
                {!isRecording && videoUrl && (
                  <motion.video key="playback" src={videoUrl} controls className="w-full h-full object-contain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                )}
              </AnimatePresence>
              <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-contain transition-opacity duration-300 ${isRecording ? "opacity-100" : "opacity-0"}`} />
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    key="prompt"
                    className="absolute bottom-5 left-5 right-5 bg-black/70 backdrop-blur-sm text-white p-3 rounded-lg text-center border border-green-500/20"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    {isFetchingPrompt ? (
                      <p className="text-sm sm:text-base font-medium text-gray-400 italic">Thinking of the next question...</p>
                    ) : (
                      <p className="text-sm sm:text-base font-medium">{prompt}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="w-full">
            <Card className="bg-[#0a0a0a] border-green-900/50">
              <CardHeader>
                <CardTitle className="text-green-400">Recording Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Video Dimensions</label>
                  <Select onValueChange={setAspectRatio} defaultValue={aspectRatio} disabled={isRecording}>
                    <SelectTrigger className="w-full bg-gray-900 border-gray-700 hover:border-green-500 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-white">
                      {aspectRatios.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <div className="flex items-center">{getAspectRatioIcon(r.value)} {r.label}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col space-y-3">
                  {isRecording ? (
                    <Button onClick={handleStopRecording} variant="destructive" size="lg" className="hover:scale-105 transition-transform">
                      <Video className="w-5 h-5 mr-2" /> Stop Recording
                    </Button>
                  ) : (
                    <Button onClick={handleStartRecording} size="lg" className="bg-green-600 text-black hover:bg-green-500 hover:scale-105 transition-transform">
                      <Camera className="w-5 h-5 mr-2" /> Start Recording
                    </Button>
                  )}
                  <Button onClick={handleDownload} disabled={!videoUrl || isRecording} variant="outline" size="lg" className="border-green-700 hover:bg-green-900/50 hover:text-white hover:scale-105 transition-transform">
                    <Download className="w-5 h-5 mr-2" /> Download WEBM
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InterviewStudioPage;
