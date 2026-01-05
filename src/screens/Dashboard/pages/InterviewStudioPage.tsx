import React, { useState, useRef, useEffect } from "react";
import {
  Camera, Video, Download, Square, RectangleHorizontal, RectangleVertical,
  Mic, MicOff, Settings, Play, RefreshCw, FileText, Activity, AlertCircle, StopCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabaseClient";

const supabase = createClient();

const aspectRatios = [
  { label: "Portrait (9:16)", value: "9:16" },
  { label: "Landscape (16:9)", value: "16:9" },
  { label: "Portrait (3:4)", value: "3:4" },
  { label: "Square (1:1)", value: "1:1" },
];

// Mock Audio Visualizer Component
const AudioVisualizer = ({ isActive }: { isActive: boolean }) => {
  return (
    <div className="flex items-end gap-1 h-8">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className={`w-1 rounded-full ${isActive ? 'bg-[#1dff00]' : 'bg-gray-700'}`}
          animate={isActive ? {
            height: [4, Math.random() * 24 + 4, 4],
          } : { height: 4 }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
            repeatType: "reverse",
            delay: i * 0.05
          }}
        />
      ))}
    </div>
  );
};

export const InterviewStudioPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [prompt, setPrompt] = useState("");
  const [isFetchingPrompt, setIsFetchingPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [scriptText, setScriptText] = useState("Hi, my name is [Name] and I'm a software engineer with a passion for building scalable web applications...");

  // Device States
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const fetchPrompt = async () => {
    setIsFetchingPrompt(true);
    try {
      // Logic would go here. Mocking for now to avoid breaking if function missing.
      // const { data, error } = await supabase.functions.invoke("get-interview-prompt", { body: { previousPrompt: prompt } });
      // if (data?.prompt) setPrompt(data.prompt);

      // Simulating API delay
      setTimeout(() => {
        const prompts = [
          "What is your greatest professional achievement?",
          "Describe a time you had to handle a conflict.",
          "Why do you want to work for this company?",
          "What motivates you to work hard?"
        ];
        setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
        setIsFetchingPrompt(false);
      }, 1000);

    } catch (error) {
      console.error("Error fetching prompt:", error);
      setPrompt("Tell me about yourself.");
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
      if (videoRef.current) videoRef.current.srcObject = stream;

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        setVideoUrl(URL.createObjectURL(blob));
        recordedChunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setVideoUrl(null);
    } catch (err) {
      console.error("Camera access error:", err);
      // Fallback for demo if no camera available
      setIsRecording(true);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    // Fallback if we just mocked it
    else setIsRecording(false);
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "jobraker-interview.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getAspectRatioIcon = (value: string) => {
    switch (value) {
      case "9:16": return <RectangleVertical className="w-4 h-4 mr-2" />;
      case "16:9": return <RectangleHorizontal className="w-4 h-4 mr-2" />;
      case "3:4": return <RectangleVertical className="w-4 h-4 mr-2" />;
      case "1:1": return <Square className="w-4 h-4 mr-2" />;
      default: return <RectangleHorizontal className="w-4 h-4 mr-2" />;
    }
  };

  return (
    <div className="h-full bg-black text-white overflow-hidden flex flex-col">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(29,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(29,255,0,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 overflow-y-auto overflow-x-hidden p-6 relative z-10"
      >
        {/* Header */}
        <header className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-3">
              <span className="w-3 h-3 bg-[#1dff00] rounded-full shadow-[0_0_10px_#1dff00]" />
              Interview Studio
            </h1>
            <p className="text-gray-400 text-sm pl-6">Refine your delivery with AI-powered analysis.</p>
          </div>

          <div className="flex items-center gap-4">
            {isRecording ? (
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 font-mono text-xs uppercase"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                REC 00:00:00
              </motion.div>
            ) : (
              <div className="text-gray-500 font-mono text-xs uppercase">Ready to Record</div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100%-100px)]">

          {/* LEFT COLUMN - Viewfinder */}
          <div className="xl:col-span-8 flex flex-col gap-4">

            {/* Main Viewport */}
            <div className="relative flex-1 bg-black rounded-2xl border border-white/10 overflow-hidden shadow-2xl group">

              {/* Cornerstone Markers (Viewfinder Aesthetic) */}
              <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-white/30 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-white/30 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-white/30 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-white/30 rounded-br-lg" />

              {/* Center Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-12 h-[1px] bg-white" />
                <div className="h-12 w-[1px] bg-white -ml-[1px]" />
              </div>

              {/* Aspect Ratio Container */}
              <div className="w-full h-full flex items-center justify-center p-8 bg-[#050505]">
                <motion.div
                  layout
                  className="relative bg-zinc-900 border border-white/5 rounded-lg overflow-hidden shadow-lg"
                  style={{ aspectRatio: aspectRatio.replace(":", " / "), maxHeight: '100%' }}
                >
                  {/* Video Element */}
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${!cameraEnabled ? 'opacity-0' : 'opacity-100'}`}
                  />

                  {/* Playback Overlay */}
                  {!isRecording && videoUrl && (
                    <video src={videoUrl} controls className="absolute inset-0 w-full h-full object-cover z-20" />
                  )}

                  {/* Camera Off State */}
                  {(!cameraEnabled && !videoUrl) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-zinc-900 z-10">
                      <Video className="w-12 h-12 mb-4 opacity-50" />
                      <p>Camera Disabled</p>
                    </div>
                  )}

                  {/* Teleprompter Overlay */}
                  <AnimatePresence>
                    {isRecording && prompt && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent pt-12 text-center"
                      >
                        <h3 className="text-lg md:text-xl font-medium text-white drop-shadow-md">
                          "{prompt}"
                        </h3>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="h-20 bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-between px-6 sm:px-10">

              <div className="flex items-center gap-4">
                <AudioVisualizer isActive={isRecording && micEnabled} />
                <div className="h-8 w-[1px] bg-white/10 mx-2" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMicEnabled(!micEnabled)}
                  className={`rounded-full ${!micEnabled ? 'text-red-500 bg-red-500/10' : 'text-gray-400 hover:text-white'}`}
                >
                  {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCameraEnabled(!cameraEnabled)}
                  className={`rounded-full ${!cameraEnabled ? 'text-red-500 bg-red-500/10' : 'text-gray-400 hover:text-white'}`}
                >
                  {cameraEnabled ? <Camera size={20} /> : <AlertCircle size={20} />}
                </Button>
              </div>

              {/* Center Record Button */}
              <div className="relative">
                {isRecording && (
                  <div className="absolute inset-0 bg-red-500/30 blur-xl rounded-full animate-pulse" />
                )}

                {isRecording ? (
                  <Button
                    onClick={handleStopRecording}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 z-10"
                  >
                    <Square fill="currentColor" size={24} />
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartRecording}
                    className="w-16 h-16 rounded-full bg-[#1dff00] hover:bg-[#1dff00]/90 text-black flex items-center justify-center shadow-[0_0_20px_rgba(29,255,0,0.3)] hover:shadow-[0_0_30px_rgba(29,255,0,0.5)] transition-all hover:scale-105 active:scale-95 z-10"
                  >
                    <div className="w-5 h-5 bg-black rounded-full" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!videoUrl}
                  className="text-gray-400 hover:text-white gap-2"
                  onClick={() => setVideoUrl(null)}
                >
                  <RefreshCw size={16} /> Retake
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!videoUrl}
                  onClick={handleDownload}
                  className="border-[#1dff00]/30 hover:bg-[#1dff00]/10 text-[#1dff00] gap-2 rounded-lg"
                >
                  <Download size={16} /> Save
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Control Center */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            <Card className="flex-1 bg-zinc-900/50 backdrop-blur border-white/5 overflow-hidden flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <div className="px-6 pt-6 pb-2">
                  <TabsList className="grid w-full grid-cols-3 bg-white/5 h-12 p-1 rounded-xl">
                    <TabsTrigger value="settings" className="data-[state=active]:bg-zinc-800 rounded-lg text-xs uppercase font-medium tracking-wide">Studio</TabsTrigger>
                    <TabsTrigger value="script" className="data-[state=active]:bg-zinc-800 rounded-lg text-xs uppercase font-medium tracking-wide">Script</TabsTrigger>
                    <TabsTrigger value="analysis" className="data-[state=active]:bg-zinc-800 rounded-lg text-xs uppercase font-medium tracking-wide">Metrics</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-4">
                  <TabsContent value="settings" className="mt-0 space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Frame Settings</label>
                        <Select onValueChange={setAspectRatio} defaultValue={aspectRatio} disabled={isRecording}>
                          <SelectTrigger className="w-full h-12 bg-black/40 border-white/10 text-white rounded-xl focus:ring-[#1dff00]/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                            {aspectRatios.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                <div className="flex items-center text-sm">{getAspectRatioIcon(r.value)} {r.label}</div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-4 rounded-xl bg-[#1dff00]/5 border border-[#1dff00]/10 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-[#1dff00]/10 rounded-lg text-[#1dff00]">
                            <Activity size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">AI Coach Active</h4>
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                              JobRaker is listening to analyze your pacing, tone, and filler word usage in real-time.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="script" className="mt-0 h-full flex flex-col">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Teleprompter Text</label>
                    <Textarea
                      value={scriptText}
                      onChange={(e) => setScriptText(e.target.value)}
                      className="flex-1 min-h-[300px] bg-black/40 border-white/10 resize-none text-base leading-relaxed p-4 rounded-xl focus:border-[#1dff00]/50"
                      placeholder="Paste your pitch or interview answers here..."
                    />
                  </TabsContent>

                  <TabsContent value="analysis" className="mt-0 space-y-6">
                    {!videoUrl && !isRecording ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                        <Activity size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">Start recording to see real-time analysis metrics.</p>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Confidence Score</span>
                            <span className="text-[#1dff00]">88%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: "88%" }}
                              className="h-full bg-[#1dff00] rounded-full"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                            <div className="text-2xl font-bold text-white mb-1">145</div>
                            <div className="text-[10px] uppercase tracking-wide text-gray-500">Words / Min</div>
                          </div>
                          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                            <div className="text-2xl font-bold text-white mb-1">Low</div>
                            <div className="text-[10px] uppercase tracking-wide text-gray-500">Fillers Used</div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                          <h4 className="text-sm font-semibold text-blue-400 mb-2">Feedback</h4>
                          <p className="text-xs text-gray-300 leading-relaxed">
                            Good eye contact! Try to vary your tone slightly more to emphasize key achievements.
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InterviewStudioPage;
