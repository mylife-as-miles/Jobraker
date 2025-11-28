import React, { useState, useRef, useEffect } from "react";
import { Camera, Video, Download, Square, RectangleHorizontal, RectangleVertical, Mic, MicOff, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isInterviewModeOn, setIsInterviewModeOn] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    let stream: MediaStream | null = null;

    const setupCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
      }
    };

    setupCamera();

    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    let promptInterval: NodeJS.Timeout | null = null;
    if (isRecording && isInterviewModeOn) {
      fetchPrompt();
      promptInterval = setInterval(fetchPrompt, 15000);
    }
    return () => {
      if (promptInterval) clearInterval(promptInterval);
      setPrompt("");
    };
  }, [isRecording, isInterviewModeOn]);

  const handleStartRecording = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
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

  const toggleMic = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMicOn;
      });
      setIsMicOn(!isMicOn);
    }
  };

  const getAspectRatioIcon = (value: string) => {
    switch (value) {
      case "9:16": return <RectangleVertical className="w-4 h-4 mr-2 text-gray-400" />;
      case "16:9": return <RectangleHorizontal className="w-4 h-4 mr-2 text-gray-400" />;
      case "3:4": return <RectangleVertical className="w-4 h-4 mr-2 text-gray-400" />;
      case "1:1": return <Square className="w-4 h-4 mr-2 text-gray-400" />;
      default: return <RectangleHorizontal className="w-4 h-4 mr-2 text-gray-400" />;
    }
  };

  return (
    <div className="w-full h-full bg-black flex flex-col items-center justify-center p-4">
      <motion.div
        layout
        className="relative w-full max-w-5xl bg-black border border-green-900/50 rounded-xl overflow-hidden shadow-2xl shadow-green-500/10"
        style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <AnimatePresence>
          {!isRecording && videoUrl && (
            <motion.video
              key="playback"
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />

        {/* Controls Overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          {/* Top Controls */}
          <div className="flex justify-between items-center">
            <Button onClick={() => setIsSettingsOpen(!isSettingsOpen)} variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20">
              <Settings className="w-6 h-6 text-white" />
            </Button>

            {isSettingsOpen && (
              <Card className="absolute top-16 left-4 w-72 bg-gray-900/80 backdrop-blur-sm border-green-900/50 text-white">
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Video Dimensions</label>
                    <Select onValueChange={setAspectRatio} defaultValue={aspectRatio} disabled={isRecording}>
                      <SelectTrigger className="w-full bg-gray-800 border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        {aspectRatios.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            <div className="flex items-center">{getAspectRatioIcon(r.value)} {r.label}</div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center space-x-2 bg-white/10 p-2 rounded-full">
              <Switch id="interview-mode" checked={isInterviewModeOn} onCheckedChange={setIsInterviewModeOn} />
              <label htmlFor="interview-mode" className="text-sm font-medium text-white">Interview Mode</label>
            </div>
          </div>

          {/* AI Prompt */}
          <AnimatePresence>
            {isRecording && isInterviewModeOn && (
              <motion.div
                key="prompt"
                className="self-center bg-black/70 backdrop-blur-sm text-white p-3 rounded-lg text-center border border-green-500/20"
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

          {/* Bottom Controls */}
          <div className="flex justify-center items-center space-x-4">
            {videoUrl ? (
              <Button onClick={handleDownload} variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20">
                <Download className="w-6 h-6 text-white" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20">
                <Camera className="w-6 h-6 text-white" />
              </Button>
            )}

            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-500 ring-4 ring-red-300' : 'bg-white ring-4 ring-white/50'}`}
            >
              {isRecording ? <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white rounded-md"></div> : <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-500 rounded-full"></div>}
            </button>

            <Button onClick={toggleMic} variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20">
              {isMicOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InterviewStudioPage;
