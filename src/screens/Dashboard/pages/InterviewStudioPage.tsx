import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera, Video, Download, Square, RectangleHorizontal, RectangleVertical,
  Mic, MicOff, RefreshCw, Activity, AlertCircle, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterCoachMarks } from "@/providers/TourProvider";
import { useGeminiLive } from "@/hooks/useGeminiLive"; // Import the hook

const aspectRatios = [
  { label: "Portrait (9:16)", value: "9:16" },
  { label: "Landscape (16:9)", value: "16:9" },
  { label: "Portrait (3:4)", value: "3:4" },
  { label: "Square (1:1)", value: "1:1" },
];

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'so', 'right', 'well'];

// Audio Visualizer Component
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

// Format seconds to HH:MM:SS
const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

interface SpeechMetrics {
  wordCount: number;
  fillerCount: number;
  fillerWords: Record<string, number>;
  transcription: string;
  confidenceScore: number;
  wordsPerMinute: number;
}

export const InterviewStudioPage: React.FC = () => {
  // Core state
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [prompt, setPrompt] = useState("");
  // const [isFetchingPrompt, setIsFetchingPrompt] = useState(false); // Unused
  const [activeTab, setActiveTab] = useState("settings");
  const [scriptText, setScriptText] = useState("Hi, my name is [Name] and I'm a software engineer with a passion for building scalable web applications...");

  // Device States
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceOption[]>([]);
  const [micDevices, setMicDevices] = useState<MediaDeviceOption[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [streamInitialized, setStreamInitialized] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Speech analysis state
  const [metrics, setMetrics] = useState<SpeechMetrics>({
    wordCount: 0,
    fillerCount: 0,
    fillerWords: {},
    transcription: "",
    confidenceScore: 0,
    wordsPerMinute: 0,
  });
  const recognitionRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Gemini Live Hook
  const { isConnected, isAIActive, error: liveError, connect, disconnect } = useGeminiLive({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    onAIStateChange: (active) => {
      // Optional: Update UI based on AI speaking state
    }
  });

  // Register coach marks for guided tours
  useRegisterCoachMarks({
    page: 'interview-studio',
    marks: [
      {
        id: 'interview-viewfinder',
        selector: '[data-tour="interview-viewfinder"]',
        title: 'Camera Preview',
        body: 'This is your camera preview. Position yourself in the frame and check your lighting before recording.'
      },
      {
        id: 'interview-record-btn',
        selector: '[data-tour="interview-record-btn"]',
        title: 'Record Button',
        body: 'Click this button to start recording. Click again to stop. Your video will be available for playback and download.'
      },
      {
        id: 'interview-settings',
        selector: '[data-tour="interview-settings"]',
        title: 'Studio Settings',
        body: 'Configure your frame settings, select devices, and view AI coaching status here.'
      },
      {
        id: 'interview-metrics',
        selector: '[data-tour="interview-metrics"]',
        title: 'Live Metrics',
        body: 'During recording, AI analyzes your speech in real-time. View confidence scores, words per minute, and filler word usage.'
      }
    ]
  });

  // Enumerate available media devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 4)}` }));
      const mics = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 4)}` }));

      setCameraDevices(cameras);
      setMicDevices(mics);

      if (cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(cameras[0].deviceId);
      }
      if (mics.length > 0 && !selectedMic) {
        setSelectedMic(mics[0].deviceId);
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, [selectedCamera, selectedMic]);

  // Initialize camera stream
  const initializeStream = useCallback(async () => {
    try {
      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStreamInitialized(true);
      setPermissionError(null);

      // Re-enumerate to get proper labels after permission granted
      await enumerateDevices();
    } catch (err: any) {
      console.error("Camera access error:", err);
      setPermissionError(err.name === 'NotAllowedError'
        ? 'Camera/microphone access denied. Please allow access in your browser settings.'
        : 'Could not access camera/microphone. Please check your device connections.'
      );
      setStreamInitialized(false);
    }
  }, [selectedCamera, selectedMic, enumerateDevices]);

  // Initialize on mount
  useEffect(() => {
    enumerateDevices();
    initializeStream();

    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Reinitialize stream when device selection changes
  useEffect(() => {
    if (streamInitialized && (selectedCamera || selectedMic)) {
      initializeStream();
    }
  }, [selectedCamera, selectedMic]);

  // Initialize Web Speech API
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        const words = finalTranscript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const newFillerWords: Record<string, number> = {};
        let fillerCount = 0;

        words.forEach(word => {
          if (FILLER_WORDS.includes(word)) {
            newFillerWords[word] = (newFillerWords[word] || 0) + 1;
            fillerCount++;
          }
        });

        const elapsedMinutes = (Date.now() - recordingStartTimeRef.current) / 60000;
        const wpm = elapsedMinutes > 0 ? Math.round(words.length / elapsedMinutes) : 0;

        setMetrics(prev => ({
          wordCount: prev.wordCount + words.length,
          fillerCount: prev.fillerCount + fillerCount,
          fillerWords: { ...prev.fillerWords, ...newFillerWords },
          transcription: prev.transcription + finalTranscript,
          confidenceScore: Math.max(0, 100 - (fillerCount * 5)),
          wordsPerMinute: wpm,
        }));
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    return recognition;
  }, []);

  // Fetch interview prompts
  const fetchPrompt = async () => {
    // setIsFetchingPrompt(true);
    try {
      setTimeout(() => {
        const prompts = [
          "What is your greatest professional achievement?",
          "Describe a time you had to handle a conflict.",
          "Why do you want to work for this company?",
          "What motivates you to work hard?",
          "Tell me about a challenging project you completed.",
          "How do you handle tight deadlines?",
          "Describe your ideal work environment.",
          "What are your long-term career goals?",
        ];
        setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
        // setIsFetchingPrompt(false);
      }, 1000);
    } catch (error) {
      console.error("Error fetching prompt:", error);
      setPrompt("Tell me about yourself.");
      // setIsFetchingPrompt(false);
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
      if (!isRecording) setPrompt("");
    };
  }, [isRecording]);

  // Start Interview (Connect to Gemini Live)
  const handleStartRecording = async () => {
    try {
      if (!streamRef.current) {
        await initializeStream();
      }

      if (!streamRef.current) {
        setPermissionError('Could not access camera/microphone');
        return;
      }

      // Start timer
      setElapsedSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

      // Connect to Gemini Live
      await connect();
      setIsRecording(true);
      setActiveTab("analysis");
    } catch (err) {
      console.error("Connection error:", err);
      setPermissionError('Failed to start interview');
    }
  };

  // Stop Interview
  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    disconnect();
    setIsRecording(false);
  };

  // Toggle mic during preview (not recording)
  const toggleMic = () => {
    if (streamRef.current && !isRecording) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !micEnabled;
      });
    }
    setMicEnabled(!micEnabled);
  };

  // Toggle camera during preview
  const toggleCamera = () => {
    if (streamRef.current && !isRecording) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !cameraEnabled;
      });
    }
    setCameraEnabled(!cameraEnabled);
  };

  // Download recorded video
  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `jobraker-interview-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Retake - clear video and reset
  const handleRetake = () => {
    setVideoUrl(null);
    setElapsedSeconds(0);
    setMetrics({
      wordCount: 0,
      fillerCount: 0,
      fillerWords: {},
      transcription: "",
      confidenceScore: 0,
      wordsPerMinute: 0,
    });
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

  const getFillerLevel = (count: number): string => {
    if (count === 0) return "None";
    if (count <= 3) return "Low";
    if (count <= 7) return "Moderate";
    return "High";
  };

  const getFillerLevelColor = (count: number): string => {
    if (count === 0) return "text-[#1dff00]";
    if (count <= 3) return "text-[#1dff00]";
    if (count <= 7) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="h-full bg-black text-white overflow-hidden flex flex-col">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(29,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(29,255,0,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 relative z-10"
      >
        {/* Header */}
        <header className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#1dff00] rounded-full shadow-[0_0_10px_#1dff00]" />
              Interview Studio
            </h1>
            <p className="text-gray-400 text-xs pl-5">Refine your delivery with AI-powered analysis.</p>
          </div>

          <div className="flex items-center gap-4">
            {isRecording ? (
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`flex items-center gap-2 px-3 py-1 rounded-full border font-mono text-[10px] uppercase ${isAIActive ? 'bg-[#1dff00]/10 border-[#1dff00]/30 text-[#1dff00]' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isAIActive ? 'bg-[#1dff00]' : 'bg-red-500'}`} />
                {isAIActive ? 'AI SPEAKING' : `LIVE ${formatTime(elapsedSeconds)}`}
              </motion.div>
            ) : (
              <div className="text-gray-500 font-mono text-[10px] uppercase">Ready to Record</div>
            )}
          </div>
        </header>

        {/* Permission Error Banner */}
        {permissionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{permissionError}</p>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={initializeStream}
            >
              Retry
            </Button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 h-[calc(100%-80px)]">

          {/* LEFT COLUMN - Viewfinder */}
          <div className="xl:col-span-8 flex flex-col gap-3">

            {/* Main Viewport */}
            <div
              className="relative flex-1 bg-black rounded-xl border border-white/10 overflow-hidden shadow-2xl group min-h-0"
              data-tour="interview-viewfinder"
            >

              {/* Cornerstone Markers (Viewfinder Aesthetic) */}
              <div className="absolute top-3 left-3 w-4 h-4 border-l-2 border-t-2 border-white/30 rounded-tl-sm z-10" />
              <div className="absolute top-3 right-3 w-4 h-4 border-r-2 border-t-2 border-white/30 rounded-tr-sm z-10" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-l-2 border-b-2 border-white/30 rounded-bl-sm z-10" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-r-2 border-b-2 border-white/30 rounded-br-sm z-10" />

              {/* Center Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-10">
                <div className="w-8 h-[1px] bg-white" />
                <div className="h-8 w-[1px] bg-white -ml-[1px]" />
              </div>

              {/* Aspect Ratio Container */}
              <div className="w-full h-full flex items-center justify-center p-4 bg-[#050505]">
                <motion.div
                  layout
                  className="relative bg-zinc-900 border border-white/5 rounded-lg overflow-hidden shadow-lg w-full h-full max-w-full"
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
                      <Video className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">Camera Disabled</p>
                    </div>
                  )}

                  {/* No Stream State */}
                  {!streamInitialized && !videoUrl && cameraEnabled && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-zinc-900 z-10">
                      <Camera className="w-8 h-8 mb-2 opacity-50 animate-pulse" />
                      <p className="text-xs">Initializing camera...</p>
                    </div>
                  )}

                  {/* Teleprompter Overlay */}
                  <AnimatePresence>
                    {isRecording && prompt && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 text-center z-30"
                      >
                        <h3 className="text-base md:text-lg font-medium text-white drop-shadow-md">
                          "{prompt}"
                        </h3>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="h-16 bg-zinc-900/50 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-between px-4 sm:px-6 shrink-0">

              <div className="flex items-center gap-3">
                <AudioVisualizer isActive={isRecording && micEnabled} />
                <div className="h-6 w-[1px] bg-white/10 mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMic}
                  disabled={isRecording}
                  className={`h-8 w-8 rounded-full ${!micEnabled ? 'text-red-500 bg-red-500/10' : 'text-gray-400 hover:text-white'}`}
                >
                  {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCamera}
                  disabled={isRecording}
                  className={`h-8 w-8 rounded-full ${!cameraEnabled ? 'text-red-500 bg-red-500/10' : 'text-gray-400 hover:text-white'}`}
                >
                  {cameraEnabled ? <Camera size={16} /> : <AlertCircle size={16} />}
                </Button>
              </div>

              {/* Center Record Button */}
              <div className="relative" data-tour="interview-record-btn">
                {isRecording && (
                  <div className="absolute inset-0 bg-red-500/30 blur-xl rounded-full animate-pulse" />
                )}

                {isRecording ? (
                  <Button
                    onClick={handleStopRecording}
                    className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 z-10"
                  >
                    <Square fill="currentColor" size={20} />
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartRecording}
                    disabled={!streamInitialized}
                    className="w-12 h-12 rounded-full bg-[#1dff00] hover:bg-[#1dff00]/90 text-black flex items-center justify-center shadow-[0_0_20px_rgba(29,255,0,0.3)] hover:shadow-[0_0_30px_rgba(29,255,0,0.5)] transition-all hover:scale-105 active:scale-95 z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-4 h-4 bg-black rounded-full" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!videoUrl}
                  className="text-gray-400 hover:text-white gap-1.5 h-8 text-xs"
                  onClick={handleRetake}
                >
                  <RefreshCw size={14} /> Retake
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!videoUrl}
                  onClick={handleDownload}
                  className="border-[#1dff00]/30 hover:bg-[#1dff00]/10 text-[#1dff00] gap-1.5 rounded-lg h-8 text-xs"
                >
                  <Download size={14} /> Save
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Control Center */}
          <div className="xl:col-span-4 flex flex-col gap-4 min-h-0">
            <Card className="flex-1 bg-zinc-900/50 backdrop-blur border-white/5 overflow-hidden flex flex-col min-h-0" data-tour="interview-settings">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="px-4 pt-4 pb-1">
                  <TabsList className="grid w-full grid-cols-3 bg-white/5 h-9 p-1 rounded-lg">
                    <TabsTrigger value="settings" className="data-[state=active]:bg-zinc-800 rounded-md text-[10px] uppercase font-bold tracking-wider">Studio</TabsTrigger>
                    <TabsTrigger value="script" className="data-[state=active]:bg-zinc-800 rounded-md text-[10px] uppercase font-bold tracking-wider">Script</TabsTrigger>
                    <TabsTrigger value="analysis" className="data-[state=active]:bg-zinc-800 rounded-md text-[10px] uppercase font-bold tracking-wider" data-tour="interview-metrics">Metrics</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pt-3">
                  <TabsContent value="settings" className="mt-0 space-y-4">
                    <div className="space-y-3">
                      {/* Aspect Ratio */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Frame Settings</label>
                        <Select onValueChange={setAspectRatio} defaultValue={aspectRatio} disabled={isRecording}>
                          <SelectTrigger className="w-full h-9 bg-black/40 border-white/10 text-white rounded-lg focus:ring-[#1dff00]/50 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                            {aspectRatios.map((r) => (
                              <SelectItem key={r.value} value={r.value} className="text-xs">
                                <div className="flex items-center">{getAspectRatioIcon(r.value)} {r.label}</div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Camera Selection */}
                      {cameraDevices.length > 0 && (
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Camera</label>
                          <Select value={selectedCamera} onValueChange={setSelectedCamera} disabled={isRecording}>
                            <SelectTrigger className="w-full h-9 bg-black/40 border-white/10 text-white rounded-lg focus:ring-[#1dff00]/50 text-xs">
                              <SelectValue placeholder="Select camera" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                              {cameraDevices.map((device) => (
                                <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs">
                                  {device.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Microphone Selection */}
                      {micDevices.length > 0 && (
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Microphone</label>
                          <Select value={selectedMic} onValueChange={setSelectedMic} disabled={isRecording}>
                            <SelectTrigger className="w-full h-9 bg-black/40 border-white/10 text-white rounded-lg focus:ring-[#1dff00]/50 text-xs">
                              <SelectValue placeholder="Select microphone" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                              {micDevices.map((device) => (
                                <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs">
                                  {device.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* AI Coach Status */}
                      <div className="p-3 rounded-lg bg-[#1dff00]/5 border border-[#1dff00]/10 space-y-2">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 bg-[#1dff00]/10 rounded-md text-[#1dff00]">
                            <Sparkles size={14} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">AI Coach Active</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                              JobRaker uses Web Speech API to analyze your pacing, tone, and filler words in real-time.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="script" className="mt-0 h-full flex flex-col">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Teleprompter Text</label>
                    <Textarea
                      value={scriptText}
                      onChange={(e) => setScriptText(e.target.value)}
                      className="flex-1 min-h-[200px] bg-black/40 border-white/10 resize-none text-sm leading-relaxed p-3 rounded-lg focus:border-[#1dff00]/50"
                      placeholder="Paste your pitch or interview answers here..."
                    />
                  </TabsContent>

                  <TabsContent value="analysis" className="mt-0 space-y-4">
                    {!videoUrl && !isRecording ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                        <Activity size={32} className="mb-3 opacity-20" />
                        <p className="text-xs">Start recording for real-time metrics.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Confidence Score */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Confidence Score</span>
                            <span className="text-[#1dff00]">{metrics.confidenceScore}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${metrics.confidenceScore}%` }}
                              className="h-full bg-[#1dff00] rounded-full"
                            />
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                            <div className="text-lg font-bold text-white mb-0.5">{metrics.wordsPerMinute || '—'}</div>
                            <div className="text-[9px] uppercase tracking-wide text-gray-500">Words / Min</div>
                          </div>
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                            <div className={`text-lg font-bold mb-0.5 ${getFillerLevelColor(metrics.fillerCount)}`}>
                              {getFillerLevel(metrics.fillerCount)}
                            </div>
                            <div className="text-[9px] uppercase tracking-wide text-gray-500">Fillers ({metrics.fillerCount})</div>
                          </div>
                        </div>

                        {/* Word Count */}
                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Total Words Spoken</span>
                            <span className="text-sm font-bold text-white">{metrics.wordCount}</span>
                          </div>
                        </div>

                        {/* Filler Words Breakdown */}
                        {Object.keys(metrics.fillerWords).length > 0 && (
                          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <h4 className="text-xs font-bold text-yellow-400 mb-2">Filler Words Detected</h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(metrics.fillerWords).map(([word, count]) => (
                                <Badge key={word} variant="outline" className="border-yellow-500/30 text-yellow-400 text-[10px]">
                                  "{word}" × {count}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recording Duration */}
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <h4 className="text-xs font-bold text-blue-400 mb-1.5">Recording Duration</h4>
                          <p className="text-2xl font-mono text-white">
                            {formatTime(elapsedSeconds)}
                          </p>
                        </div>

                        {/* Feedback */}
                        {!isRecording && videoUrl && (
                          <div className="p-3 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/20">
                            <h4 className="text-xs font-bold text-[#1dff00] mb-1.5">AI Feedback</h4>
                            <p className="text-[10px] text-gray-300 leading-relaxed">
                              {metrics.fillerCount === 0
                                ? "Excellent! No filler words detected. Your delivery was clean and professional."
                                : metrics.fillerCount <= 3
                                  ? "Good job! Very few filler words used. Try to be mindful of minor pauses."
                                  : metrics.fillerCount <= 7
                                    ? "Watch out for filler words like 'um' and 'like'. Practice pausing silently instead."
                                    : "Consider slowing down. High filler word usage can reduce your perceived confidence."
                              }
                            </p>
                          </div>
                        )}
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
