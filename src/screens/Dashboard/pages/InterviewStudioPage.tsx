import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Camera,
  Video,
  Mic,
  MicOff,
  Activity,
  AlertCircle,
  Sparkles,
  Square,
  Settings2,
  Edit2,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRegisterCoachMarks } from "@/providers/TourProvider";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { useWebSpeech } from "@/hooks/useWebSpeech";

const AudioVisualizer = ({ isActive }: { isActive: boolean }) => {
  return (
    <div className='flex items-end gap-1 h-8'>
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className={`w-1 rounded-full ${isActive ? "bg-brand" : "bg-zinc-700"}`}
          animate={
            isActive
              ? {
                  height: [4, Math.random() * 24 + 4, 4],
                }
              : { height: 4 }
          }
          transition={{
            duration: 0.2,
            repeat: Infinity,
            repeatType: "reverse",
            delay: i * 0.05,
          }}
        />
      ))}
    </div>
  );
};

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export const InterviewStudioPage: React.FC = () => {
  // Core state
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [scriptText, setScriptText] = useState(
    "Hi, my name is [Name] and I'm a software engineer with a passion for building scalable web applications...",
  );
  const [isScriptEditing, setIsScriptEditing] = useState(false);

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

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. AI Logic (Gemini Live)
  const {
    isAIActive,
    isConnected,
    error: sessionError,
    connect,
    disconnect,
  } = useInterviewSession({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
  });

  // 2. Metrics Logic (Web Speech)
  const { transcript, wpm, fillerWordCount } = useWebSpeech(isRecording);
  const speechRecognitionSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      ("webkitSpeechRecognition" in window || "SpeechRecognition" in window),
    [],
  );
  const clarityScore = useMemo(() => {
    const fillerPenalty = Math.min(24, fillerWordCount * 4);
    const pacePenalty =
      wpm === 0 ? 12 : Math.min(18, Math.abs(wpm - 135) / 2.5);
    return Math.max(55, Math.round(100 - fillerPenalty - pacePenalty));
  }, [fillerWordCount, wpm]);
  const sentimentLabel = useMemo(() => {
    if (!isRecording) return "Waiting";
    if (fillerWordCount >= 6) return "Needs focus";
    if (wpm > 165) return "Rushed";
    return "Positive";
  }, [fillerWordCount, isRecording, wpm]);
  const eyeContactLabel = useMemo(() => {
    if (!cameraEnabled) return "Camera off";
    if (!streamInitialized) return "Initializing";
    return "Good";
  }, [cameraEnabled, streamInitialized]);

  // Register coach marks
  useRegisterCoachMarks({
    page: "interview-studio",
    marks: [
      {
        id: "interview-viewfinder",
        selector: '[data-tour="interview-viewfinder"]',
        title: "Camera Preview",
        body: "Position yourself in frame.",
      },
      {
        id: "interview-record-btn",
        selector: '[data-tour="interview-record-btn"]',
        title: "Start Interview",
        body: "Connect with your AI Interviewer.",
      },
      {
        id: "interview-script",
        selector: '[data-tour="interview-script"]',
        title: "Studio Script",
        body: "Edit and read your pitch here.",
      },
      {
        id: "interview-metrics",
        selector: '[data-tour="interview-metrics"]',
        title: "Live Coaching",
        body: "Monitor your pacing and clarity.",
      },
    ],
  });

  // Enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
        }));
      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 4)}`,
        }));
      setCameraDevices(cameras);
      setMicDevices(mics);
      if (cameras.length > 0 && !selectedCamera)
        setSelectedCamera(cameras[0].deviceId);
      if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId);
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, [selectedCamera, selectedMic]);

  // Initialize stream
  const initializeStream = useCallback(async () => {
    try {
      if (streamRef.current)
        streamRef.current.getTracks().forEach((track) => track.stop());
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStreamInitialized(true);
      setPermissionError(null);
      await enumerateDevices();
    } catch (err: any) {
      console.error("Camera access error:", err);
      setPermissionError("Camera/microphone access denied.");
      setStreamInitialized(false);
    }
  }, [selectedCamera, selectedMic, enumerateDevices]);

  // Effects
  useEffect(() => {
    enumerateDevices();
    initializeStream();
    return () => {
      if (streamRef.current)
        streamRef.current.getTracks().forEach((track) => track.stop());
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (streamInitialized && (selectedCamera || selectedMic))
      initializeStream();
  }, [selectedCamera, selectedMic]);

  useEffect(() => {
    if (sessionError) {
      setPermissionError(sessionError);
      setIsConnecting(false);
    }
  }, [sessionError]);

  useEffect(() => {
    if (!isRecording || isConnecting) return;
    if (!isConnected && sessionError) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setIsRecording(false);
    }
  }, [isConnected, isConnecting, isRecording, sessionError]);

  // Prompt rotation
  useEffect(() => {
    let promptInterval: NodeJS.Timeout | null = null;
    if (isRecording) {
      const fetchPrompt = () => {
        const prompts = [
          "What is your greatest professional achievement?",
          "Describe a time you had to handle a conflict.",
          "Why do you want to work for this company?",
          "Tell me about a challenging project you completed.",
        ];
        setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
      };
      fetchPrompt();
      promptInterval = setInterval(fetchPrompt, 15000);
    }
    return () => {
      if (promptInterval) clearInterval(promptInterval);
      if (!isRecording) setPrompt("");
    };
  }, [isRecording]);

  // Handlers
  const handleStartRecording = async () => {
    try {
      setPermissionError(null);
      setIsConnecting(true);
      if (!streamRef.current) await initializeStream();
      if (!streamRef.current) {
        setPermissionError("Could not access camera/microphone");
        setIsConnecting(false);
        return;
      }
      setElapsedSeconds(0);
      timerIntervalRef.current = setInterval(
        () => setElapsedSeconds((p) => p + 1),
        1000,
      );
      await connect();
      setIsRecording(true);
      setIsConnecting(false);
    } catch (err) {
      console.error("Connection error:", err);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setPermissionError(
        err instanceof Error ? err.message : "Failed to connect to AI server",
      );
      setIsConnecting(false);
    }
  };

  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    disconnect();
    setIsRecording(false);
    setIsConnecting(false);
  };

  const toggleMic = () => {
    if (streamRef.current && !isRecording) {
      streamRef.current.getAudioTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = !micEnabled;
      });
    }
    setMicEnabled(!micEnabled);
  };

  const toggleCamera = () => {
    if (streamRef.current && !isRecording) {
      streamRef.current.getVideoTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = !cameraEnabled;
      });
    }
    setCameraEnabled(!cameraEnabled);
  };

  return (
    <div className='h-full bg-background text-foreground overflow-hidden flex flex-col relative'>
      {/* Background Grid */}
      <div className='absolute inset-0 bg-[linear-gradient(rgba(29,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(29,255,0,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none' />

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col xl:grid xl:grid-cols-12 gap-4 p-4 min-h-0 z-10 overflow-y-auto xl:overflow-hidden'>
        {/* HEADER (Mobile Only - usually redundant if sidebar exists, but good for context) */}
        <div className='xl:col-span-12 flex items-center justify-between shrink-0 xl:mb-2'>
          <div className='flex items-center gap-2'>
            <span className='w-2 h-2 bg-brand rounded-full shadow-[0_0_8px_#1dff00]' />
            <h1 className='font-bold font-mono tracking-tight text-lg'>
              Interview Studio
            </h1>
          </div>
          {isRecording && (
            <div className='flex items-center gap-2 px-2 py-0.5 rounded-full bg-brand/10 border border-brand/30 text-brand text-[10px] uppercase font-mono'>
              <div className='w-1.5 h-1.5 rounded-full bg-brand animate-pulse' />
              {isAIActive ? "AI Speaking" : formatTime(elapsedSeconds)}
            </div>
          )}
        </div>

        {/* LEFT COLUMN: Viewfinder & Controls */}
        <div className='xl:col-span-8 flex flex-col gap-4 min-h-[50vh] xl:min-h-0'>
          {/* Viewfinder */}
          <div
            className='relative flex-1 bg-foreground/40 rounded-xl border border-foreground/10 overflow-hidden shadow-2xl group min-h-0'
            data-tour='interview-viewfinder'
          >
            {/* Cornerstone Markers */}
            <div className='absolute top-4 left-4 w-4 h-4 border-l-2 border-t-2 border-foreground/20 rounded-tl-sm z-20' />
            <div className='absolute top-4 right-4 w-4 h-4 border-r-2 border-t-2 border-foreground/20 rounded-tr-sm z-20' />
            <div className='absolute bottom-4 left-4 w-4 h-4 border-l-2 border-b-2 border-foreground/20 rounded-bl-sm z-20' />
            <div className='absolute bottom-4 right-4 w-4 h-4 border-r-2 border-b-2 border-foreground/20 rounded-br-sm z-20' />

            {/* Video Container */}
            <div className='w-full h-full flex items-center justify-center bg-background'>
              <div className='relative w-full h-full xl:max-w-[90%] xl:max-h-[95%] aspect-video rounded-lg overflow-hidden ring-1 ring-foreground/5'>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover transform ${!cameraEnabled ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
                />

                {/* States */}
                {(!cameraEnabled || !streamInitialized) && (
                  <div className='absolute inset-0 flex flex-col items-center justify-center text-foreground bg-transparent'>
                    {cameraEnabled ? (
                      <Camera className='w-10 h-10 mb-2 opacity-50 animate-pulse' />
                    ) : (
                      <Video className='w-10 h-10 mb-2 opacity-30' />
                    )}
                    <p className='text-xs font-mono'>
                      {cameraEnabled ? "INITIALIZING..." : "CAMERA OFF"}
                    </p>
                  </div>
                )}

                {/* Teleprompter Overlay */}
                <AnimatePresence>
                  {isRecording && prompt && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className='absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0 pt-12 text-center z-30'
                    >
                      <h3 className='text-lg md:text-xl font-medium text-foreground drop-shadow-lg leading-relaxed'>
                        "{prompt}"
                      </h3>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className='h-16 bg-foreground/5 backdrop-blur-md rounded-xl border border-foreground/10 flex items-center justify-between px-4 sm:px-6 shrink-0'>
            <div className='flex items-center gap-2'>
              <AudioVisualizer isActive={isRecording && micEnabled} />
              <div className='h-6 w-[1px] bg-foreground/10 mx-2' />
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleMic}
                disabled={isRecording}
                className={`h-9 w-9 rounded-full ${!micEnabled ? "bg-brand/10 text-brand" : "text-foreground hover:text-foreground hover:bg-foreground/5"}`}
              >
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleCamera}
                disabled={isRecording}
                className={`h-9 w-9 rounded-full ${!cameraEnabled ? "bg-brand/10 text-brand" : "text-foreground hover:text-foreground hover:bg-foreground/5"}`}
              >
                {cameraEnabled ? <Camera size={18} /> : <Video size={18} />}
              </Button>

              {/* Settings Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    disabled={isRecording}
                    className='h-9 w-9 rounded-full text-foreground hover:text-foreground hover:bg-foreground/5'
                  >
                    <Settings2 size={18} />
                  </Button>
                </DialogTrigger>
                <DialogContent className='bg-zinc-900 border-zinc-800 text-foreground'>
                  <DialogHeader>
                    <DialogTitle>Device Settings</DialogTitle>
                  </DialogHeader>
                  <div className='space-y-4 py-4'>
                    <div className='space-y-2'>
                      <Label>Camera</Label>
                      <Select
                        value={selectedCamera}
                        onValueChange={setSelectedCamera}
                      >
                        <SelectTrigger className='bg-zinc-800 border-zinc-700'>
                          <SelectValue placeholder='Select Camera' />
                        </SelectTrigger>
                        <SelectContent className='bg-zinc-800 border-zinc-700 text-foreground'>
                          {cameraDevices.map((d: MediaDeviceOption) => (
                            <SelectItem key={d.deviceId} value={d.deviceId}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-2'>
                      <Label>Microphone</Label>
                      <Select
                        value={selectedMic}
                        onValueChange={setSelectedMic}
                      >
                        <SelectTrigger className='bg-zinc-800 border-zinc-700'>
                          <SelectValue placeholder='Select Mic' />
                        </SelectTrigger>
                        <SelectContent className='bg-zinc-800 border-zinc-700 text-foreground'>
                          {micDevices.map((d: MediaDeviceOption) => (
                            <SelectItem key={d.deviceId} value={d.deviceId}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {/* Record Button */}
            <div data-tour='interview-record-btn'>
              <Button
                onClick={
                  isRecording ? handleStopRecording : handleStartRecording
                }
                disabled={!streamInitialized || isConnecting}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-brand/100 hover:bg-brand shadow-brand/20" : "bg-brand hover:bg-brand/90 shadow-brand/20"} shadow-lg hover:scale-105 active:scale-95`}
              >
                {isConnecting ? (
                  <div className='w-5 h-5 border-2 border-background/30 border-t-black rounded-full animate-spin' />
                ) : isRecording ? (
                  <Square
                    fill='currentColor'
                    size={20}
                    className='text-foreground'
                  />
                ) : (
                  <div className='w-5 h-5 bg-foreground rounded md:rounded-sm' />
                )}
              </Button>
            </div>
            <div className='hidden sm:block w-24' /> {/* Spacer for balance */}
          </div>
        </div>

        {/* RIGHT COLUMN: Studio Tools */}
        <div className='xl:col-span-4 flex flex-col gap-4 min-h-0'>
          {/* 1. SCRIPT CARD */}
          <Card className='flex-[1.5] bg-foreground/5 backdrop-blur-sm border border-foreground/5 flex flex-col overflow-hidden group'>
            <div className='p-3 border-b border-foreground/5 flex items-center justify-between bg-foreground/5'>
              <h3 className='text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2'>
                <Edit2 size={12} /> Studio Script
              </h3>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsScriptEditing(!isScriptEditing)}
                className={`h-6 text-[10px] px-2 uppercase tracking-wider ${isScriptEditing ? "text-brand bg-brand/10 hover:bg-brand/20" : "text-foreground hover:text-foreground"}`}
              >
                {isScriptEditing ? (
                  <span className='flex items-center gap-1'>
                    <Check size={10} /> Done
                  </span>
                ) : (
                  "Edit"
                )}
              </Button>
            </div>
            <div className='flex-1 p-0 relative' data-tour='interview-script'>
              <Textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                readOnly={!isScriptEditing}
                className={`w-full h-full bg-transparent border-none resize-none focus:ring-0 p-4 font-mono text-sm leading-relaxed text-foreground/70 ${!isScriptEditing && "cursor-default select-none"}`}
              />
              {!isScriptEditing && isRecording && (
                <div className='absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-foreground/5 to-transparent pointer-events-none flex items-end justify-center pb-2'>
                  <span className='text-[10px] text-brand animate-pulse'>
                    Auto-scrolling...
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* 2. AI COACH */}
          <Card className='flex-1 bg-foreground/5 backdrop-blur-sm border border-foreground/5 flex flex-col p-4 relative overflow-hidden'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2'>
                <Activity size={12} /> AI Coach
              </h3>
              {isRecording && (
                <span className='px-1.5 py-0.5 rounded bg-brand text-black text-[9px] font-bold animate-pulse'>
                  LIVE
                </span>
              )}
            </div>

            <div className='grid grid-cols-2 gap-3'>
              {/* WPM */}
              <div className='rounded-lg p-3 border border-foreground/5 relative group'>
                <span className='text-[10px] text-foreground/50 uppercase'>
                  Pace
                </span>
                <div className='flex items-baseline gap-1 mt-1'>
                  <span
                    className={`text-2xl font-bold ${wpm > 160 ? "text-brand" : "text-foreground"}`}
                  >
                    {wpm}
                  </span>
                  <span className='text-[10px] text-foreground/50'>wpm</span>
                </div>
                <div className='h-1 w-full bg-foreground/60 rounded-full mt-2 overflow-hidden'>
                  <motion.div
                    className='h-full bg-blue-500'
                    animate={{ width: `${Math.min(100, (wpm / 200) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Filler Words */}
              <div className=' rounded-lg p-3 border border-foreground/5 relative'>
                <span className='text-[10px] text-foreground/50 uppercase'>
                  Filler Words
                </span>
                <div className='flex items-baseline gap-1 mt-1'>
                  <span
                    className={`text-2xl font-bold ${fillerWordCount > 5 ? "text-brand" : "text-foreground"}`}
                  >
                    {fillerWordCount}
                  </span>
                  <span className='text-[10px] text-foreground/50'>
                    detected
                  </span>
                </div>
                <div className='h-1 w-full bg-foreground/60 rounded-full mt-2 overflow-hidden'>
                  <motion.div
                    className='h-full bg-brand/100'
                    animate={{
                      width: `${Math.min(100, (fillerWordCount / 10) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className='mt-4 rounded-lg border border-foreground/10 bg-background/40 p-3'>
              <div className='mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-foreground/50'>
                <span>Transcript</span>
                <span>
                  {speechRecognitionSupported ? "Live" : "Unavailable"}
                </span>
              </div>
              <p className='text-xs leading-relaxed text-foreground/70 min-h-[56px]'>
                {speechRecognitionSupported
                  ? transcript ||
                    "Start a session to see your live transcript and coaching cues here."
                  : "Speech recognition is not supported in this browser, so pace and filler-word tracking are unavailable."}
              </p>
            </div>

            <div className='mt-auto pt-4 flex items-center justify-center gap-2 opacity-40'>
              <Sparkles size={10} />
              <span className='text-[9px] uppercase tracking-widest'>
                Web Speech API
              </span>
            </div>
          </Card>

          {/* 3. METRICS */}
          <Card className='flex-1 bg-foreground/5 backdrop-blur-sm border border-foreground/5 flex flex-col p-4'>
            <h3 className='text-xs font-bold text-foreground uppercase tracking-wider mb-2'>
              Session Metrics
            </h3>
            <div className='space-y-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-foreground/50'>Clarity</span>
                <span className='text-brand'>{clarityScore}%</span>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-foreground/50'>Sentiment</span>
                <span className='text-[#2dd4bf]'>{sentimentLabel}</span>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-foreground/50'>Eye Contact</span>
                <span className='text-foreground'>{eyeContactLabel}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Permission Error Toast */}
      <AnimatePresence>
        {permissionError && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className='absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 bg-brand/90 text-black rounded-lg shadow-xl flex items-center gap-3 border border-brand/50 z-50'
          >
            <AlertCircle size={18} />
            <span className='text-sm'>{permissionError}</span>
            <Button
              size='sm'
              variant='ghost'
              onClick={initializeStream}
              className='h-6 text-xs hover:bg-foreground/10'
            >
              Retry
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InterviewStudioPage;
