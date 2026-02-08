import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera, Video, Mic, MicOff, Activity, AlertCircle, Sparkles,
  Square, RectangleHorizontal, RectangleVertical
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterCoachMarks } from "@/providers/TourProvider";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { useWebSpeech } from "@/hooks/useWebSpeech";

const aspectRatios = [
  { label: "Portrait (9:16)", value: "9:16" },
  { label: "Landscape (16:9)", value: "16:9" },
  { label: "Portrait (3:4)", value: "3:4" },
  { label: "Square (1:1)", value: "1:1" },
];

// Audio Visualizer Component (unchanged)
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

export const InterviewStudioPage: React.FC = () => {
  // Core state
  const [isRecording, setIsRecording] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [prompt, setPrompt] = useState("");
  const [scriptText, setScriptText] = useState("Hi, my name is [Name] and I'm a software engineer with a passion for building scalable web applications...");

  // Device States (retained but UI for selection moved to popover or modal if needed, simplified for main view)
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

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. AI Logic (Gemini Live)
  const { isAIActive, connect, disconnect, error: aiError } = useInterviewSession({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  });

  // 2. Metrics Logic (Web Speech)
  const { transcript, wpm, fillerWordCount } = useWebSpeech(isRecording);

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
        title: 'Start Interview',
        body: 'Click here to connect with your AI Interviewer. The session will be analyzed in real-time.'
      },
      {
        id: 'interview-script',
        selector: '[data-tour="interview-script"]',
        title: 'Studio Script',
        body: 'Paste your pitch or notes here. The script will auto-scroll as you speak.'
      },
      {
        id: 'interview-metrics',
        selector: '[data-tour="interview-metrics"]',
        title: 'Live Coaching',
        body: 'Watch these metrics! The AI Coach monitors your pacing and filler words.'
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
    };
  }, []);

  // Reinitialize stream when device selection changes
  useEffect(() => {
    if (streamInitialized && (selectedCamera || selectedMic)) {
      initializeStream();
    }
  }, [selectedCamera, selectedMic]);



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



                  {/* Camera Off State */}
                  {(!cameraEnabled) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-zinc-900 z-10">
                      <Video className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">Camera Disabled</p>
                    </div>
                  )}

                  {/* No Stream State */}
                  {!streamInitialized && cameraEnabled && (
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
                {/* Actions removed for live interview mode */}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Control Center */}
          <div className="xl:col-span-4 flex flex-col gap-3 min-h-0">

            {/* 1. STUDIO SCRIPT */}
            <Card className="flex-[1.5] bg-zinc-900/80 backdrop-blur border-white/10 overflow-hidden flex flex-col p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Studio Script</h3>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-[#1dff00] hover:text-[#1dff00] hover:bg-[#1dff00]/10 px-2">Edit</Button>
              </div>
              <div className="flex-1 bg-black/40 rounded-lg p-3 overflow-y-auto font-mono text-sm leading-relaxed text-gray-300 relative border border-white/5 data-[tour='interview-script']">
                {/* Auto-scroll overlay */}
                {/* <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" /> */}
                <Textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="w-full h-full bg-transparent border-none resize-none focus:ring-0 p-0 text-gray-300"
                  placeholder="Paste your script here..."
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">Auto-scroll enabled</span>
                  <div className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${isRecording ? 'bg-[#1dff00] justify-end' : 'bg-zinc-700 justify-start'}`}>
                    <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              </div>
            </Card>

            {/* 2. AI COACH (Live) */}
            <Card className="flex-1 bg-zinc-900/80 backdrop-blur border-[#1dff00]/20 overflow-hidden flex flex-col p-4 relative">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">AI Coach</h3>
                  {isRecording && <span className="bg-[#1dff00] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">LIVE</span>}
                </div>
              </div>

              <div className="flex gap-4">
                {/* Speaking Pace */}
                <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/5 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded bg-blue-500/20 text-blue-400"><Activity size={12} /></div>
                    <span className="text-[10px] text-gray-400">Speaking Pace</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">{wpm}</span>
                    <span className="text-[10px] text-gray-500 mb-1">wpm</span>
                    {wpm > 120 && wpm < 160 && <span className="text-[9px] text-[#1dff00] mb-1.5 ml-auto">● Optimal</span>}
                  </div>
                  <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, (wpm / 200) * 100)}%` }} />
                  </div>
                </div>

                {/* Filler Words */}
                <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/5 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded bg-yellow-500/20 text-yellow-400"><AlertCircle size={12} /></div>
                    <span className="text-[10px] text-gray-400">Filler Words</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">{fillerWordCount}</span>
                    <span className="text-[10px] text-gray-500 mb-1">detected</span>
                  </div>
                  <p className="text-[9px] text-zinc-600 mt-2 truncate">"um", "like" detected</p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-center gap-1.5 pt-2 opacity-30">
                <Sparkles size={10} />
                <span className="text-[9px] uppercase tracking-widest">Powered by Web Speech API</span>
              </div>
            </Card>

            {/* 3. METRICS */}
            <Card className="flex-[1] bg-zinc-900/80 backdrop-blur border-white/10 overflow-hidden flex flex-col p-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Eye Contact */}
                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                  <span className="text-[10px] text-gray-400 block mb-1">Eye Contact</span>
                  <span className="text-xl font-bold text-white">88%</span>
                </div>

                {/* Sentiment */}
                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                  <span className="text-[10px] text-gray-400 block mb-1">Sentiment</span>
                  <span className="text-xl font-bold text-[#1dff00]">Positive</span>
                </div>
              </div>

              {/* Clarity Score */}
              <div className="mt-3 bg-black/40 rounded-lg p-3 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 block">Clarity Score</span>
                  <span className="text-xl font-bold text-white">9.2<span className="text-sm text-zinc-600 font-normal">/10</span></span>
                </div>
                <div className="flex items-end gap-1 h-8">
                  {[40, 60, 45, 90, 100].map((h, i) => (
                    <div key={i} className={`w-1.5 rounded-sm ${i === 4 ? 'bg-[#1dff00]' : 'bg-zinc-700'}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </Card>

          </div>
        </div>
      </motion.div>
    </div>
  );
};


export default InterviewStudioPage;
